import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/browse/novel",
  "/title/sample-novel",
  "/read/sample-novel/1",
  "/search?q=มังกร",
];

for (const path of PAGES) {
  test(`ไม่มีแถบเลื่อนแนวนอน: ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("เมนูถูกชุด: มือถือเห็นเมนูล่าง จอใหญ่เห็นเมนูบน", async ({ page }) => {
  await page.goto("/");
  const width = page.viewportSize()!.width;
  const bottom = page.getByRole("navigation", { name: "เมนูหลัก" });
  const top = page.getByRole("navigation", { name: "หมวดเนื้อหา" });
  if (width < 768) {
    await expect(bottom).toBeVisible();
    await expect(top).toBeHidden();
  } else {
    await expect(top).toBeVisible();
    await expect(bottom).toBeHidden();
  }
});

test("จำนวนปกต่อแถวตามขนาดจอ", async ({ page }) => {
  await page.goto("/browse/novel");
  const width = page.viewportSize()!.width;
  const cols = await page
    .locator("main a[href^='/title/']")
    .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
  const expected = width < 480 ? 2 : width < 768 ? 3 : width < 1024 ? 4 : 5;
  // ข้อมูลตัวอย่างมี 3 เรื่อง → คอลัมน์ที่เห็น = min(3, จำนวนคอลัมน์ของจอ)
  expect(cols).toBe(Math.min(3, expected));
});

test("เป้ากดหลักสูงอย่างน้อย 44px", async ({ page }) => {
  await page.goto("/");
  for (const name of ["ค้นหา", "เรื่องที่ชอบ", /สลับธีม/]) {
    const box = await page
      .getByRole("link", { name })
      .or(page.getByRole("button", { name }))
      .first()
      .boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test("ค้นหาจากหน้าแรกพาไปผลลัพธ์", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "ค้นหาเรื่อง" }).fill("มังกร");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole("link", { name: /บัญชีมังกร/ })).toBeVisible();
});
