import { expect, test } from "@playwright/test";

test("เพิ่มเรื่องที่ชอบจากหน้าเรื่อง แล้วเห็นในห้องสมุดและจำหลังโหลดใหม่", async ({ page }) => {
  await page.goto("/title/moonlit-garden");
  const fav = page.getByRole("button", { name: "เพิ่มในเรื่องที่ชอบ" });
  await expect(async () => {
    await fav.click();
    await expect(page.getByRole("button", { name: /อยู่ในเรื่องที่ชอบ/ })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10_000 });

  await page.goto("/library");
  await expect(page.getByRole("link", { name: /สวนใต้แสงจันทร์/ })).toBeVisible();

  // เอาออกได้
  await page.goto("/title/moonlit-garden");
  await page.getByRole("button", { name: /อยู่ในเรื่องที่ชอบ/ }).click();
  await page.goto("/library");
  await expect(page.getByText("ยังไม่มีเรื่องที่ชอบ")).toBeVisible();
});

test("อ่านค้างไว้ → ปุ่มอ่านต่อ + แถว 'อ่านต่อ' หน้าแรก + กลับไปตำแหน่งเดิม", async ({ page }) => {
  await page.goto("/read/moonlit-garden/2");
  await expect(page.getByRole("progressbar")).toBeVisible();
  // เลื่อนลงให้ตำแหน่งไม่ใช่ 0% (หน้าสั้นบนจอใหญ่อาจไม่มีที่ให้เลื่อน → ถือว่า 100%)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const d = JSON.parse(localStorage.getItem("aandoo:library:v1") ?? "{}");
          return d.progress?.["moonlit-garden"]?.number;
        }),
      { timeout: 8000 },
    )
    .toBe(2);

  await page.goto("/title/moonlit-garden");
  await expect(page.getByRole("link", { name: "อ่านต่อ ตอนที่ 2" })).toBeVisible();

  await page.goto("/");
  const strip = page.getByRole("region", { name: "อ่านต่อ" });
  await expect(strip.getByRole("link", { name: /สวนใต้แสงจันทร์/ })).toBeVisible();
});

test("ข้อมูลในเครื่องเสียไม่ทำให้หน้าพัง", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aandoo:library:v1", "{not json"));
  await page.goto("/library");
  await expect(page.getByText("ยังไม่มีเรื่องที่ชอบ")).toBeVisible();
});
