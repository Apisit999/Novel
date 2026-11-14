import { test, expect } from "@playwright/test";

test("browse → title → read novel episode", async ({ page }) => {
  await page.goto("/browse/novel");
  await page.getByRole("link", { name: "นิยายตัวอย่าง" }).click();
  await expect(page.getByRole("heading", { name: "นิยายตัวอย่าง" })).toBeVisible();
  await page.getByRole("link", { name: "ตอนที่ 1", exact: true }).click();
  await expect(page.getByText("นี่คือเนื้อหาตัวอย่างของตอนที่ 1")).toBeVisible();
  await page.getByRole("link", { name: /ถัดไป/ }).click();
  await expect(page.getByRole("heading", { name: /ตอนที่ 2/ })).toBeVisible();
});

test("หลายเรื่อง: แต่ละเรื่องมีตอนของตัวเอง และกรองตามแท็กได้", async ({ page }) => {
  await page.goto("/browse/novel");
  await expect(page.getByRole("link", { name: "สวนใต้แสงจันทร์" })).toBeVisible();
  await expect(page.getByRole("link", { name: "บัญชีมังกร" })).toBeVisible();

  await page.getByRole("link", { name: "โรแมนติก" }).click();
  await expect(page.getByRole("link", { name: "สวนใต้แสงจันทร์" })).toBeVisible();
  await expect(page.getByRole("link", { name: "บัญชีมังกร" })).toHaveCount(0);

  await page.getByRole("link", { name: "สวนใต้แสงจันทร์" }).click();
  await expect(page.getByRole("link", { name: /^ตอนที่ / })).toHaveCount(5);
});
