import { expect, test } from "@playwright/test";

test("หน้าเรื่องมี title, description, canonical และ Open Graph", async ({ page }) => {
  await page.goto("/title/moonlit-garden");
  await expect(page).toHaveTitle("สวนใต้แสงจันทร์ | AanDoo");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /เรื่องรักอบอุ่น/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/title\/moonlit-garden$/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "สวนใต้แสงจันทร์",
  );
});

test("หน้าค้นหาและห้องสมุดไม่ถูกจัดทำดัชนี", async ({ page }) => {
  for (const path of ["/search", "/library"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
});

test("ตอนที่เป็น premium ไม่ถูกจัดทำดัชนี แต่ตอนฟรีถูก", async ({ page }) => {
  await page.goto("/read/dragon-ledger/1"); // เรื่อง premium ทั้งเรื่อง
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/read/moonlit-garden/1");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("robots.txt และ sitemap.xml ถูกต้อง", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /search");
  expect(robots).toMatch(/Sitemap: .+\/sitemap\.xml/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/browse/novel");
  expect(sitemap).toContain("/title/moonlit-garden");
  expect(sitemap).toContain("/read/moonlit-garden/5");
  // ตอน/เรื่อง premium ไม่อยู่ใน sitemap
  expect(sitemap).not.toContain("/read/dragon-ledger/");
  expect(sitemap).not.toContain("/read/sample-novel/2");
  expect(sitemap).toContain("/read/sample-novel/1");
});

test("ทุกหน้าส่ง security headers พื้นฐาน และไม่เปิดเผยว่าใช้ Next.js", async ({ request }) => {
  for (const path of ["/", "/login", "/browse/novel"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["x-powered-by"]).toBeUndefined();
  }
});

test("หน้าเรื่องมีข้อมูลโครงสร้าง JSON-LD (schema.org) ที่อ่านได้", async ({ page }) => {
  await page.goto("/title/moonlit-garden");
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(raw ?? "{}");
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@type"]).toBe("Book");
  expect(data.name).toBe("สวนใต้แสงจันทร์");
  expect(data.url).toMatch(/\/title\/moonlit-garden$/);
});

test("หน้าที่ไม่มีอยู่ (เรื่อง/ผู้สร้าง/ตอน) มี noindex แม้รหัสตอบกลับเป็น 200 (กัน soft 404 ติดดัชนี)", async ({
  request,
}) => {
  for (const path of [
    "/title/no-such-title-xyz",
    "/author/no-such-author-xyz",
    "/read/no-such-title-xyz/1",
  ]) {
    const res = await request.get(path);
    const html = await res.text();
    expect(html, path).toContain("ไม่พบหน้าที่ต้องการ");
    expect(html, path).toMatch(/<meta name="robots" content="noindex"/);
  }
});
