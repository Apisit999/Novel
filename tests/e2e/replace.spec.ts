import { expect, test } from "@playwright/test";
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

test.describe("ค้นหา-แทนที่ทั้งเรื่อง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-replace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await admin().from("titles").delete().eq("slug", slug);
    await deleteUser(user.id);
  });

  test("ดูตัวอย่างจำนวนที่พบ → แทนที่ทุกตอน → ตอนที่ไม่มีคำนั้นไม่ถูกแตะ", async ({ page }) => {
    test.setTimeout(90_000);
    await makeAdmin(user.id);
    const db = admin();
    const title = await db
      .from("titles")
      .insert({ slug, name: "นิยายแทนที่", type: "novel", published: true })
      .select("id")
      .single();
    expect(title.error).toBeNull();
    const titleId = title.data!.id;

    const bodies = ["มินวิ่งไป มินหัวเราะ", "ไม่มีชื่อนั้นเลย", "เจอมินอีกครั้ง"];
    const ids: string[] = [];
    for (let i = 0; i < bodies.length; i++) {
      const ep = await db
        .from("episodes")
        .insert({ title_id: titleId, number: i + 1, name: `ตอน ${i + 1}`, status: "draft" })
        .select("id")
        .single();
      expect(ep.error).toBeNull();
      ids.push(ep.data!.id);
      const nb = await db
        .from("novel_bodies")
        .insert({ episode_id: ep.data!.id, body_markdown: bodies[i], word_count: 3 });
      expect(nb.error).toBeNull();
    }

    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/replace`));
    await page.getByLabel("คำที่ต้องการค้นหา").fill("มิน");
    await page.getByLabel(/แทนที่ด้วย/).fill("มิ้น");
    await page.getByRole("button", { name: "ดูตัวอย่างก่อน" }).click();
    await expect(page.getByText("พบ 3 จุด ใน 2 ตอน")).toBeVisible({ timeout: 30_000 });

    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "แทนที่ทั้งหมด" }).click();
    await expect(page.getByText("แทนที่แล้ว 3 จุดใน 2 ตอน")).toBeVisible({ timeout: 30_000 });

    const now = (
      await db.from("novel_bodies").select("episode_id, body_markdown").in("episode_id", ids)
    ).data!;
    const by = new Map(now.map((r) => [r.episode_id, r.body_markdown]));
    expect(by.get(ids[0])).toBe("มิ้นวิ่งไป มิ้นหัวเราะ");
    expect(by.get(ids[1])).toBe("ไม่มีชื่อนั้นเลย");
    expect(by.get(ids[2])).toBe("เจอมิ้นอีกครั้ง");
  });
});
