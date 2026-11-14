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

test("ตัวอ่าน: สลับภาษา มีป้ายแปลอัตโนมัติ และปรับขนาดตัวอักษรได้", async ({ page }) => {
  await page.goto("/read/sample-novel/1");
  await expect(page.getByText("แปลอัตโนมัติ")).toHaveCount(0);

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("This is the sample content of episode 1.")).toBeVisible();

  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByText("这是第 1 集的示例内容。")).toBeVisible();
  await expect(page.getByText("แปลอัตโนมัติ")).toBeVisible();

  const size = () =>
    page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--read-size")),
    );
  const before = await size();
  await page.getByRole("button", { name: "เพิ่มขนาดตัวอักษร" }).click();
  expect(await size()).toBeGreaterThan(before);

  await page.reload();
  await expect(page.getByText("这是第 1 集的示例内容。")).toBeVisible(); // จำภาษาที่เลือก
});

test("ตัวอ่าน: ลูกศรขวาไปตอนถัดไป และมีแถบความคืบหน้า", async ({ page }) => {
  await page.goto("/read/sample-novel/1");
  await expect(page.getByRole("progressbar")).toBeVisible();
  // ตัวฟังคีย์ติดหลัง hydrate — กดซ้ำจนกว่าจะทำงาน
  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/read\/sample-novel\/2$/, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
});
