import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { deleteVideoFixture } from "./helpers/video";
import {
  admin,
  callbackUrl,
  createTestUser,
  deleteUser,
  hasAdmin,
  makeAdmin,
  revalidateCatalog,
  type TestUser,
} from "./helpers/supabase";

// ต่อ Supabase จริง + ใช้โควตายืนยันลิงก์ 1 ครั้ง → โปรเจกต์ desktop เท่านั้น
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("หลังบ้านวิดีโอ: อัปโหลดไฟล์ (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-adminvideo-${Date.now().toString(36)}`;
  const webm = readFileSync("tests/e2e/helpers/tiny.webm");

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteVideoFixture(slug);
    await deleteUser(user.id);
  });

  test("อัปโหลด → เปลี่ยนไฟล์ (ไฟล์เก่าถูกลบ) → ลบไฟล์ → ลบตอนแล้วไม่มีไฟล์ค้าง", async ({ page }) => {
    test.setTimeout(120_000);
    await makeAdmin(user.id);

    const db = admin();
    const title = await db
      .from("titles")
      .insert({ slug, name: "วิดีโออัปโหลดทดสอบ", type: "video", published: true })
      .select("id")
      .single();
    expect(title.error).toBeNull();
    const titleId = title.data!.id;
    const ep = await db
      .from("episodes")
      .insert({ title_id: titleId, number: 1, name: "ตอนที่ 1", status: "published" })
      .select("id")
      .single();
    expect(ep.error).toBeNull();
    const episodeId = ep.data!.id;
    await revalidateCatalog();

    const assetKey = async () =>
      (await db.from("video_assets").select("stream_uid").eq("episode_id", episodeId).maybeSingle())
        .data?.stream_uid;
    const storedFiles = async () =>
      ((await db.storage.from("video").list(`${titleId}/${episodeId}`)).data ?? []).map(
        (f) => f.name,
      );

    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/episodes/1`));
    await expect(page.getByText("ยังไม่มีไฟล์วิดีโอ")).toBeVisible();

    // 1) อัปโหลดครั้งแรก
    await page
      .getByLabel(/เลือกไฟล์วิดีโอ/)
      .setInputFiles({ name: "a.webm", mimeType: "video/webm", buffer: webm });
    await expect(page.getByText("อัปโหลดเสร็จแล้ว")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("main video")).toBeVisible();
    const first = await assetKey();
    expect(first).toBeTruthy();
    expect(await storedFiles()).toHaveLength(1);

    // 2) เปลี่ยนไฟล์ → คีย์ใหม่ และไฟล์เก่าต้องถูกลบ
    await page
      .getByLabel(/เปลี่ยนไฟล์วิดีโอ/)
      .setInputFiles({ name: "b.webm", mimeType: "video/webm", buffer: webm });
    await expect.poll(assetKey, { timeout: 60_000 }).not.toBe(first);
    await expect.poll(async () => (await storedFiles()).length).toBe(1);

    // 3) ไฟล์ผิดชนิด/ใหญ่เกิน ถูกปฏิเสธก่อนอัปโหลด
    await page
      .getByLabel(/เปลี่ยนไฟล์วิดีโอ/)
      .setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await expect(page.getByText("รองรับเฉพาะไฟล์ MP4 หรือ WebM")).toBeVisible();

    // 4) ลบไฟล์ → แถวและไฟล์หายหมด
    await page.getByRole("button", { name: "ลบไฟล์วิดีโอ" }).click();
    await expect(page.getByText("ยังไม่มีไฟล์วิดีโอ")).toBeVisible();
    expect(await assetKey()).toBeUndefined();
    expect(await storedFiles()).toHaveLength(0);

    // 5) อัปโหลดอีกครั้งแล้วลบทั้งตอน → ไม่มีไฟล์ค้างใน Storage
    await page
      .getByLabel(/เลือกไฟล์วิดีโอ/)
      .setInputFiles({ name: "c.webm", mimeType: "video/webm", buffer: webm });
    await expect(page.getByText("อัปโหลดเสร็จแล้ว")).toBeVisible({ timeout: 60_000 });
    expect(await storedFiles()).toHaveLength(1);
    await page.getByText("ลบตอนนี้").click();
    await page.getByRole("button", { name: /ยืนยันลบตอนที่ 1/ }).click();
    await expect(page).toHaveURL(/deleted=1/);
    expect(await storedFiles()).toHaveLength(0);
  });
});
