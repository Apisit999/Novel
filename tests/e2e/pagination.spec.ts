import { expect, test } from "@playwright/test";
import { admin, deleteTitleBySlug, hasAdmin, revalidateCatalog } from "./helpers/supabase";

// ข้อมูลทดสอบสร้างผ่าน service role แล้วเคลียร์แคช — รันแค่ desktop กับ mobile ก็พอ (ตรรกะเดียวกัน)
test.beforeEach(({}, info) => {
  test.skip(!["desktop", "mobile"].includes(info.project.name), "แบ่งหน้าทดสอบบน desktop/mobile พอ");
});

test.describe("แบ่งหน้า (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  const rand = Math.random().toString(36).slice(2, 8);
  const slugs: string[] = [];
  const tagName = `e2e-pg-${rand}`;

  test.afterEach(async () => {
    for (const s of slugs.splice(0)) await deleteTitleBySlug(s);
    await admin().from("tags").delete().eq("slug", tagName);
  });

  test("สารบัญนิยาย 230 ตอน: หน้าละ 100, ลิงก์หน้าถัดไป, หน้าเกินช่วงถูกบีบ, ค่าขยะได้หน้า 1", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const db = admin();
    const slug = `e2e-toc-${rand}`;
    slugs.push(slug);
    const t = await db
      .from("titles")
      .insert({ slug, name: "สารบัญยาว", type: "novel", published: true })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    const rows = Array.from({ length: 230 }, (_, i) => ({
      title_id: t.data!.id,
      number: i + 1,
      name: `ตอนที่ ${i + 1}`,
      status: "published" as const,
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const r = await db.from("episodes").insert(rows.slice(i, i + 100));
      expect(r.error).toBeNull();
    }
    await revalidateCatalog();

    const items = page.locator("ol li a[href^='/read/']");
    await page.goto(`/title/${slug}`);
    await expect(page.getByRole("heading", { name: /สารบัญ \(230 ตอน\)/ })).toBeVisible();
    await expect(items).toHaveCount(100);
    await expect(items.first()).toHaveText("ตอนที่ 1");
    const nav = page.getByRole("navigation", { name: "แบ่งหน้าสารบัญ" });
    await expect(nav.locator("[aria-current=page]")).toHaveText("1");

    await nav.getByRole("link", { name: "ถัดไป ›" }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(items).toHaveCount(100);
    await expect(items.first()).toHaveText("ตอนที่ 101");

    await page.goto(`/title/${slug}?page=3`);
    await expect(items).toHaveCount(30);
    await expect(items.last()).toHaveText("ตอนที่ 230");

    // เกินช่วง → หน้าสุดท้าย, ค่าขยะ → หน้า 1 (ไม่ error)
    await page.goto(`/title/${slug}?page=999`);
    await expect(items.last()).toHaveText("ตอนที่ 230");
    await page.goto(`/title/${slug}?page=abc`);
    await expect(items.first()).toHaveText("ตอนที่ 1");

    // ปุ่ม "ไปตอนล่าสุด" ยังชี้ตอนสุดท้ายจริง (ไม่ใช่ตอนสุดท้ายของหน้าที่เห็น)
    await expect(page.getByRole("link", { name: "ไปตอนล่าสุด" })).toHaveAttribute(
      "href",
      `/read/${slug}/230`,
    );
  });

  test("หน้าหมวด 26 เรื่อง: หน้าละ 24, หน้า 2 เหลือ 2 เรื่อง, เลื่อนหน้าแล้วตัวกรองไม่หาย", async ({ page }) => {
    test.setTimeout(120_000);
    const db = admin();
    await db.from("tags").upsert({ slug: tagName, name: tagName });
    const tag = (await db.from("tags").select("id").eq("slug", tagName).single()).data!;
    for (let i = 0; i < 26; i++) {
      const slug = `e2e-pg-${rand}-${String(i).padStart(2, "0")}`;
      slugs.push(slug);
      const t = await db
        .from("titles")
        .insert({ slug, name: `หน้า${String(i).padStart(2, "0")}`, type: "novel", published: true })
        .select("id")
        .single();
      expect(t.error).toBeNull();
      await db.from("title_tags").insert({ title_id: t.data!.id, tag_id: tag.id });
    }
    await revalidateCatalog();

    const cards = page.locator("main a[href^='/title/e2e-pg-']");
    await page.goto(`/browse/novel?tag=${tagName}`);
    await expect(cards).toHaveCount(24);
    const nav = page.getByRole("navigation", { name: "แบ่งหน้า" });
    await nav.getByRole("link", { name: "ไปหน้า 2" }).click();
    await expect(page).toHaveURL(new RegExp(`tag=${tagName}.*page=2|page=2.*tag=${tagName}`));
    await expect(cards).toHaveCount(2);
    await expect(nav.locator("[aria-current=page]")).toHaveText("2");

    // ไม่มีการซ้ำข้ามหน้า: 24 + 2 = 26 เรื่องไม่ซ้ำกัน
    const page2 = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    await page.goto(`/browse/novel?tag=${tagName}`);
    await expect(cards).toHaveCount(24); // รอให้เนื้อหาที่สตรีมมาครบก่อนอ่านรายการ
    const page1 = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(new Set([...page1, ...page2]).size).toBe(26);
  });
});
