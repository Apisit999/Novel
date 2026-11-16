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

test("ตัวอ่าน: ปรับระยะบรรทัดได้และจำค่า", async ({ page }) => {
  await page.goto("/read/sample-novel/1");
  const lh = () =>
    page
      .locator("article div[lang=th]")
      .first()
      .evaluate(
        (el) =>
          parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize),
      );
  await expect(async () => {
    await page.getByRole("button", { name: /ระยะห่างบรรทัด/ }).click();
    expect(Math.round((await lh()) * 10) / 10).toBe(2.3);
  }).toPass({ timeout: 10_000 });
  await page.reload();
  await expect(async () => expect(Math.round((await lh()) * 10) / 10).toBe(2.3)).toPass({
    timeout: 5_000,
  });
});

test("ตัวอ่าน: ปัดซ้ายไปตอนถัดไป และแตะข้อความซ่อนแถบเครื่องมือ", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit สร้าง TouchEvent จากสคริปต์ไม่ได้");
  await page.goto("/read/sample-novel/1");
  const swipe = (x1: number, x2: number) =>
    page.evaluate(
      ([a, b]) => {
        const el = document.querySelector("article div[lang=th]")!;
        const mk = (x: number) =>
          new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
        el.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            touches: [mk(a)],
            changedTouches: [mk(a)],
          }),
        );
        el.dispatchEvent(
          new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [mk(b)] }),
        );
      },
      [x1, x2],
    );
  const toolbar = page.getByRole("toolbar");
  await expect(async () => {
    await page.locator("article div[lang=th]").first().click();
    await expect(toolbar).toHaveClass(/-translate-y-full/, { timeout: 500 });
  }).toPass({ timeout: 10_000 });

  await expect(async () => {
    await swipe(300, 100);
    await expect(page).toHaveURL(/\/read\/sample-novel\/2$/, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
});
