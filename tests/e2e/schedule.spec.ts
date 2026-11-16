import { expect, test } from "@playwright/test";
import { admin, deleteTitleBySlug, hasAdmin, revalidateCatalog } from "./helpers/supabase";

// ใช้ฐานข้อมูลจริง (ต้อง push migration update_day_followers ก่อน) → ข้ามถ้าไม่มี service role key
test.describe("ตารางอัปเดตรายวัน + เรียงลำดับหน้าหมวด", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  // ตัวระบุต่อโปรเจกต์ + สุ่ม: 5 โปรเจกต์โหลดไฟล์ในมิลลิวินาทีเดียวกันได้ → Date.now() อย่างเดียวชนกัน
  let stamp = "";
  let slugs: string[] = [];

  test.beforeEach(async ({}, info) => {
    stamp = `${info.project.name}-${Math.random().toString(36).slice(2, 7)}`;
    slugs = [`e2e-sch-mon-${stamp}`, `e2e-sch-done-${stamp}`, `e2e-sch-z-${stamp}`];
    const db = admin();
    const rows = [
      { slug: slugs[0], name: `เรื่องวันจันทร์ ${stamp}`, status: "ongoing", update_day: 1 },
      { slug: slugs[1], name: `เรื่องจบแล้ว ${stamp}`, status: "completed", update_day: 1 },
      { slug: slugs[2], name: `ซซซ ไม่ระบุวัน ${stamp}`, status: "ongoing", update_day: null },
    ];
    const res = await db
      .from("titles")
      .insert(rows.map((r) => ({ ...r, type: "novel" as const, published: true })));
    expect(res.error).toBeNull();
    await revalidateCatalog();
  });
  test.afterEach(async () => {
    for (const s of slugs) await deleteTitleBySlug(s);
  });

  test("แท็บวัน: เรื่องของวันนั้นขึ้น ส่วนเรื่องจบแล้ว/ไม่ระบุวัน/วันอื่นไม่ขึ้น", async ({ page }) => {
    await page.goto("/schedule?day=1");
    await expect(page.getByRole("link", { name: new RegExp(`เรื่องวันจันทร์ ${stamp}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`เรื่องจบแล้ว ${stamp}`) })).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(`ไม่ระบุวัน ${stamp}`) })).toHaveCount(0);

    await page.goto("/schedule?day=2");
    await expect(page.getByRole("link", { name: new RegExp(`เรื่องวันจันทร์ ${stamp}`) })).toHaveCount(
      0,
    );
  });

  test("หน้าเรื่องบอกวันอัปเดต (เฉพาะเรื่องที่ยังไม่จบ)", async ({ page }) => {
    await page.goto(`/title/${slugs[0]}`);
    await expect(page.getByText("อัปเดตทุกวันจันทร์")).toBeVisible();
    await page.goto(`/title/${slugs[1]}`);
    await expect(page.getByText(/อัปเดตทุกวัน/)).toHaveCount(0);
  });

  test("หน้าหมวด: เรียงตามชื่อ และลิงก์เรียงลำดับใช้งานได้", async ({ page }) => {
    await page.goto("/browse/novel?sort=name");
    await expect(page.getByRole("link", { name: "ชื่อ ก–ฮ" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const names = await page
      .locator("main a[href^='/title/'] >> text=/E2E|เรื่อง|ซซซ/")
      .allInnerTexts();
    const mine = names.filter((n) => n.includes(stamp));
    // ลำดับพจนานุกรมไทย: ซ (ซซซ) มาก่อน ร ("เรื่อง…" สระนำ เ ไม่นับเป็นตัวแรก)
    expect(mine.findIndex((n) => n.includes("ซซซ"))).toBeLessThan(
      mine.findIndex((n) => n.includes("เรื่องวันจันทร์")),
    );

    await page.getByRole("link", { name: "ยอดนิยม" }).click();
    await expect(page).toHaveURL(/sort=popular/);
  });
});

test("ตารางรายวัน: มีลิงก์ในเมนูและเปิดได้ครบ 7 วัน", async ({ page }) => {
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { name: "ตารางอัปเดตรายวัน" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "เลือกวัน" }).getByRole("link")).toHaveCount(7);
  // ลิงก์ไปตารางอยู่ในเมนูล่าง (มือถือ) หรือเมนูบน (จอ md ขึ้นไป) อย่างใดอย่างหนึ่งต้องเห็น
  await expect(
    page.getByRole("link", { name: /^(รายวัน|ตารางรายวัน)$/ }).filter({ visible: true }),
  ).toHaveCount(1);
});
