import { expect, test } from "@playwright/test";
import { deleteMangaFixture, listStoredFiles } from "./helpers/manga";
import { solidPng } from "./helpers/png";
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

test.describe("หลังบ้านมังงะ: อัปโหลดหน้า (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-adminmanga-${Date.now().toString(36)}`;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteMangaFixture(slug);
    await deleteUser(user.id);
  });

  test("อัปโหลดหลายไฟล์ (เรียงตามเลขในชื่อ) → เลื่อน/ลบหน้า → ลบตอนแล้วไม่มีไฟล์ค้าง", async ({ page }) => {
    test.setTimeout(120_000);
    await makeAdmin(user.id);

    // เตรียมเรื่อง + ตอน (ยังไม่มีหน้า)
    const db = admin();
    const title = await db
      .from("titles")
      .insert({ slug, name: "มังงะอัปโหลดทดสอบ", type: "manga", published: true })
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

    await revalidateCatalog(); // เขียนตรงด้วย service role → ต้องเคลียร์แคชเอง

    const pagesOf = async () =>
      (
        await db
          .from("manga_pages")
          .select("page_no, image_key, width, height")
          .eq("episode_id", ep.data!.id)
          .order("page_no", { ascending: true })
      ).data ?? [];

    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/episodes/1`));
    await expect(page.getByRole("heading", { name: /หน้าของตอน \(0\)/ })).toBeVisible();

    // ตั้งใจเลือกสลับลำดับ: page-10, page-2, page-1 (ความสูงต่างกันเพื่อตรวจลำดับ)
    await page.getByLabel(/เพิ่มหน้า/).setInputFiles([
      { name: "page-10.png", mimeType: "image/png", buffer: solidPng(800, 1200, [200, 60, 60]) },
      { name: "page-2.png", mimeType: "image/png", buffer: solidPng(800, 1100, [60, 200, 60]) },
      { name: "page-1.png", mimeType: "image/png", buffer: solidPng(800, 1000, [60, 60, 200]) },
    ]);
    await expect(page.getByText("อัปโหลดเสร็จ 3 หน้า")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /หน้าของตอน \(3\)/ })).toBeVisible();

    // เรียงตามเลขในชื่อไฟล์ (1, 2, 10) ไม่ใช่ตามตัวอักษร (1, 10, 2) → ความสูง 1000, 1100, 1200
    const rows = await pagesOf();
    expect(rows.map((r) => r.page_no)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.height)).toEqual([1000, 1100, 1200]);
    expect(rows.every((r) => r.width === 800)).toBe(true);
    expect(rows.every((r) => r.image_key.startsWith(`${titleId}/${ep.data!.id}/`))).toBe(true);
    expect(rows.every((r) => r.image_key.endsWith(".webp"))).toBe(true); // แปลงเป็น WebP ในเบราว์เซอร์แล้ว
    expect(await listStoredFiles(titleId)).toHaveLength(3);

    // เลื่อนหน้า 3 ขึ้น → ลำดับความสูงเป็น 1000, 1200, 1100
    await page.getByRole("button", { name: "เลื่อนหน้า 3 ขึ้น" }).click();
    await expect
      .poll(async () => (await pagesOf()).map((r) => r.height), { timeout: 15_000 })
      .toEqual([1000, 1200, 1100]);

    // ลบหน้า 1 → เลขหน้าเลื่อนมาต่อเนื่อง (1, 2) และไฟล์ถูกลบด้วย
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "ลบหน้า 1" }).click();
    await expect
      .poll(async () => (await pagesOf()).map((r) => [r.page_no, r.height]), { timeout: 15_000 })
      .toEqual([
        [1, 1200],
        [2, 1100],
      ]);
    await expect.poll(() => listStoredFiles(titleId), { timeout: 15_000 }).toHaveLength(2);

    // ผู้อ่านเห็นรูปที่เหลือ (ตอนเผยแพร่แล้ว)
    await page.goto(`/read/${slug}/1`);
    await expect(page.locator("article img")).toHaveCount(2);

    // ลบทั้งตอน → ไม่มีแถว และไม่มีไฟล์ค้างใน Storage
    await page.goto(`/admin/titles/${titleId}/episodes/1`);
    await page.getByText("ลบตอนนี้").click();
    await page.getByRole("button", { name: /ยืนยันลบตอนที่ 1/ }).click();
    await expect(page).toHaveURL(/deleted=1/, { timeout: 20_000 });
    expect(await pagesOf()).toHaveLength(0);
    await expect.poll(() => listStoredFiles(titleId), { timeout: 15_000 }).toHaveLength(0);
  });
});
