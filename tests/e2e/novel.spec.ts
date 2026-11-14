import { test, expect } from "@playwright/test";

test("browse → title → read novel episode", async ({ page }) => {
  await page.goto("/browse/novel");
  await page.getByRole("link", { name: "นิยายตัวอย่าง" }).click();
  await expect(page.getByRole("heading", { name: "นิยายตัวอย่าง" })).toBeVisible();
  await page.getByRole("link", { name: "ตอนที่ 1", exact: true }).click();
  await expect(page.getByText("นี่คือเนื้อหาตัวอย่างของตอนแรก")).toBeVisible();
  await page.getByRole("link", { name: /ถัดไป/ }).click();
  await expect(page.getByRole("heading", { name: /ตอนที่ 2/ })).toBeVisible();
});
