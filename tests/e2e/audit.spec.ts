import { expect, test } from "@playwright/test";
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

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("ประวัติการใช้งานหลังบ้าน (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-audit-${Math.random().toString(36).slice(2, 8)}`;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteTitleBySlug(slug);
    await deleteUser(user.id);
  });

  test("ส่งออกนิยาย → มีบันทึกในประวัติ (ลงชื่อแอดมิน) และเห็นในหน้า /admin/audit; ผู้ใช้ทั่วไปเข้าไม่ได้", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await makeAdmin(user.id);
    const t = await admin()
      .from("titles")
      .insert({ slug, name: "นิยายประวัติ", type: "novel", published: true })
      .select("id")
      .single();
    expect(t.error).toBeNull();

    await page.goto(callbackUrl(user, "/admin"));
    await expect(page.getByRole("heading", { name: "เรื่องทั้งหมด" })).toBeVisible();
    const res = await page.request.get(`/admin/titles/${t.data!.id}/export?format=md`);
    expect(res.status()).toBe(200);

    const rows = (
      await admin()
        .from("admin_audit_log")
        .select("action, target, admin_id, admin_email, detail")
        .eq("admin_id", user.id)
    ).data!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "export.title",
      target: t.data!.id,
      admin_email: user.email,
    });

    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "ประวัติการใช้งานหลังบ้าน" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "export.title" }).first()).toBeVisible();

    // ผู้เยี่ยมชมที่ไม่ล็อกอินเข้าหน้านี้ไม่ได้
    const anon = await request.get("/admin/audit", { maxRedirects: 0 });
    expect([302, 307, 404]).toContain(anon.status());
  });
});
