import { expect, test } from "@playwright/test";
import {
  admin,
  callbackUrl,
  createTestUser,
  deleteUser,
  hasAdmin,
  type TestUser,
} from "./helpers/supabase";

// หมายเหตุโควตา: Supabase จำกัดการยืนยันลิงก์ 30 ครั้ง/5 นาที/IP (rate_limit_verify) ไฟล์นี้ใช้ ~5 ครั้งต่อรอบ
// → อย่ารันวนติดกันเกิน ~5 รอบใน 5 นาที ถ้าเจอ `429 over_request_rate_limit` ใน log เซิร์ฟเวอร์ให้รอสักครู่
//
// ต่อฐานข้อมูลจริงและสร้างผู้ใช้จริง → รันแค่โปรเจกต์เดียว (พฤติกรรมไม่ขึ้นกับขนาดจอ) และข้ามถ้าไม่มี service key
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "ระบบบัญชีทดสอบบนจอคอมอย่างเดียว");
});

test("หน้าเข้าสู่ระบบ: ปุ่ม Google เป็นทางหลัก ช่องอีเมลปิดอยู่ (EMAIL_LOGIN_ENABLED=false)", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" })).toBeVisible();
  await expect(page.getByLabel("อีเมล")).toHaveCount(0);
  await expect(page.getByText("เราใช้บัญชี Google เพื่อยืนยันตัวตนเท่านั้น")).toBeVisible();
});

test("ลิงก์ที่ไม่ถูกต้อง และการกดยกเลิกที่หน้า Google แสดงข้อความที่เหมาะสม", async ({ page }) => {
  await page.goto("/auth/callback?code=not-a-real-code");
  await expect(page).toHaveURL(/\/login\?error=1/);
  await expect(page.getByText("ไม่ถูกต้องหรือหมดอายุ")).toBeVisible();

  // Google ส่ง ?error=access_denied กลับมาเมื่อผู้ใช้กดยกเลิก
  await page.goto("/auth/callback?error=access_denied&error_description=User+denied");
  await expect(page).toHaveURL(/\/login\?error=denied/);
  await expect(page.getByText("คุณยกเลิกการเข้าสู่ระบบ")).toBeVisible();
  await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" })).toBeVisible();
});

test("กดปุ่ม Google: ไปหน้าของ Google ถ้าตั้งค่าแล้ว ไม่งั้นแสดงข้อความที่เป็นมิตร (ไม่ใช่ JSON ดิบ)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" }).click();
  await page.waitForURL(/accounts\.google\.com|\/login\?error=provider/, { timeout: 15_000 });
  if (page.url().includes("accounts.google.com")) {
    // ตั้งค่า Google ครบแล้ว: ต้องเป็นหน้าเลือกบัญชีของ Google และกลับมาที่ callback ของเรา
    expect(decodeURIComponent(page.url())).toContain("/auth/callback");
  } else {
    await expect(page.getByText("ยังเข้าสู่ระบบด้วย Google ไม่ได้")).toBeVisible();
  }
});

test("ไม่ล็อกอิน: /account พาไปหน้าเข้าสู่ระบบ", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
});

test.describe("ล็อกอินจริง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (created) await deleteUser(user.id); // เทสต์ที่ถูกข้ามไม่เคยสร้างผู้ใช้
    created = false;
  });

  test("ลิงก์ในอีเมลสร้างเซสชัน: เห็นอีเมลในหน้าบัญชี และออกจากระบบได้", async ({ page }) => {
    await page.goto(callbackUrl(user, "/account"));
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole("link", { name: "บัญชีของฉัน" })).toBeVisible();

    // รีโหลดแล้วยังล็อกอินอยู่ (cookie เซสชันใช้ได้จริง)
    await page.reload();
    await expect(page.getByText(user.email)).toBeVisible();

    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "เข้าสู่ระบบ" })).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("ลิงก์ใช้ซ้ำไม่ได้ และ next ภายนอกถูกปฏิเสธ (กัน open redirect)", async ({ page }) => {
    await page.goto(callbackUrl(user, "//evil.example.com"));
    // ล็อกอินสำเร็จ แต่ไม่ถูกพาออกนอกเว็บ → ตกที่ค่า fallback ภายในเว็บ
    await expect(page).toHaveURL(/localhost:\d+\/library$/);

    const second = await page.context().browser()!.newContext();
    const page2 = await second.newPage();
    await page2.goto(new URL(callbackUrl(user), page.url()).toString());
    await expect(page2).toHaveURL(/\/login\?error=1/);
    await second.close();
  });

  test("ซิงก์ห้องสมุด: ของในเครื่องขึ้นบัญชี, กด/เอาออกบันทึกตามจริง, ออกจากระบบแล้วเครื่องถูกล้าง", async ({
    page,
  }) => {
    // ของในเครื่องก่อนล็อกอิน: ชอบ 1 เรื่อง + อ่านค้างตอน 2
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "aandoo:library:v1",
        JSON.stringify({
          favorites: ["moonlit-garden"],
          progress: { "moonlit-garden": { number: 2, percent: 40, updatedAt: Date.now() } },
        }),
      ),
    );

    await page.goto(callbackUrl(user, "/library"));
    await expect(page.getByRole("link", { name: /สวนใต้แสงจันทร์/ }).first()).toBeVisible();

    const db = admin();
    await expect
      .poll(
        async () =>
          (await db.from("bookmarks").select("title_id").eq("user_id", user.id)).data?.length,
        {
          timeout: 15_000,
        },
      )
      .toBe(1);
    // ส่งรายการโปรดก่อน แล้วจึงส่งความคืบหน้า → ต้องรอจนความคืบหน้าถึงด้วย
    await expect
      .poll(
        async () => {
          const r = await db.from("progress").select("position").eq("user_id", user.id);
          return r.data?.map((x) => Number(x.position));
        },
        { timeout: 15_000 },
      )
      .toEqual([40]);

    // เอาออกจากเรื่องที่ชอบผ่านหน้าเรื่อง → แถวบนเซิร์ฟเวอร์หายตาม
    await page.goto("/title/moonlit-garden");
    await page.getByRole("button", { name: /อยู่ในเรื่องที่ชอบ/ }).click();
    await expect
      .poll(
        async () =>
          (await db.from("bookmarks").select("title_id").eq("user_id", user.id)).data?.length,
        {
          timeout: 15_000,
        },
      )
      .toBe(0);

    // ออกจากระบบ → แคชในเครื่องถูกล้าง (เครื่องที่ใช้ร่วมกันไม่เห็นของคนก่อน)
    await page.goto("/account");
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("aandoo:library:v1")), {
        timeout: 10_000,
      })
      .toContain('"favorites":[]');
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("aandoo:library:v1") ?? "{}").progress),
      )
      .toEqual({});
  });

  test("ลบบัญชี: ต้องติ๊กยืนยัน, ลบแล้วบัญชีและข้อมูลหายหมด", async ({ page }) => {
    await page.goto(callbackUrl(user, "/title/moonlit-garden"));
    // กดชอบเพื่อให้มีข้อมูลผูกกับบัญชี
    await expect(async () => {
      await page.getByRole("button", { name: "เพิ่มในเรื่องที่ชอบ" }).click();
      await expect(page.getByRole("button", { name: /อยู่ในเรื่องที่ชอบ/ })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });
    const db = admin();
    await expect
      .poll(
        async () =>
          (await db.from("bookmarks").select("title_id").eq("user_id", user.id)).data?.length,
        {
          timeout: 15_000,
        },
      )
      .toBe(1);

    await page.goto("/account");
    await page.getByRole("button", { name: "ลบบัญชีของฉัน" }).click(); // ไม่ติ๊ก → ไม่ลบ
    await expect(page.getByText("กรุณาติ๊กยืนยัน")).toBeVisible();
    expect((await db.auth.admin.getUserById(user.id)).data.user).not.toBeNull();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "ลบบัญชีของฉัน" }).click();
    await expect(page).toHaveURL(/\/\?deleted=1/);

    expect((await db.auth.admin.getUserById(user.id)).data.user).toBeNull();
    expect(
      (await db.from("bookmarks").select("title_id").eq("user_id", user.id)).data,
    ).toHaveLength(0);
    expect((await db.from("profiles").select("id").eq("id", user.id)).data).toHaveLength(0);
  });
});
