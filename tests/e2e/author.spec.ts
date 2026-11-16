import { expect, test } from "@playwright/test";
import { admin, deleteTitleBySlug, hasAdmin, revalidateCatalog } from "./helpers/supabase";

// ต้อง push migration title_author ก่อน
test.describe("หน้าผู้สร้าง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const author = `นักเขียน ${stamp} & ลองทดสอบ`; // มีช่องว่างและอักขระพิเศษ ต้องเข้ารหัส URL ได้
  const slugs = [`e2e-au-a-${stamp}`, `e2e-au-b-${stamp}`, `e2e-au-c-${stamp}`];

  test.beforeEach(async () => {
    const res = await admin()
      .from("titles")
      .insert([
        { slug: slugs[0], name: `งาน A ${stamp}`, type: "novel", published: true, author },
        { slug: slugs[1], name: `งาน B ${stamp}`, type: "manga", published: true, author },
        {
          slug: slugs[2],
          name: `งานคนอื่น ${stamp}`,
          type: "novel",
          published: true,
          author: `อื่น ${stamp}`,
        },
      ]);
    expect(res.error).toBeNull();
    await revalidateCatalog();
  });
  test.afterEach(async () => {
    for (const s of slugs) await deleteTitleBySlug(s);
  });

  test("หน้าเรื่องมี 'โดย …' ลิงก์ไปหน้าผู้สร้าง ซึ่งรวมเฉพาะผลงานของคนนั้น", async ({ page }) => {
    await page.goto(`/title/${slugs[0]}`);
    await page.getByRole("link", { name: author }).click();
    await expect(page).toHaveURL(/\/author\//);
    await expect(page.getByRole("heading", { name: author })).toBeVisible();
    await expect(page.getByText("2 เรื่อง")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`งาน A ${stamp}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`งาน B ${stamp}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`งานคนอื่น ${stamp}`) })).toHaveCount(0);
  });

  test("ชื่อที่ไม่มีผลงาน → 404", async ({ page }) => {
    await page.goto(`/author/${encodeURIComponent(`ไม่มีคนนี้ ${stamp}`)}`);
    await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
  });

  test("ไม่ระบุผู้แต่ง: หน้าเรื่องไม่มีบรรทัด 'โดย'", async ({ page }) => {
    await admin().from("titles").update({ author: null }).eq("slug", slugs[0]);
    await revalidateCatalog();
    await page.goto(`/title/${slugs[0]}`);
    await expect(page.getByRole("heading", { name: `งาน A ${stamp}` })).toBeVisible();
    await expect(page.getByText(/^โดย /)).toHaveCount(0);
  });
});
