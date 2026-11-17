import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  type TestUser,
} from "./helpers/supabase";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("นำเข้ามังงะเป็นชุด (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;
  let dir = "";
  const slug = `e2e-mangaimport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
    dir = mkdtempSync(join(tmpdir(), "mangaimport-"));
  });
  test.afterEach(async () => {
    rmSync(dir, { recursive: true, force: true });
    if (!created) return;
    created = false;
    await deleteMangaFixture(slug);
    await deleteUser(user.id);
  });

  test("เลือกโฟลเดอร์ → สร้างตอน+อัปโหลดหน้าเรียงตามชื่อ → เลขซ้ำถูกข้าม", async ({ page }) => {
    test.setTimeout(180_000);
    await makeAdmin(user.id);
    const db = admin();
    const title = await db
      .from("titles")
      .insert({ slug, name: "มังงะนำเข้าชุด", type: "manga", published: true })
      .select("id")
      .single();
    expect(title.error).toBeNull();
    const titleId = title.data!.id;

    // ตอน 2 มีอยู่แล้ว (ต้องถูกข้าม ไม่เพิ่มหน้า)
    const old = await db
      .from("episodes")
      .insert({ title_id: titleId, number: 2, name: "ตอนเดิม", status: "draft" })
      .select("id")
      .single();
    expect(old.error).toBeNull();

    // โฟลเดอร์: root/ตอน 1 (page-10, page-2), root/ตอน 2 (1 หน้า), root/ตอน 3 (1 หน้า)
    const root = join(dir, "เรื่อง");
    const put = (ch: string, name: string, h: number) => {
      mkdirSync(join(root, ch), { recursive: true });
      writeFileSync(join(root, ch, name), solidPng(800, h, [90, 90, 200]));
    };
    put("ตอน 1", "page-10.png", 1200);
    put("ตอน 1", "page-2.png", 1000);
    put("ตอน 2", "a.png", 900);
    put("ตอน 3", "a.png", 950);

    await page.goto(callbackUrl(user, `/admin/titles/${titleId}/import`));
    await page.getByLabel(/เลือกโฟลเดอร์เรื่อง/).setInputFiles(root);
    await expect(page.getByText("เลขนี้มีอยู่แล้ว — จะถูกข้าม")).toBeVisible();
    await page.getByRole("button", { name: "นำเข้า 3 ตอน" }).click();
    await expect(page.getByText("นำเข้าเสร็จทั้งหมด")).toBeVisible({ timeout: 120_000 });

    const eps = (
      await db
        .from("episodes")
        .select("id, number, name, status")
        .eq("title_id", titleId)
        .order("number", { ascending: true })
    ).data!;
    expect(eps.map((e) => e.number)).toEqual([1, 2, 3]);
    expect(eps[0].status).toBe("draft");
    expect(eps[1].name).toBe("ตอนเดิม");

    const heights = async (id: string) =>
      (
        (
          await db
            .from("manga_pages")
            .select("height")
            .eq("episode_id", id)
            .order("page_no", { ascending: true })
        ).data ?? []
      ).map((r) => r.height);
    expect(await heights(eps[0].id)).toEqual([1000, 1200]); // เรียงตามเลขในชื่อไฟล์
    expect(await heights(eps[1].id)).toEqual([]); // ตอนเดิมไม่ถูกแตะ
    expect(await heights(eps[2].id)).toEqual([950]);
    expect(await listStoredFiles(titleId)).toHaveLength(3);
  });
});
