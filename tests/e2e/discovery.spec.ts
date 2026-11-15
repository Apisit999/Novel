import { expect, test } from "@playwright/test";
import { admin, anon, deleteTitleBySlug, hasAdmin, revalidateCatalog } from "./helpers/supabase";

test.describe("ค้นหาภาษาไทย", () => {
  test("พิมพ์ติดกันไม่เว้นวรรคก็เจอ และหลายคำต้องตรงครบ", async ({ page }) => {
    await page.goto("/search?q=มังกร");
    await expect(page.getByText(/พบ [1-9]\d* เรื่อง/)).toBeVisible();

    await page.goto("/search?q=มังกร คำที่ไม่มีอยู่แน่นอน");
    await expect(page.getByText("พบ 0 เรื่อง")).toBeVisible();
  });

  test("คำค้นยาวผิดปกติไม่ทำให้หน้าพัง", async ({ page }) => {
    const res = await page.goto(`/search?q=${encodeURIComponent("ก".repeat(300))}`);
    expect(res?.status()).toBe(200);
  });
});

test.describe("หน้าแรกแบบ Netflix", () => {
  test("มีแถว 'อัปเดตล่าสุด' เลื่อนแนวนอนได้ และหน้าไม่เลื่อนแนวนอน", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "อัปเดตล่าสุด" })).toBeVisible();
    const row = page.getByRole("region", { name: "อัปเดตล่าสุด" }).getByRole("list");
    await expect(row.getByRole("link").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("ข้อมูลจริง (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");

  test("เรื่องที่ติ๊กเด่นขึ้นแบนเนอร์ และนับยอดได้เฉพาะฝั่งเซิร์ฟเวอร์", async ({ page }, testInfo) => {
    // แบนเนอร์มีที่เดียว หลายโปรเจกต์ (จอ) สร้างเรื่องเด่นพร้อมกันจะชนกัน → ทำเฉพาะโปรเจกต์เดียว
    test.skip(testInfo.project.name !== "desktop", "ทำเฉพาะโปรเจกต์ desktop");

    const slug = `e2e-featured-${Date.now()}`;
    const db = admin();
    try {
      const { data: title, error } = await db
        .from("titles")
        .insert({
          type: "novel",
          slug,
          name: "เรื่องเด่นทดสอบ",
          synopsis: "ทดสอบแบนเนอร์",
          published: true,
          featured: true,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      const ep = await db
        .from("episodes")
        .insert({ title_id: title!.id, number: 1, name: "ตอนแรก", status: "published" });
      expect(ep.error).toBeNull();
      await revalidateCatalog();

      await page.goto("/");
      const banner = page.getByRole("region", { name: "เรื่องเด่น" });
      await expect(banner.getByRole("heading", { name: "เรื่องเด่นทดสอบ" })).toBeVisible();
      await expect(
        page.getByRole("region", { name: "อัปเดตล่าสุด" }).getByRole("link", { name: /เรื่องเด่นทดสอบ/ }),
      ).toBeVisible();

      // ยอดอ่าน: ผู้เยี่ยมชมเรียกฟังก์ชันนับตรง ๆ ไม่ได้ (กันปั่นยอด) แต่ฝั่งเซิร์ฟเวอร์ทำได้
      const denied = await anon().rpc("record_title_view", { p_slug: slug });
      expect(denied.error).not.toBeNull();
      for (let i = 0; i < 2; i++) {
        const ok = await db.rpc("record_title_view", { p_slug: slug });
        expect(ok.error).toBeNull();
      }
      const views = await db
        .from("title_views")
        .select("view_count")
        .eq("title_id", title!.id)
        .single();
      expect(views.data?.view_count).toBe(2);

      // เรื่องที่ไม่ได้เผยแพร่ ไม่นับยอด
      await db.from("titles").update({ published: false }).eq("id", title!.id);
      await db.rpc("record_title_view", { p_slug: slug });
      const after = await db
        .from("title_views")
        .select("view_count")
        .eq("title_id", title!.id)
        .single();
      expect(after.data?.view_count).toBe(2);
    } finally {
      await deleteTitleBySlug(slug);
      await revalidateCatalog();
    }
  });
});
