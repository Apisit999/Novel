import { expect, test } from "@playwright/test";
import { admin, deleteTitleBySlug, hasAdmin, revalidateCatalog } from "./helpers/supabase";

test.beforeEach(({}, info) => {
  test.skip(!["desktop", "mobile"].includes(info.project.name), "ทดสอบบน desktop/mobile พอ");
});

test.describe("ไอเดียจาก WEBTOON (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  const rand = Math.random().toString(36).slice(2, 8);
  const slugs: string[] = [];
  const author = `ผู้เขียน-${rand}`;

  test.afterEach(async () => {
    for (const s of slugs.splice(0)) await deleteTitleBySlug(s);
  });

  async function novel(slug: string, over: Record<string, unknown> = {}) {
    slugs.push(slug);
    const t = await admin()
      .from("titles")
      .insert({ slug, name: `เรื่อง ${slug}`, type: "novel", published: true, ...over })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    return t.data!.id;
  }

  test("สารบัญ: วันที่ของตอน + ป้าย 'ใหม่' เฉพาะตอนที่เพิ่งขึ้น", async ({ page }) => {
    const slug = `e2e-new-${rand}`;
    const id = await novel(slug);
    const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const res = await admin()
      .from("episodes")
      .insert([
        { title_id: id, number: 1, name: "ตอนเก่า", status: "published", created_at: old },
        {
          title_id: id,
          number: 2,
          name: "ตอนใหม่เอี่ยม",
          status: "published",
          created_at: new Date().toISOString(),
        },
      ]);
    expect(res.error).toBeNull();
    await revalidateCatalog();

    await page.goto(`/title/${slug}`);
    const rows = page.locator("ol li");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).not.toContainText("ใหม่");
    await expect(rows.nth(1)).toContainText("ใหม่");
    await expect(rows.nth(0)).toContainText(/\d{1,2} \S+ \d{2}/); // วันที่ไทยสั้น
  });

  test("หน้าเรื่องแสดง 'ผลงานอื่นของ' ผู้สร้างเดียวกัน ไม่รวมตัวเอง", async ({ page }) => {
    const a = `e2e-auth-a-${rand}`;
    const b = `e2e-auth-b-${rand}`;
    await novel(a, { author });
    await novel(b, { author });
    await revalidateCatalog();

    await page.goto(`/title/${a}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(`ผลงานอื่นของ ${author}`) }),
    ).toBeVisible();
    await expect(page.locator(`main a[href='/title/${b}']`).first()).toBeVisible();
    await expect(page.locator(`section a[href='/title/${a}']`)).toHaveCount(0);
  });

  test("ตารางรายวัน: แท็บ 'จบแล้ว' แสดงเฉพาะเรื่องที่จบ", async ({ page }) => {
    const done = `e2e-done-${rand}`;
    const going = `e2e-going-${rand}`;
    await novel(done, { status: "completed", name: `จบแล้ว-${rand}` });
    await novel(going, { status: "ongoing", name: `ยังไม่จบ-${rand}` });
    await revalidateCatalog();

    await page.goto("/schedule");
    await page.getByRole("link", { name: "จบแล้ว", exact: true }).click();
    await expect(page).toHaveURL(/day=done/);
    await expect(page.getByRole("link", { name: "จบแล้ว", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.locator(`main a[href='/title/${done}']`).first()).toBeVisible();
    await expect(page.locator(`main a[href='/title/${going}']`)).toHaveCount(0);
  });
});
