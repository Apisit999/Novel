import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  callbackUrl,
  createTestUser,
  deleteUser,
  hasAdmin,
  type TestUser,
} from "./helpers/supabase";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "ต่อ Supabase จริง ใช้โควตาลิงก์ → desktop เท่านั้น");
});

/** TOTP (RFC 6238, SHA-1, 6 หลัก, 30 วินาที) จากรหัสลับ base32 */
function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", bytes).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

test.describe("ยืนยันสองขั้น (TOTP) (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let user: TestUser;
  let created = false;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteUser(user.id);
  });

  test("ไม่ล็อกอิน → ไปหน้าล็อกอิน; ล็อกอิน → ตั้งค่าแอปยืนยัน → เปิดใช้งาน → ลบได้", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/account/security");
    await expect(page).toHaveURL(/\/login/);

    await page.goto(callbackUrl(user, "/account/security"));
    await page.getByRole("button", { name: "เริ่มตั้งค่า" }).click();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible({ timeout: 20_000 });
    const secret = (await page.locator("code").textContent())!.trim();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

    // รหัสผิดต้องไม่ผ่าน
    await page.getByLabel(/รหัส 6 หลัก/).fill("000000");
    await page.getByRole("button", { name: "เปิดใช้งาน" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("รหัสไม่ถูกต้อง");

    // รหัสถูกต้องผ่าน
    await page.getByLabel(/รหัส 6 หลัก/).fill(totp(secret));
    await page.getByRole("button", { name: "เปิดใช้งาน" }).click();
    await expect(page.getByText("เปิดใช้ยืนยันสองขั้นแล้ว")).toBeVisible({ timeout: 20_000 });

    // ลบแอปยืนยัน (เซสชันนี้เป็น aal2 แล้ว จึงลบได้)
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(page.getByRole("button", { name: "เริ่มตั้งค่า" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
