import { expect, test } from "@playwright/test";
import {
  admin,
  callbackUrl,
  createTestUser,
  deleteTitleBySlug,
  deleteUser,
  hasAdmin,
  makeAdmin,
  revalidateCatalog,
  type TestUser,
} from "./helpers/supabase";

// ต่อ Supabase จริง + ใช้โควตายืนยันลิงก์ 1 ครั้ง → desktop เท่านั้น
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("ตัวเขียนตอนนิยาย (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  let slug = "";
  let titleId = "";

  test.beforeEach(async () => {
    user = await createTestUser();
    await makeAdmin(user.id);
    slug = `e2e-editor-${Math.random().toString(36).slice(2, 8)}`;
    const t = await admin()
      .from("titles")
      .insert({ slug, name: "นิยายตัวเขียนทดสอบ", type: "novel", published: false })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    titleId = t.data!.id;
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteTitleBySlug(slug);
    await deleteUser(user.id);
  });

  const episodes = async () =>
    (
      await admin()
        .from("episodes")
        .select("number, name, status, access, novel_bodies(body_markdown)")
        .eq("title_id", titleId)
        .order("number", { ascending: true })
    ).data ?? [];

  test("วางข้อความ → จัดย่อหน้า + ตัวนับ → บันทึกแล้วไปตอนถัดไป (จำสถานะ/สิทธิ์) → ตอนก่อน/ถัดไป → ตัวอย่าง", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/episodes/new`));
    await expect(page.getByRole("heading", { name: "เพิ่มตอนใหม่" })).toBeVisible();

    // วางข้อความ "หนึ่งบรรทัดต่อหนึ่งย่อหน้า" (ไม่มีบรรทัดว่างคั่น) แล้วกดจัดย่อหน้า
    const body = page.getByLabel("เนื้อหา (ภาษาไทย ต้นฉบับ)");
    await body.fill("ย่อหน้าแรก\nย่อหน้าที่สอง\nย่อหน้าที่สาม");
    await expect(page.getByText(/\d+ ตัวอักษร · \d+ คำ/).first()).toBeVisible();
    await expect(async () => {
      await page.getByRole("button", { name: "จัดย่อหน้าอัตโนมัติ" }).first().click();
      await expect(body).toHaveValue("ย่อหน้าแรก\n\nย่อหน้าที่สอง\n\nย่อหน้าที่สาม", { timeout: 800 });
    }).toPass({ timeout: 10_000 });

    await page.getByLabel("ชื่อตอน").fill("ตอนที่ 1 เริ่มต้น");
    await page.getByLabel("สถานะ").selectOption("published");
    await page.getByLabel("สิทธิ์การอ่าน").selectOption("free");
    await page.getByRole("button", { name: "บันทึกแล้วเพิ่มตอนถัดไป" }).click();

    // ไปหน้าเพิ่มตอนถัดไป: เลขต่อให้ ถือสถานะ/สิทธิ์ไปด้วย
    await expect(page).toHaveURL(/\/episodes\/new\?saved=1/);
    await expect(page.getByText("บันทึกตอนก่อนหน้าแล้ว")).toBeVisible();
    await expect(page.getByLabel("เลขตอน")).toHaveValue("2");
    await expect(page.getByLabel("สถานะ")).toHaveValue("published");
    await expect(page.getByLabel("สิทธิ์การอ่าน")).toHaveValue("free");

    let eps = await episodes();
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({
      number: 1,
      name: "ตอนที่ 1 เริ่มต้น",
      status: "published",
      access: "free",
    });
    expect((eps[0].novel_bodies as unknown as { body_markdown: string }).body_markdown).toBe(
      "ย่อหน้าแรก\n\nย่อหน้าที่สอง\n\nย่อหน้าที่สาม",
    );

    // ตอน 2: บันทึกแบบปกติ → กลับหน้าเรื่อง
    await page.getByLabel("ชื่อตอน").fill("ตอนที่ 2 ต่อมา");
    await page.getByLabel("เนื้อหา (ภาษาไทย ต้นฉบับ)").fill("เนื้อหาตอนสอง");
    await page.getByRole("button", { name: "เพิ่มตอน", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/titles/${titleId}\\?saved=1`));
    eps = await episodes();
    expect(eps.map((e) => e.number)).toEqual([1, 2]);

    // หน้าแก้ตอน 1: มีลิงก์ตอนถัดไป ไม่มีตอนก่อนหน้า → ไปตอน 2 ได้ → มีตอนก่อนหน้า
    await page.goto(`/admin/titles/${titleId}/episodes/1`);
    await expect(page.getByRole("link", { name: /ตอนที่ 2 →/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /← ตอนที่/ })).toHaveCount(0);
    await page.getByRole("link", { name: /ตอนที่ 2 →/ }).click();
    await expect(page.getByRole("link", { name: /← ตอนที่ 1/ })).toBeVisible();

    // ตัวอย่างแบบตัวอ่านจริง: เห็นเนื้อหา (แม้เรื่องยังไม่เผยแพร่) พร้อมป้ายและลิงก์ไปตอนอื่น
    await page.goto(`/admin/titles/${titleId}/episodes/1/preview`);
    await expect(page.getByRole("heading", { name: "ตอนที่ 1 เริ่มต้น" })).toBeVisible();
    await expect(page.getByText("ย่อหน้าที่สอง")).toBeVisible();
    await expect(page.getByText(/ตัวอย่างสำหรับแอดมิน/)).toBeVisible();
    await page.getByRole("link", { name: /ตอนที่ 2 →/ }).click();
    await expect(page.getByText("เนื้อหาตอนสอง")).toBeVisible();
  });

  test("ตอนที่พิมพ์ผ่านฟอร์มแสดงเป็นย่อหน้าแยกกันในตัวอ่าน (กันบั๊กขึ้นบรรทัดแบบ CRLF)", async ({ page }) => {
    test.setTimeout(90_000);
    await admin().from("titles").update({ published: true }).eq("id", titleId);
    await revalidateCatalog();
    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/episodes/new`));
    await page.getByLabel("ชื่อตอน").fill("ตอนทดสอบย่อหน้า");
    await page.getByLabel("เนื้อหา (ภาษาไทย ต้นฉบับ)").fill("ย่อหน้าหนึ่ง\n\nย่อหน้าสอง\n\nย่อหน้าสาม");
    await page.getByLabel("สถานะ").selectOption("published");
    await page.getByRole("button", { name: "เพิ่มตอน", exact: true }).click();
    await expect(page).toHaveURL(/saved=1/);

    // ในฐานข้อมูลไม่มี CR ตกค้าง
    const stored = (await episodes())[0].novel_bodies as unknown as { body_markdown: string };
    expect(stored.body_markdown).not.toContain(String.fromCharCode(13));
    expect(stored.body_markdown).toBe("ย่อหน้าหนึ่ง\n\nย่อหน้าสอง\n\nย่อหน้าสาม");

    // ผู้ชมที่ไม่ล็อกอิน เห็นเป็น 3 ย่อหน้า (ไม่ใช่ย่อหน้าเดียว)
    await page.context().clearCookies();
    await page.goto(`/read/${slug}/1`);
    await expect(page.locator("article div[lang=th] p")).toHaveCount(3);
  });

  test("ตัวอย่างตอน: ผู้ที่ไม่ล็อกอินเข้าไม่ได้ และตอนที่ไม่มีอยู่ได้หน้าไม่พบ", async ({ page }) => {
    await admin()
      .from("episodes")
      .insert({ title_id: titleId, number: 1, name: "ลับ", status: "draft" });
    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/episodes/99/preview`));
    await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();

    await page.context().clearCookies();
    await page.goto(`/admin/titles/${titleId}/episodes/1/preview`);
    await expect(page).toHaveURL(/\/login/);
  });
});
