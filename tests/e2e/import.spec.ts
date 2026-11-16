import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  admin,
  callbackUrl,
  createTestUser,
  deleteTitleBySlug,
  deleteUser,
  hasAdmin,
  makeAdmin,
  type TestUser,
} from "./helpers/supabase";

// ต่อ Supabase จริง + ใช้โควตายืนยันลิงก์ 1 ครั้ง → desktop เท่านั้น (ไม่ต้องมี migration ใหม่)
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

const para = (n: number) => `ย่อหน้าแรกของตอนที่ ${n} ` + "เรื่องราวดำเนินต่อไป ".repeat(15);

const chapter = (n: number, title = "") =>
  `ตอนที่ ${n}${title ? " " + title : ""}\n${para(n)}\n${para(n).replace("แรก", "สอง")}`;

test.describe("นำเข้าหลายตอน (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  let slug = "";
  let titleId = "";

  test.beforeEach(async ({}, info) => {
    user = await createTestUser();
    await makeAdmin(user.id);
    slug = `e2e-import-${info.project.name}-${Math.random().toString(36).slice(2, 7)}`;
    const t = await admin()
      .from("titles")
      .insert({ slug, name: "นิยายนำเข้าทดสอบ", type: "novel", published: false })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    titleId = t.data!.id;
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteTitleBySlug(slug); // ตอน+เนื้อหาถูกลบตามด้วย cascade
    await deleteUser(user.id);
  });

  const episodes = async () =>
    (
      await admin()
        .from("episodes")
        .select("number, name, status, publish_at, novel_bodies(body_markdown, word_count)")
        .eq("title_id", titleId)
        .order("number", { ascending: true })
    ).data ?? [];

  async function open(page: Page) {
    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/import`));
    await expect(page.getByRole("heading", { name: "นำเข้าหลายตอน" })).toBeVisible();
  }
  /** วางข้อความ + กดแบ่งตอน (กดซ้ำจนกว่าจะแบ่งได้ เพราะปุ่มทำงานหลัง hydrate) */
  async function paste(page: Page, text: string, expectedFound: RegExp) {
    await page.getByLabel("หรือวางข้อความที่คัดลอกมา").fill(text);
    await expect(async () => {
      await page.getByRole("button", { name: "อ่านและแบ่งตอน" }).click();
      await expect(page.getByText(expectedFound)).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
  }
  const run = (page: Page) => page.getByRole("button", { name: /^นำเข้า [\d,]+ ตอน$/ });

  test("วางข้อความ → แบ่งตอน → แก้ชื่อ → บันทึกเป็นฉบับร่าง (ผู้อ่านยังไม่เห็น)", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    const text = [chapter(1, "ประตูสีเขียว"), chapter(2, "เสียงในหมอก"), chapter(3)].join("\n\n");
    await paste(page, text, /พบ 3 ตอน/);

    await expect(page.getByLabel("ชื่อตอนลำดับที่ 1")).toHaveValue("ตอนที่ 1 ประตูสีเขียว");
    await expect(page.getByLabel("เลขตอนของลำดับที่ 3")).toHaveValue("3");
    await page.getByLabel("ชื่อตอนลำดับที่ 2").fill("ตอนที่ 2 เสียงในหมอก (แก้ชื่อ)");

    await expect(page.getByLabel("สถานะตอนที่นำเข้า")).toHaveValue("draft"); // ค่าเริ่มต้นปลอดภัย
    await run(page).click();
    await expect(page.getByRole("heading", { name: "นำเข้าเสร็จแล้ว" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("สร้างตอนใหม่ 3 ตอน")).toBeVisible();

    const eps = await episodes();
    expect(eps.map((e) => [e.number, e.status])).toEqual([
      [1, "draft"],
      [2, "draft"],
      [3, "draft"],
    ]);
    expect(eps[1].name).toBe("ตอนที่ 2 เสียงในหมอก (แก้ชื่อ)");
    const b = eps[0].novel_bodies as unknown as { body_markdown: string; word_count: number };
    expect(b.body_markdown).toContain("ย่อหน้าแรกของตอนที่ 1");
    expect(b.body_markdown).not.toContain("ตอนที่ 2"); // ไม่ปนเนื้อหาข้ามตอน
    expect(b.word_count).toBeGreaterThan(10);

    // ฉบับร่าง: ผู้เยี่ยมชมไม่เห็นตอน (เรื่องก็ยังไม่เผยแพร่)
    await page.context().clearCookies();
    const res = await page.goto(`/read/${slug}/1`);
    await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
    expect(res?.status() === 200 || res?.status() === 404).toBe(true);
  });

  test("ไฟล์ Word (.docx) และไฟล์ .txt ภาษาไทยแบบเก่า (Windows-874) อ่านภาษาไทยถูกต้อง", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page);

    // .docx ตัวอย่าง 2 ตอน
    await page.getByLabel(/ไฟล์นิยาย/).setInputFiles("tests/e2e/helpers/sample-novel.docx");
    await expect(async () => {
      await page.getByRole("button", { name: "อ่านและแบ่งตอน" }).click();
      await expect(page.getByText(/พบ 2 ตอน/)).toBeVisible({ timeout: 2500 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByLabel("ชื่อตอนลำดับที่ 1")).toHaveValue("ตอนที่ 1 ประตูสีเขียว");
    await expect(page.getByLabel("ชื่อตอนลำดับที่ 2")).toHaveValue("ตอนที่ 2 เสียงในหมอก");

    // .txt Windows-874: "ตอนที่ 5 สวัสดี" + เนื้อหา (เข้ารหัสไบต์ตรง ๆ)
    const tis = (s: string) =>
      Buffer.from(
        [...s].map((c) => {
          const cp = c.codePointAt(0)!;
          return cp >= 0x0e01 && cp <= 0x0e5b ? cp - 0x0e01 + 0xa1 : cp;
        }),
      );
    const thaiBody = "สวัสดีครับ ".repeat(40);
    const txt = tis(`ตอนที่ 5 สวัสดี\n${thaiBody}\n${thaiBody}`);
    await page.getByLabel(/ไฟล์นิยาย/).setInputFiles({
      name: "ตอน5.txt",
      mimeType: "text/plain",
      buffer: txt,
    });
    await page.getByLabel("หรือวางข้อความที่คัดลอกมา").fill("");
    await page.getByRole("button", { name: "อ่านและแบ่งตอน" }).click();
    await expect(page.getByText(/พบ 1 ตอน/)).toBeVisible();
    await expect(page.getByLabel("ชื่อตอนลำดับที่ 1")).toHaveValue("ตอนที่ 5 สวัสดี"); // ไม่ใช่ตัวเพี้ยน
    await expect(page.getByLabel("เลขตอนของลำดับที่ 1")).toHaveValue("5");

    // ไฟล์ที่ไม่รองรับ → แจ้งชัดเจน
    await page.getByLabel(/ไฟล์นิยาย/).setInputFiles({
      name: "นิยาย.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });
    await page.getByRole("button", { name: "อ่านและแบ่งตอน" }).click();
    await expect(page.getByText(/ไม่รองรับไฟล์ นิยาย.pdf/)).toBeVisible();
  });

  test("เลขซ้ำกับที่มีอยู่: ข้าม / เขียนทับ — และเลขซ้ำกันเองในรายการต้องแก้ก่อนนำเข้า", async ({ page }) => {
    test.setTimeout(120_000);
    // ตอนเดิม 1–2
    await admin()
      .from("episodes")
      .insert(
        [1, 2].map((n) => ({
          title_id: titleId,
          number: n,
          name: `เดิม ${n}`,
          status: "draft" as const,
        })),
      );
    await open(page);

    // ส่วนที่ซ้ำ: นำเข้าตอน 2–3 โดยข้ามตอน 2
    await paste(page, [chapter(2, "ใหม่"), chapter(3, "ใหม่")].join("\n\n"), /พบ 2 ตอน/);
    await expect(page.getByText(/1 ตอนมีเลขตรงกับที่มีอยู่แล้ว/)).toBeVisible();
    await run(page).click();
    await expect(page.getByRole("heading", { name: "นำเข้าเสร็จแล้ว" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("สร้างตอนใหม่ 1 ตอน")).toBeVisible();
    await expect(page.getByText(/ข้าม 1 ตอนที่มีอยู่แล้ว \(เลข 2\)/)).toBeVisible();
    let eps = await episodes();
    expect(eps.find((e) => e.number === 2)?.name).toBe("เดิม 2"); // ไม่ถูกแตะ
    expect(eps.find((e) => e.number === 2)?.novel_bodies).toBeNull(); // ไม่ได้เขียนเนื้อหา

    // เขียนทับ: นำเข้าตอน 2 อีกครั้งแบบเขียนทับ
    await page.getByRole("button", { name: "นำเข้าเพิ่ม" }).click();
    await paste(page, chapter(2, "เขียนทับ"), /พบ 1 ตอน/);
    await page.getByLabel("ถ้าเลขตอนซ้ำกับที่มีอยู่แล้ว").selectOption("overwrite");
    await run(page).click();
    await expect(page.getByText("เขียนทับ 1 ตอน")).toBeVisible({ timeout: 30_000 });
    eps = await episodes();
    const two = eps.find((e) => e.number === 2)!;
    expect(two.name).toBe("ตอนที่ 2 เขียนทับ");
    expect((two.novel_bodies as unknown as { body_markdown: string }).body_markdown).toContain(
      "ตอนที่ 2",
    );

    // เลขซ้ำกันเองในรายการ → ปุ่มนำเข้าถูกปิด จนกว่าจะแก้
    await page.getByRole("button", { name: "นำเข้าเพิ่ม" }).click();
    await paste(page, [chapter(7), chapter(7)].join("\n\n"), /พบ 2 ตอน/);
    await expect(page.getByRole("alert").filter({ hasText: "เลขตอนซ้ำกันในรายการ" })).toBeVisible();
    await expect(run(page)).toBeDisabled();
    await page.getByLabel("เลขตอนของลำดับที่ 2").fill("8");
    await expect(run(page)).toBeEnabled();
  });

  test("ตั้งเวลาเผยแพร่ทยอยลง: วันละ 2 ตอน เวลาไทยถูกต้อง", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await paste(page, [1, 2, 3, 4, 5].map((n) => chapter(n)).join("\n\n"), /พบ 5 ตอน/);
    await page.getByLabel("สถานะตอนที่นำเข้า").selectOption("scheduled");
    await page.getByLabel("วันที่ลงตอนแรก").fill("2030-01-30");
    await page.getByLabel("เวลา (เวลาไทย)").fill("18:00");
    await page.getByLabel("ลงวันละกี่ตอน").fill("2");
    await expect(page.getByText(/ตอนสุดท้ายลง 2030-02-01 เวลา 18:00/)).toBeVisible();
    await run(page).click();
    await expect(page.getByRole("heading", { name: "นำเข้าเสร็จแล้ว" })).toBeVisible({
      timeout: 30_000,
    });

    const eps = await episodes();
    expect(eps.every((e) => e.status === "scheduled")).toBe(true);
    // 18:00 เวลาไทย = 11:00 UTC; ตอน 1–2 วันที่ 30, 3–4 วันที่ 31, 5 วันที่ 1 ก.พ.
    expect(eps.map((e) => e.publish_at?.slice(0, 16))).toEqual([
      "2030-01-30T11:00",
      "2030-01-30T11:00",
      "2030-01-31T11:00",
      "2030-01-31T11:00",
      "2030-02-01T11:00",
    ]);
  });

  test("นำเข้าหลายร้อยตอน: ส่งเป็นชุด ครบทุกตอน เลขต่อเนื่อง ไม่ตกหล่น", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    const N = 150;
    const big = Array.from({ length: N }, (_, i) => chapter(i + 1)).join("\n\n");
    await paste(page, big, new RegExp(`พบ ${N} ตอน`));
    await run(page).click();
    await expect(page.getByRole("heading", { name: "นำเข้าเสร็จแล้ว" })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByText(`สร้างตอนใหม่ ${N} ตอน`)).toBeVisible();

    const eps = await episodes();
    expect(eps).toHaveLength(N);
    expect(eps.map((e) => e.number)).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    // เนื้อหาตรงตอน (สุ่มตรวจต้น กลาง ปลาย)
    for (const n of [1, 77, N]) {
      const b = eps[n - 1].novel_bodies as unknown as { body_markdown: string };
      expect(b.body_markdown).toContain(`ย่อหน้าแรกของตอนที่ ${n} `);
      expect(b.body_markdown).not.toContain(`ย่อหน้าแรกของตอนที่ ${n + 1} `);
    }
  });

  test("ไม่ใช่แอดมิน/ไม่ล็อกอิน เข้าหน้านำเข้าไม่ได้", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/admin/titles/${titleId}/import`);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ไฟล์ตัวอย่าง .docx ต้องมีอยู่จริง (สร้างด้วยสคริปต์ครั้งเดียว) — กันลบทิ้งโดยไม่ตั้งใจ
test("ไฟล์ตัวอย่าง sample-novel.docx เป็น zip ที่ถูกต้อง", () => {
  const buf = readFileSync("tests/e2e/helpers/sample-novel.docx");
  expect(buf.subarray(0, 2).toString()).toBe("PK");
});
