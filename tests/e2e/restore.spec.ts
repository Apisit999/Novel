import { expect, test } from "@playwright/test";
import JSZip from "jszip";
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

test.describe("กู้คืนจากไฟล์สำรอง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  const slug = `e2e-restore-${Math.random().toString(36).slice(2, 8)}`;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteTitleBySlug(slug);
    await admin().from("tags").delete().eq("slug", "e2e-กู้คืน");
    await deleteUser(user.id);
  });

  test("zip สำรอง → สร้างเรื่อง+ตอน+สถานะ/สิทธิ์/คำแปลกลับมา → กู้ซ้ำข้ามตอนที่มีอยู่", async ({ page }) => {
    test.setTimeout(120_000);
    await makeAdmin(user.id);

    const info = {
      exportedAt: new Date().toISOString(),
      title: {
        slug,
        name: "นิยายกู้คืน",
        author: "นักเขียน",
        synopsis: "เรื่องย่อกู้คืน",
        status: "completed",
        rating: "13",
        updateDay: 3,
        published: false,
        tags: ["e2e-กู้คืน"],
      },
      episodes: [
        {
          number: 1,
          name: "เริ่มต้น",
          status: "published",
          access: "free",
          publishAt: null,
          translations: [{ lang: "en", machine: true }],
        },
        {
          number: 2,
          name: "ตอนที่ 2 ลับ",
          status: "scheduled",
          access: "premium",
          publishAt: "2030-01-01T03:00:00.000Z",
          translations: [],
        },
      ],
    };
    const md =
      "# นิยายกู้คืน\n\nผู้แต่ง: นักเขียน\n\n\n# ตอนที่ 1 เริ่มต้น\n\nย่อหน้าหนึ่ง\n\nย่อหน้าสอง\n\n\n# ตอนที่ 2 ลับ\n\nเนื้อหาตอนสอง\n";
    const en = "# Restored\n\n\n# ตอนที่ 1 เริ่มต้น\n\nEnglish one\n";
    const zip = new JSZip();
    zip.file(`${slug}/novel.md`, md);
    zip.file(`${slug}/info.json`, JSON.stringify(info));
    zip.file(`${slug}/translations/en.md`, en);
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    await page.goto(callbackUrl(user, "/admin/restore"));
    const pick = () =>
      page
        .getByLabel(/เลือกไฟล์สำรอง/)
        .setInputFiles({ name: "backup.zip", mimeType: "application/zip", buffer });
    await pick();
    await expect(page.getByText("นิยายกู้คืน")).toBeVisible();
    await page.getByRole("button", { name: "กู้คืน 1 เรื่อง" }).click();
    await expect(page.getByText(/สร้างเรื่องใหม่ · กู้ 2 ตอน/)).toBeVisible({ timeout: 60_000 });

    const db = admin();
    const t = (
      await db
        .from("titles")
        .select("id, type, author, status, rating, update_day, published, title_tags(tags(name))")
        .eq("slug", slug)
        .single()
    ).data!;
    expect(t).toMatchObject({
      type: "novel",
      author: "นักเขียน",
      status: "completed",
      rating: "13",
      update_day: 3,
      published: false,
    });
    expect(JSON.stringify(t.title_tags)).toContain("e2e-กู้คืน");

    const eps = (
      await db
        .from("episodes")
        .select("id, number, name, status, access, publish_at")
        .eq("title_id", t.id)
        .order("number", { ascending: true })
    ).data!;
    expect(eps).toHaveLength(2);
    expect(eps[0]).toMatchObject({ name: "เริ่มต้น", status: "published", access: "free" });
    expect(eps[1]).toMatchObject({ status: "scheduled", access: "premium" });
    expect(new Date(eps[1].publish_at!).toISOString()).toBe("2030-01-01T03:00:00.000Z");

    const bodies = (
      await db
        .from("novel_bodies")
        .select("episode_id, body_markdown")
        .in(
          "episode_id",
          eps.map((e) => e.id),
        )
    ).data!;
    expect(bodies.find((b) => b.episode_id === eps[0].id)!.body_markdown).toBe(
      "ย่อหน้าหนึ่ง\n\nย่อหน้าสอง",
    );
    const tr = (
      await db
        .from("novel_translations")
        .select("lang, body_markdown, machine")
        .eq("episode_id", eps[0].id)
    ).data!;
    expect(tr).toEqual([{ lang: "en", body_markdown: "English one", machine: true }]);

    // กู้ซ้ำ: เรื่องมีอยู่แล้ว ตอนที่ซ้ำถูกข้าม ไม่สร้างซ้ำ/ไม่เขียนทับ
    await pick();
    await page.getByRole("button", { name: "กู้คืน 1 เรื่อง" }).click();
    await expect(page.getByText(/เรื่องมีอยู่แล้ว · กู้ 0 ตอน · ข้าม 2 ตอน/)).toBeVisible({
      timeout: 60_000,
    });
    expect((await db.from("episodes").select("id").eq("title_id", t.id)).data).toHaveLength(2);
  });
});
