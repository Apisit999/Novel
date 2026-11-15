import { expect, test } from "@playwright/test";
import { createMangaFixture, deleteMangaFixture } from "./helpers/manga";
import { hasAdmin, SUPABASE_URL } from "./helpers/supabase";

// ใช้ฐานข้อมูล+Storage จริง → ข้ามถ้าไม่มี service role key; ทดสอบทุกขนาดจอ (ตัวอ่านต้องใช้ได้บนมือถือ)
test.describe("ตัวอ่านมังงะ (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");

  let slug: string;
  let draftSlug: string;
  let firstKey: string;

  test.beforeEach(async ({}, info) => {
    const id = `${info.project.name}-${Math.random().toString(36).slice(2, 7)}`;
    slug = `e2e-manga-${id}`;
    draftSlug = `e2e-manga-draft-${id}`;
    const fx = await createMangaFixture({ slug, pages: 3 });
    await createMangaFixture({ slug: draftSlug, pages: 1, episodeStatus: "draft" });
    firstKey = fx.keys[0];
  });
  test.afterEach(async () => {
    await deleteMangaFixture(slug);
    await deleteMangaFixture(draftSlug);
  });

  test("ผู้เยี่ยมชมอ่านโหมดเลื่อนลง: รูปทุกหน้าโหลดได้ ไม่มีแถบเลื่อนแนวนอน", async ({ page }) => {
    await page.goto(`/read/${slug}/1`);
    const imgs = page.locator("article img");
    await expect(imgs).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await imgs.nth(i).scrollIntoViewIfNeeded();
      await expect
        .poll(() => imgs.nth(i).evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("progressbar")).toBeVisible();
  });

  test("ปุ่มซูม: ซูมเข้าแล้วภาพกว้างขึ้น ซูมออกกลับ 100% และปุ่มหมดช่วงถูกปิด", async ({ page }) => {
    await page.goto(`/read/${slug}/1`);
    const img = page.locator("article img").first();
    const zoomOut = page.getByRole("button", { name: "ซูมออก" });
    const zoomIn = page.getByRole("button", { name: "ซูมเข้า" });
    await expect(zoomOut).toBeDisabled();
    const w1 = (await img.boundingBox())!.width;
    await zoomIn.click();
    await expect(page.getByText("150%")).toBeVisible();
    await expect.poll(async () => (await img.boundingBox())!.width).toBeGreaterThan(w1 * 1.4);
    await zoomOut.click();
    await expect(page.getByText("100%")).toBeVisible();
    await expect.poll(async () => (await img.boundingBox())!.width).toBeCloseTo(w1, -1);
  });

  test("โหมดพลิกหน้า: นับหน้า กดถัดไป/ลูกศร แล้วจำโหมดที่เลือก", async ({ page }) => {
    await page.goto(`/read/${slug}/1`);
    await page.getByRole("button", { name: "พลิกหน้า" }).click();
    await expect(page.getByText("หน้า 1 / 3")).toBeVisible();
    await page.getByRole("button", { name: "หน้าถัดไป" }).click();
    await expect(page.getByText("หน้า 2 / 3")).toBeVisible();
    await expect(page.locator("article img")).toHaveCount(1);

    await page.reload();
    await expect(page.getByText(/หน้า \d \/ 3/)).toBeVisible(); // จำโหมดไว้
  });

  test("รูปไม่ได้เปิดสาธารณะ: URL สาธารณะของไฟล์ใช้ไม่ได้ มีแต่ลิงก์ที่ออกให้", async ({ page, request }) => {
    expect(SUPABASE_URL.startsWith("http")).toBe(true); // กันเทสต์ผ่านลอย ๆ เพราะไม่ได้ตั้งที่อยู่ (ใน CI เป็น Supabase ในเครื่อง)
    const direct = await request.get(`${SUPABASE_URL}/storage/v1/object/public/manga/${firstKey}`);
    // บัคเก็ตส่วนตัว: ไม่มี URL สาธารณะ — คลาวด์ตอบ 400 "Bucket not found", Supabase ในเครื่องอาจตอบ 404
    expect(direct.status()).toBeGreaterThanOrEqual(400);
    expect(direct.status()).toBeLessThan(500);

    await page.goto(`/read/${slug}/1`);
    const src = await page.locator("article img").first().getAttribute("src");
    expect(src).toContain("/object/sign/manga/"); // ลิงก์แบบมีลายเซ็นและวันหมดอายุ
    expect(src).toContain("token=");
  });

  test("ตอนที่ยังเป็นฉบับร่าง: ผู้อ่านเข้าไม่ได้ และเข้าถึงรูปไม่ได้", async ({ page }) => {
    await page.goto(`/read/${draftSlug}/1`);
    await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
    await expect(page.locator("article img")).toHaveCount(0);
  });
});
