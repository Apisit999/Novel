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

// ต่อ Supabase จริง + ใช้โควตายืนยันลิงก์ 1 ครั้ง → desktop เท่านั้น
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("จัดการหลายตอน + ค้นหาเรื่อง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slugs: string[] = [];

  test.beforeEach(async () => {
    user = await createTestUser();
    await makeAdmin(user.id);
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    for (const s of slugs.splice(0)) await deleteTitleBySlug(s);
    await deleteUser(user.id);
  });

  async function makeNovel(name: string, episodeCount: number) {
    const slug = `e2e-bulk-${Math.random().toString(36).slice(2, 9)}`;
    slugs.push(slug);
    const t = await admin()
      .from("titles")
      .insert({ slug, name, type: "novel", published: false })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    const rows = Array.from({ length: episodeCount }, (_, i) => ({
      title_id: t.data!.id,
      number: i + 1,
      name: `ตอนที่ ${i + 1}`,
      status: "draft" as const,
    }));
    for (let i = 0; i < rows.length; i += 60) {
      const r = await admin()
        .from("episodes")
        .insert(rows.slice(i, i + 60));
      expect(r.error).toBeNull();
    }
    return { id: t.data!.id, slug };
  }

  const eps = async (titleId: string) =>
    (
      await admin()
        .from("episodes")
        .select("number, status, access, publish_at")
        .eq("title_id", titleId)
        .order("number", { ascending: true })
        .limit(1000)
    ).data ?? [];

  async function selectRange(page: Page, from: number, to: number) {
    await page.getByLabel("เลือกจากเลขตอน").fill(String(from));
    await page.getByLabel("เลือกถึงเลขตอน").fill(String(to));
    await page.getByRole("button", { name: "เลือกช่วงนี้" }).click();
    await expect(page.getByText(`เลือกแล้ว ${to - from + 1} ตอน`)).toBeVisible();
  }
  const panel = (page: Page) => page.getByRole("region", { name: "จัดการตอนที่เลือก" });

  test("120 ตอน: แบ่งหน้า ค้นหา เลือกช่วง → เผยแพร่ / ตั้งเวลาทยอยลง / สิทธิ์ / ลบ", async ({ page }) => {
    test.setTimeout(150_000);
    const { id } = await makeNovel("นิยายหลายตอน", 120);
    await page.goto(callbackUrl(user, `/admin/titles/${id}`));
    await expect(page.getByRole("heading", { name: "ตอน (120)" })).toBeVisible();

    // แบ่งหน้า 50 ตอน/หน้า → 3 หน้า
    await expect(page.getByText("หน้า 1 / 3")).toBeVisible();
    await expect(page.getByRole("list", { name: "รายการตอน" }).getByRole("listitem")).toHaveCount(
      50,
    );
    await page.getByRole("button", { name: "ถัดไป →" }).click();
    await expect(page.getByText("หน้า 2 / 3")).toBeVisible();

    // ค้นหาเลขตอน → เหลือตอนเดียว
    await page.getByLabel("ค้นหาตอน").fill("77");
    await expect(page.getByRole("list", { name: "รายการตอน" }).getByRole("listitem")).toHaveCount(
      1,
    );
    await page.getByLabel("ค้นหาตอน").fill("");

    // เลือก 1–60 → เผยแพร่ทันที
    await selectRange(page, 1, 60);
    await panel(page).getByRole("button", { name: "เผยแพร่ทันที" }).click();
    await expect(page.getByText("เผยแพร่ 60 ตอนแล้ว")).toBeVisible({ timeout: 30_000 });
    let rows = await eps(id);
    expect(rows.filter((e) => e.status === "published").map((e) => e.number)).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 1),
    );
    expect(rows.filter((e) => e.status === "draft")).toHaveLength(60);

    // กรองฉบับร่าง → ตอน 1–60 หายไป
    await page.getByRole("button", { name: "ฉบับร่าง" }).click();
    await expect(page.getByText("หน้า 1 / 2")).toBeVisible(); // เหลือ 60 ตอน → 2 หน้า
    await page.getByRole("button", { name: "ทั้งหมด", exact: true }).click();

    // เลือก 61–120 → ตั้งเวลาวันละ 3 ตอน เริ่ม 1 มี.ค. 2030 เวลา 08:00 (ไทย)
    await page.getByRole("button", { name: "ล้างที่เลือก" }).click();
    await selectRange(page, 61, 120);
    await panel(page).getByRole("button", { name: "ตั้งเวลาทยอยลง…" }).click();
    await panel(page).getByLabel("วันที่ลงตอนแรก").fill("2030-03-01");
    await panel(page).getByLabel("เวลา (เวลาไทย)").fill("08:00");
    await panel(page).getByLabel("ลงวันละกี่ตอน").fill("3");
    await panel(page).getByRole("button", { name: "ตั้งเวลา 60 ตอน" }).click();
    await expect(page.getByText("ตั้งเวลาเผยแพร่ 60 ตอนแล้ว")).toBeVisible({ timeout: 30_000 });
    rows = await eps(id);
    const sched = rows.filter((e) => e.status === "scheduled");
    expect(sched).toHaveLength(60);
    // 08:00 เวลาไทย = 01:00 UTC; ตอน 61–63 วันที่ 1, 64–66 วันที่ 2, …, 118–120 วันที่ 20
    expect(sched[0].publish_at?.slice(0, 16)).toBe("2030-03-01T01:00");
    expect(sched[2].publish_at?.slice(0, 16)).toBe("2030-03-01T01:00");
    expect(sched[3].publish_at?.slice(0, 16)).toBe("2030-03-02T01:00");
    expect(sched[59].publish_at?.slice(0, 16)).toBe("2030-03-20T01:00");

    // เปลี่ยนสิทธิ์ 1–10 เป็น Premium
    await page.getByRole("button", { name: "ล้างที่เลือก" }).click();
    await selectRange(page, 1, 10);
    await panel(page).getByRole("button", { name: "เปลี่ยนสิทธิ์การอ่าน…" }).click();
    await panel(page).getByRole("combobox").selectOption("premium");
    await panel(page).getByRole("button", { name: "ใช้กับ 10 ตอน" }).click();
    await expect(page.getByText("เปลี่ยนสิทธิ์ 10 ตอนแล้ว")).toBeVisible({ timeout: 30_000 });
    rows = await eps(id);
    expect(rows.filter((e) => e.access === "premium").map((e) => e.number)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );

    // ลบ 111–120 (ยืนยันก่อน)
    await page.getByRole("button", { name: "ล้างที่เลือก" }).click();
    await selectRange(page, 111, 120);
    page.once("dialog", (d) => d.accept());
    await panel(page).getByRole("button", { name: "ลบที่เลือก" }).click();
    await expect(page.getByText("ลบ 10 ตอนแล้ว")).toBeVisible({ timeout: 30_000 });
    rows = await eps(id);
    expect(rows).toHaveLength(110);
    expect(Math.max(...rows.map((e) => e.number))).toBe(110);
    await expect(page.getByRole("heading", { name: "ตอน (110)" })).toBeVisible();
  });

  test("ยกเลิกยืนยันลบ: ไม่ลบอะไร", async ({ page }) => {
    const { id } = await makeNovel("นิยายทดสอบยกเลิกลบ", 5);
    await page.goto(callbackUrl(user, `/admin/titles/${id}`));
    await selectRange(page, 1, 3);
    page.once("dialog", (d) => d.dismiss());
    await panel(page).getByRole("button", { name: "ลบที่เลือก" }).click();
    await expect(page.getByText("เลือกแล้ว 3 ตอน")).toBeVisible();
    expect(await eps(id)).toHaveLength(5);
  });

  test("ค้นหาเรื่องในหน้าแอดมิน: ตามชื่อ/ประเภท และคำค้นแปลก ๆ ไม่ทำให้หน้าพัง", async ({ page }) => {
    const stamp = Math.random().toString(36).slice(2, 8);
    await makeNovel(`ค้นหาทดสอบ ${stamp} หนึ่ง`, 1);
    const b = await makeNovel(`ค้นหาทดสอบ ${stamp} สอง`, 1);
    await admin().from("titles").update({ type: "manga" }).eq("id", b.id);

    await page.goto(callbackUrl(user, `/admin?q=${stamp}`));
    await expect(page.getByRole("link", { name: new RegExp(`${stamp} หนึ่ง`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`${stamp} สอง`) })).toBeVisible();

    await page.getByLabel("ประเภท").selectOption("novel");
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(`${stamp} หนึ่ง`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`${stamp} สอง`) })).toHaveCount(0);

    // อักขระที่เป็นไวยากรณ์ตัวกรอง ต้องไม่ทำให้ error
    for (const q of [`a,b`, `(x)`, `%`, `*`, `\\`, `name.eq.x),or(slug.ilike.%`]) {
      const res = await page.goto(`/admin?q=${encodeURIComponent(q)}`);
      expect(res?.status(), q).toBe(200);
      await expect(page.getByRole("heading", { name: "เรื่องทั้งหมด" })).toBeVisible();
    }
    await page.goto(`/admin?q=${encodeURIComponent(`ไม่มีเรื่องนี้แน่นอน ${stamp}`)}`);
    await expect(page.getByText("ไม่พบเรื่องที่ตรงเงื่อนไข")).toBeVisible();
  });
});
