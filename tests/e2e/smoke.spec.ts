import { expect, test } from "@playwright/test";

test("หน้าแรกเปิดได้และมีชื่อเว็บ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AanDoo");
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
});

test("เมนูหมวดพาไปหน้า browse ของแต่ละประเภท", async ({ page }) => {
  await page.goto("/");
  for (const label of ["นิยาย", "มังงะ", "วิดีโอ"]) {
    await page
      .getByRole("navigation", { name: "หมวดเนื้อหา" })
      .getByRole("link", { name: label })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  }
});

test("ปุ่มธีมสลับ สว่าง → ซีเปีย → มืด และจำค่าหลังโหลดใหม่", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  const toggle = page.getByRole("button", { name: /สลับธีม/ });
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "sepia");
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("ประเภทที่ไม่มีอยู่ได้หน้า 404", async ({ page }) => {
  const res = await page.goto("/browse/podcast");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
});
