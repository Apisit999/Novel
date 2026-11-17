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
  type TestUser,
} from "./helpers/supabase";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("นำเข้าวิดีโอเป็นชุด (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-videoimport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

  test("เลือกหลายไฟล์ → สร้างตอน+อัปโหลด (เรียงตามเลขในชื่อ) → เลขซ้ำถูกข้าม", async ({ page }) => {
    test.setTimeout(120_000);
    await makeAdmin(user.id);
    const db = admin();
    const title = await db
      .from("titles")
      .insert({ slug, name: "วิดีโอนำเข้าชุด", type: "video", published: true })
      .select("id")
      .single();
    expect(title.error).toBeNull();
    const titleId = title.data!.id;
    await db
      .from("episodes")
      .insert({ title_id: titleId, number: 2, name: "ตอนเดิม", status: "draft" });

    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/import`));
    const file = (name: string) => ({ name, mimeType: "video/webm", buffer: webm });
    await page
      .getByLabel(/เลือกไฟล์วิดีโอหลายไฟล์/)
      .setInputFiles([file("ep10.webm"), file("ep2.webm"), file("ep1.webm")]);
    await expect(page.getByText("เลขนี้มีอยู่แล้ว — จะถูกข้าม")).toBeVisible();
    await page.getByRole("button", { name: "นำเข้า 3 ตอน" }).click();
    await expect(page.getByText("นำเข้าเสร็จทั้งหมด")).toBeVisible({ timeout: 90_000 });

    const eps = (
      await db
        .from("episodes")
        .select("id, number, name, status")
        .eq("title_id", titleId)
        .order("number", { ascending: true })
    ).data!;
    expect(eps.map((e) => e.number)).toEqual([1, 2, 10]);
    expect(eps[0].name).toBe("ep1");
    expect(eps[1].name).toBe("ตอนเดิม"); // ไม่ถูกแตะ
    const assets = (
      await db
        .from("video_assets")
        .select("episode_id, ready")
        .in(
          "episode_id",
          eps.map((e) => e.id),
        )
    ).data!;
    expect(assets.map((a) => a.episode_id).sort()).toEqual([eps[0].id, eps[2].id].sort());
    expect(assets.every((a) => a.ready)).toBe(true);
  });
});
