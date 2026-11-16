import { expect, test } from "@playwright/test";
import { hasAdmin, SUPABASE_URL } from "./helpers/supabase";
import { createVideoFixture, deleteVideoFixture } from "./helpers/video";

// ใช้ฐานข้อมูล+Storage จริง → ข้ามถ้าไม่มี service role key (ต้อง push migration video_storage ก่อน)
test.describe("ตัวเล่นวิดีโอ (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");

  let slug: string;
  let draftSlug: string;
  let keys: string[];

  test.beforeEach(async ({}, info) => {
    const id = `${info.project.name}-${Math.random().toString(36).slice(2, 7)}`;
    slug = `e2e-video-${id}`;
    draftSlug = `e2e-video-draft-${id}`;
    // ตอน 1 มีไฟล์, ตอน 2 ยังไม่มีไฟล์
    keys = (await createVideoFixture({ slug, episodes: 2, withFile: 1 })).keys;
    await createVideoFixture({ slug: draftSlug, episodes: 1, episodeStatus: "draft" });
  });
  test.afterEach(async () => {
    await deleteVideoFixture(slug);
    await deleteVideoFixture(draftSlug);
  });

  test("หน้าเรื่องมีปุ่มเริ่มดู และตัวเล่นโหลดวิดีโอได้", async ({ page, browserName }) => {
    await page.goto(`/title/${slug}`);
    await page.getByRole("link", { name: /เริ่มดู ตอนที่ 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/read/${slug}/1$`));
    const video = page.locator("article video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/video\//);
    // WebKit ของ Playwright เล่น WebM ไม่ได้ → เช็กการโหลดจริงเฉพาะ Chromium/Firefox
    if (browserName !== "webkit") {
      await expect
        .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState), { timeout: 15_000 })
        .toBeGreaterThanOrEqual(1);
    }
    await expect(page.getByRole("link", { name: /ตอนถัดไป/ })).toBeVisible();
  });

  test("ตอนที่ยังไม่มีไฟล์: บอกว่ายังไม่พร้อมให้ดู ไม่มีตัวเล่น", async ({ page }) => {
    await page.goto(`/read/${slug}/2`);
    await expect(page.getByText("ยังไม่พร้อมให้ดู")).toBeVisible();
    await expect(page.locator("article video")).toHaveCount(0);
  });

  test("ไฟล์ไม่ได้เปิดสาธารณะ: URL สาธารณะใช้ไม่ได้", async ({ request }) => {
    const res = await request.get(`${SUPABASE_URL}/storage/v1/object/public/video/${keys[0]}`);
    expect(res.ok()).toBe(false);
  });

  test("ตอนที่ยังเป็นฉบับร่าง: ผู้ดูเข้าไม่ได้", async ({ page }) => {
    await page.goto(`/read/${draftSlug}/1`);
    await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
    await expect(page.locator("article video")).toHaveCount(0);
  });
});
