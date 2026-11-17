import { expect, test } from "@playwright/test";

test("หน้าเรื่อง: ปุ่มแชร์ LINE/Facebook/X, จำนวนตอนในสารบัญ และปุ่มไปตอนล่าสุด", async ({ page }) => {
  await page.goto("/title/sample-novel");
  for (const name of ["LINE", "Facebook", "X"]) {
    const a = page.getByRole("link", { name: `แชร์ไปที่ ${name}` });
    await expect(a).toBeVisible();
    await expect(a).toHaveAttribute("href", /^https:\/\/.+sample-novel/);
    await expect(a).toHaveAttribute("rel", /noopener/);
    expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("heading", { name: /^สารบัญ \(\d+ ตอน\)$/ })).toBeVisible();

  const count = await page.locator("ol li a[href^='/read/sample-novel/']").count();
  if (count > 1) {
    const last = await page
      .locator("ol li a[href^='/read/sample-novel/']")
      .last()
      .getAttribute("href");
    await expect(page.getByRole("link", { name: "ไปตอนล่าสุด" })).toHaveAttribute("href", last!);
  }
});
