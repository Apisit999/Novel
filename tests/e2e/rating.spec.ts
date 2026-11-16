import { expect, test } from "@playwright/test";
import { admin, deleteTitleBySlug, hasAdmin, revalidateCatalog } from "./helpers/supabase";

test.describe("เรตอายุ: ป้ายและตัวกรองในหน้าหมวด", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const adult = `e2e-r18-${stamp}`;
  const teen = `e2e-r13-${stamp}`;

  test.beforeEach(async () => {
    const res = await admin()
      .from("titles")
      .insert([
        { slug: adult, name: `ผู้ใหญ่ ${stamp}`, type: "novel", published: true, rating: "18" },
        { slug: teen, name: `วัยรุ่น ${stamp}`, type: "novel", published: true, rating: "13" },
      ]);
    expect(res.error).toBeNull();
    await revalidateCatalog();
  });
  test.afterEach(async () => {
    await deleteTitleBySlug(adult);
    await deleteTitleBySlug(teen);
  });

  test("การ์ดมีป้าย 18+/13+ และ 'ซ่อน' ตัดเฉพาะ 18+", async ({ page }) => {
    await page.goto("/browse/novel");
    const adultCard = page.getByRole("link", { name: new RegExp(`ผู้ใหญ่ ${stamp}`) });
    await expect(adultCard).toBeVisible();
    await expect(adultCard.getByLabel("เรตอายุ 18 ปีขึ้นไป")).toBeVisible();

    await page.getByRole("link", { name: "ซ่อน", exact: true }).click();
    await expect(page).toHaveURL(/adult=hide/);
    await expect(adultCard).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(`วัยรุ่น ${stamp}`) })).toBeVisible();
  });

  test("หน้าเรื่องบอกเรต", async ({ page }) => {
    await page.goto(`/title/${adult}`);
    await expect(page.getByText(/เรต 18\+/)).toBeVisible();
  });
});
