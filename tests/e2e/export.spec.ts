import { expect, test } from "@playwright/test";
import JSZip from "jszip";
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

// ต่อ Supabase จริง + ใช้โควตายืนยันลิงก์ → desktop เท่านั้น
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

const body = (n: number) =>
  `ย่อหน้าแรกของตอนที่ ${n} ` +
  "เรื่องราวดำเนินต่อไป ".repeat(10) +
  `\n\nย่อหน้าสองของตอนที่ ${n} ` +
  "จบลงเพียงเท่านี้ ".repeat(10);

test.describe("ส่งออก/สำรองนิยาย (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let plain: TestUser | null = null;
  let created = false;
  const slugs: string[] = [];
  let titleId = "";
  let slug = "";

  test.beforeEach(async () => {
    user = await createTestUser();
    await makeAdmin(user.id);
    slug = `e2e-export-${Math.random().toString(36).slice(2, 8)}`;
    slugs.push(slug);
    const t = await admin()
      .from("titles")
      .insert({
        slug,
        name: "นิยายส่งออกทดสอบ",
        type: "novel",
        published: true,
        author: "นักเขียนทดสอบ",
      })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    titleId = t.data!.id;
    const eps = await admin()
      .from("episodes")
      .insert([
        { title_id: titleId, number: 1, name: "ประตูสีเขียว", status: "published" as const },
        { title_id: titleId, number: 2, name: "ตอนที่ 2 เสียงในหมอก", status: "draft" as const },
        { title_id: titleId, number: 3, name: "ฉบับลับ", status: "draft" as const },
      ])
      .select("id, number");
    expect(eps.error).toBeNull();
    const byNo = new Map(eps.data!.map((e) => [e.number, e.id]));
    await admin()
      .from("novel_bodies")
      .insert(
        [1, 2, 3].map((n) => ({
          episode_id: byNo.get(n)!,
          body_markdown: body(n),
          word_count: 10,
        })),
      );
    await admin()
      .from("novel_translations")
      .insert({
        episode_id: byNo.get(1)!,
        lang: "en",
        body_markdown: "English body of chapter one",
        machine: true,
      });
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    for (const s of slugs.splice(0)) await deleteTitleBySlug(s);
    await deleteUser(user.id);
    if (plain) await deleteUser(plain.id);
    plain = null;
  });

  test("ส่งออก .md/.txt: ครบทุกตอนรวมฉบับร่าง หัวตอนนำเข้ากลับได้ ชื่อไฟล์ปลอดภัย", async ({ page }) => {
    await page.goto(callbackUrl(user, `/admin/titles/${titleId}`));
    const md = await page.request.get(`/admin/titles/${titleId}/export?format=md`);
    expect(md.status()).toBe(200);
    expect(md.headers()["content-disposition"]).toBe(`attachment; filename="${slug}.md"`);
    expect(md.headers()["content-type"]).toContain("text/markdown");
    expect(md.headers()["cache-control"]).toContain("no-store");
    const text = await md.text();
    expect(text).toContain("# นิยายส่งออกทดสอบ");
    expect(text).toContain("ผู้แต่ง: นักเขียนทดสอบ");
    expect(text).toContain("# ตอนที่ 1 ประตูสีเขียว");
    expect(text).toContain("# ตอนที่ 2 เสียงในหมอก"); // ชื่อที่เป็นหัวตอนอยู่แล้ว ไม่เติมซ้ำ
    expect(text).not.toContain("ตอนที่ 2 ตอนที่ 2");
    expect(text).toContain("# ตอนที่ 3 ฉบับลับ"); // ฉบับร่างก็ถูกสำรอง
    expect(text).not.toContain("English body"); // คำแปลอยู่ใน zip สำรองทั้งระบบ ไม่ปนในไฟล์ไทย

    const txt = await page.request.get(`/admin/titles/${titleId}/export?format=txt`);
    expect(txt.headers()["content-disposition"]).toBe(`attachment; filename="${slug}.txt"`);
    const t = await txt.text();
    expect(t).toContain("\nตอนที่ 1 ประตูสีเขียว\n");
    expect(t).not.toContain("# ตอนที่"); // txt ไม่มีเครื่องหมาย #
  });

  test("ส่งออกแล้วนำเข้ากลับเข้าเรื่องใหม่ได้ครบ เลขและเนื้อหาตรงเดิม (round trip จริง)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(callbackUrl(user, `/admin/titles/${titleId}`));
    const text = await (await page.request.get(`/admin/titles/${titleId}/export?format=md`)).text();

    const other = `e2e-export-copy-${Math.random().toString(36).slice(2, 8)}`;
    slugs.push(other);
    const t = await admin()
      .from("titles")
      .insert({ slug: other, name: "สำเนา", type: "novel", published: false })
      .select("id")
      .single();
    expect(t.error).toBeNull();

    await page.goto(`/admin/titles/${t.data!.id}/import`);
    await page.getByLabel("หรือวางข้อความที่คัดลอกมา").fill(text);
    await expect(async () => {
      await page.getByRole("button", { name: "อ่านและแบ่งตอน" }).click();
      await expect(page.getByText(/พบ 3 ตอน/)).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    // ชื่อเรื่อง/ผู้แต่งเป็นคำนำ ไม่ถูกนำเข้า — แจ้งให้รู้
    await expect(page.getByText(/มีข้อความก่อนหัวตอนแรก/)).toBeVisible();
    await page.getByRole("button", { name: /^นำเข้า 3 ตอน$/ }).click();
    await expect(page.getByRole("heading", { name: "นำเข้าเสร็จแล้ว" })).toBeVisible({
      timeout: 30_000,
    });

    const copy = await admin()
      .from("episodes")
      .select("number, name, novel_bodies(body_markdown)")
      .eq("title_id", t.data!.id)
      .order("number", { ascending: true });
    expect(copy.data!.map((e) => e.number)).toEqual([1, 2, 3]);
    expect(copy.data!.map((e) => e.name)).toEqual([
      "ตอนที่ 1 ประตูสีเขียว",
      "ตอนที่ 2 เสียงในหมอก",
      "ตอนที่ 3 ฉบับลับ",
    ]);
    for (const e of copy.data!) {
      const b = e.novel_bodies as unknown as { body_markdown: string };
      // นำเข้าตัดช่องว่างท้ายบรรทัดให้ (ตั้งใจ) — เนื้อหา/ย่อหน้าที่เหลือต้องตรงเดิมทุกตัวอักษร
      expect(b.body_markdown).toBe(
        body(e.number)
          .replace(/[ \t]+$/gm, "")
          .trim(),
      );
    }
  });

  test("สำรองทั้งระบบ (.zip): มีนิยาย + info.json + คำแปล และ JSON ตรงกับข้อมูลจริง", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(callbackUrl(user, "/admin"));
    const res = await page.request.get("/admin/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/zip");
    expect(res.headers()["content-disposition"]).toMatch(
      /^attachment; filename="aandoo-novels-\d{4}-\d{2}-\d{2}\.zip"$/,
    );

    const zip = await JSZip.loadAsync(await res.body());
    const names = Object.keys(zip.files);
    expect(names).toContain(`${slug}/novel.md`);
    expect(names).toContain(`${slug}/info.json`);
    expect(names).toContain(`${slug}/translations/en.md`);
    // ชื่อไฟล์ในไฟล์ zip ต้องไม่มี path ออกนอกโฟลเดอร์
    expect(names.every((n) => !n.includes("..") && !n.startsWith("/"))).toBe(true);

    const info = JSON.parse(await zip.file(`${slug}/info.json`)!.async("string"));
    expect(info.title).toMatchObject({ slug, author: "นักเขียนทดสอบ", published: true });
    expect(
      info.episodes.map((e: { number: number; status: string }) => [e.number, e.status]),
    ).toEqual([
      [1, "published"],
      [2, "draft"],
      [3, "draft"],
    ]);
    expect(info.episodes[0].translations).toEqual([{ lang: "en", machine: true }]);
    const en = await zip.file(`${slug}/translations/en.md`)!.async("string");
    expect(en).toContain("English body of chapter one");
    const novel = await zip.file(`${slug}/novel.md`)!.async("string");
    expect(novel).toContain("# ตอนที่ 3 ฉบับลับ");
  });

  test("สิทธิ์: ไม่ล็อกอิน → ส่งไปหน้าล็อกอิน; ผู้ใช้ทั่วไป → 404; เรื่องที่ไม่ใช่นิยาย → 404", async ({
    page,
    playwright,
  }) => {
    test.setTimeout(90_000);
    const anon = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
    for (const path of [`/admin/titles/${titleId}/export?format=md`, "/admin/export"]) {
      const res = await anon.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers().location, path).toContain("/login");
    }
    await anon.dispose();

    // ผู้ใช้ล็อกอินที่ไม่ใช่แอดมิน
    plain = await createTestUser();
    await page.goto(callbackUrl(plain, "/"));
    for (const path of [`/admin/titles/${titleId}/export?format=md`, "/admin/export"]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(404);
    }

    // แอดมินขอส่งออกเรื่องที่ไม่ใช่นิยาย
    await admin().from("titles").update({ type: "manga" }).eq("id", titleId);
    await page.context().clearCookies();
    await page.goto(callbackUrl(user, "/admin"));
    const res = await page.request.get(`/admin/titles/${titleId}/export?format=md`);
    expect(res.status()).toBe(404);
  });
});
