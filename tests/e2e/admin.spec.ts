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

// ต่อ Supabase จริง + สร้างผู้ใช้จริง → โปรเจกต์ desktop เท่านั้น (ใช้โควตายืนยันลิงก์ 2 ครั้ง/รอบ)
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test("ยังไม่ล็อกอิน: /admin ถูกส่งไปหน้าเข้าสู่ระบบ (ไม่เห็นหลังบ้าน)", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin|\/login\?next=\/admin/);
  await expect(page.getByText("เรื่องทั้งหมด")).toHaveCount(0);
});

/** หน้า title/read เป็นแบบสตรีม รหัสตอบกลับจึงเป็น 200 — ตรวจว่าเป็นหน้า "ไม่พบ" และห้ามจัดทำดัชนี (noindex) */
async function expectNotFoundPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
}

test.describe("หลังบ้านกับ Supabase จริง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-admin-${Date.now().toString(36)}`;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return; // เทสต์ที่ถูกข้ามไม่เคยสร้างอะไร
    created = false;
    await deleteTitleBySlug(slug);
    await deleteUser(user.id);
  });

  test("ผู้ใช้ทั่วไปเข้าหลังบ้านไม่ได้ (404) ทุกหน้า", async ({ page }) => {
    await page.goto(callbackUrl(user, "/"));
    for (const path of ["/admin", "/admin/titles/new"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
      await expect(page.getByRole("button", { name: "สร้างเรื่อง" })).toHaveCount(0);
    }
  });

  test("แอดมินลงเรื่อง ตอน คำแปล และตั้งเวลาเผยแพร่ → ผู้อ่านเห็นถูกต้อง → ลบได้", async ({ page }) => {
    test.setTimeout(120_000); // ครบวงจรหลายสิบขั้น แต่ละ action ใช้หลายวินาทีจริง
    await makeAdmin(user.id);
    await page.goto(callbackUrl(user, "/admin"));
    await expect(page.getByRole("heading", { name: "เรื่องทั้งหมด" })).toBeVisible();

    // --- สร้างเรื่อง (เผยแพร่)
    await page.getByRole("link", { name: "+ เรื่องใหม่" }).first().click();
    await page.getByLabel("ชื่อเรื่อง", { exact: true }).fill("เรื่องทดสอบแอดมิน");
    await page.getByLabel("slug (ใช้ใน URL)").fill("Bad Slug");
    await page.getByLabel("เรื่องย่อ").fill("เรื่องย่อที่แอดมินกรอก");
    await page.getByLabel("แท็ก").fill("ทดสอบ, แอดมิน");
    await page.getByRole("checkbox", { name: /เผยแพร่เรื่องนี้/ }).check();
    await page.getByRole("button", { name: "สร้างเรื่อง" }).click();
    // slug ผิดรูปแบบ → แจ้งข้อผิดพลาด ไม่สร้าง
    await expect(page.getByText("ใช้ได้เฉพาะ a-z")).toBeVisible();
    await page.getByLabel("slug (ใช้ใน URL)").fill(slug);
    await page.getByRole("button", { name: "สร้างเรื่อง" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await expect(page.getByRole("heading", { name: /แก้ไข: เรื่องทดสอบแอดมิน/ })).toBeVisible();

    // --- ผู้อ่านเห็นเรื่องใหม่ทันที (แคชถูกเคลียร์)
    await page.goto(`/title/${slug}`);
    await expect(page.getByRole("heading", { name: "เรื่องทดสอบแอดมิน" })).toBeVisible();
    await expect(page.getByText("เรื่องย่อที่แอดมินกรอก")).toBeVisible();
    await page.goto("/browse/novel");
    await expect(page.getByRole("link", { name: /เรื่องทดสอบแอดมิน/ })).toBeVisible();

    // --- เพิ่มตอน 1: เผยแพร่ทันที + แปลอังกฤษ
    await page.goto("/admin");
    await page.getByRole("link", { name: /เรื่องทดสอบแอดมิน/ }).click();
    await page.getByRole("link", { name: "+ เพิ่มตอน" }).click();
    await page.getByLabel("ชื่อตอน").fill("ตอนแรกจากแอดมิน");
    await page.getByLabel("สถานะ", { exact: true }).selectOption({ label: "เผยแพร่ทันที" });
    await page.getByLabel("เนื้อหา (ภาษาไทย ต้นฉบับ)").fill("ย่อหน้าแรกของตอน\n\nย่อหน้าที่สอง **ตัวหนา**");
    await page.getByLabel("English", { exact: true }).fill("First paragraph of the episode");
    await page.getByRole("button", { name: "เพิ่มตอน", exact: true }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await expect(page.getByRole("link", { name: /1\. ตอนแรกจากแอดมิน/ })).toBeVisible();

    await page.goto(`/read/${slug}/1`);
    await expect(page.getByText("ย่อหน้าแรกของตอน")).toBeVisible();
    await expect(page.locator("strong", { hasText: "ตัวหนา" })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByText("First paragraph of the episode")).toBeVisible();
    // ไม่ได้กรอกภาษาจีน → ไม่มีปุ่มภาษาจีน
    await expect(page.getByRole("button", { name: "中文" })).toHaveCount(0);

    // --- ตอน 2: ตั้งเวลาอนาคต (ผู้อ่านต้องไม่เห็น) / ตอน 3: ตั้งเวลาอดีต (ต้องเห็น)
    for (const [n, name, when] of [
      [2, "ตอนตั้งเวลาอนาคต", "2099-01-01T09:00"],
      [3, "ตอนตั้งเวลาที่เลยมาแล้ว", "2020-01-01T09:00"],
    ] as const) {
      await page.goto("/admin");
      await page.getByRole("link", { name: /เรื่องทดสอบแอดมิน/ }).click();
      await page.getByRole("link", { name: "+ เพิ่มตอน" }).click();
      await page.getByLabel("ชื่อตอน").fill(name);
      await page.getByLabel("สถานะ", { exact: true }).selectOption({ label: "ตั้งเวลาเผยแพร่" });
      await page.getByLabel("วันและเวลาเผยแพร่ (เวลาไทย)").fill(when);
      await page.getByLabel("เนื้อหา (ภาษาไทย ต้นฉบับ)").fill(`เนื้อหาตอน ${n}`);
      await page.getByRole("button", { name: "เพิ่มตอน", exact: true }).click();
      await expect(page.getByRole("link", { name: new RegExp(`${n}\\. ${name}`) })).toBeVisible();
    }
    await page.goto(`/title/${slug}`);
    await expect(page.getByRole("link", { name: "ตอนแรกจากแอดมิน" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ตอนตั้งเวลาที่เลยมาแล้ว" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ตอนตั้งเวลาอนาคต" })).toHaveCount(0);
    await expectNotFoundPage(page, `/read/${slug}/2`);

    // --- ตัวอย่าง Markdown ในหลังบ้าน
    await page.goto("/admin");
    await page.getByRole("link", { name: /เรื่องทดสอบแอดมิน/ }).click();
    await page.getByRole("link", { name: /1\. ตอนแรกจากแอดมิน/ }).click();
    await page.getByRole("button", { name: "ดูตัวอย่าง" }).first().click();
    await expect(page.locator("strong", { hasText: "ตัวหนา" })).toBeVisible();

    // --- ยกเลิกเผยแพร่เรื่อง → ผู้อ่านไม่เห็น
    await page.goto("/admin");
    await page.getByRole("link", { name: /เรื่องทดสอบแอดมิน/ }).click();
    await page.getByRole("checkbox", { name: /เผยแพร่เรื่องนี้/ }).uncheck();
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).first().click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await expectNotFoundPage(page, `/title/${slug}`);

    // --- ลบเรื่อง → หายจากฐานข้อมูล (ตอนและเนื้อหาหายตาม)
    await page.goto("/admin");
    await page.getByRole("link", { name: /เรื่องทดสอบแอดมิน/ }).click();
    await page.getByText("ลบเรื่องนี้").click();
    await page.getByRole("button", { name: /ยืนยันลบเรื่อง/ }).click();
    await expect(page).toHaveURL(/\/admin\?deleted=1/);
    const left = await admin().from("titles").select("id").eq("slug", slug);
    expect(left.data).toHaveLength(0);
  });
});
