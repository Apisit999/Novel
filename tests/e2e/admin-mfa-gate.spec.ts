import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  callbackUrl,
  createTestUser,
  deleteUser,
  hasAdmin,
  makeAdmin,
  type TestUser,
} from "./helpers/supabase";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "ต่อ Supabase จริง ใช้โควตาลิงก์ → desktop เท่านั้น");
});

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;

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

test.describe("บังคับยืนยันสองขั้นของแอดมิน (ADMIN_REQUIRE_MFA=true)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  let server: ChildProcess | null = null;
  let user: TestUser;
  let created = false;

  test.beforeAll(async () => {
    // เซิร์ฟเวอร์ตัวที่สอง (ใช้ build เดิม) ที่เปิดการบังคับ MFA — ตัวหลักของชุดทดสอบไม่เปิด จะได้ไม่กระทบเทสต์อื่น
    server = spawn("npx", ["next", "start", "-p", String(PORT)], {
      shell: true,
      env: { ...process.env, ADMIN_REQUIRE_MFA: "true" },
      stdio: "ignore",
    });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(BASE)).ok) return;
      } catch {
        /* ยังไม่พร้อม */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("เซิร์ฟเวอร์ MFA ไม่เริ่มทำงาน");
  });
  test.afterAll(() => {
    if (server?.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  });
  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteUser(user.id);
  });

  test("แอดมินที่ยังไม่ตั้งแอปยืนยันเข้าหลังบ้านไม่ได้ → ตั้งค่าแล้วเข้าได้", async ({ page }) => {
    test.setTimeout(120_000);
    await makeAdmin(user.id);
    await page.goto(`${BASE}${callbackUrl(user, "/admin")}`);

    // ถูกส่งไปตั้งค่าแทนการเข้าหลังบ้าน
    await expect(page).toHaveURL(/\/account\/security\?enroll=1/, { timeout: 30_000 });
    await expect(page.getByText("หลังบ้านบังคับยืนยันสองขั้น")).toBeVisible();
    // เรียกหน้าหลังบ้านและ route ส่งออกตรง ๆ ก็ยังเข้าไม่ได้
    await page.goto(`${BASE}/admin/export`).catch(() => {});
    await expect(page).toHaveURL(/\/account\/security\?enroll=1/);

    await page.getByRole("button", { name: "เริ่มตั้งค่า" }).click();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible({ timeout: 20_000 });
    const secret = (await page.locator("code").textContent())!.trim();
    await page.getByLabel(/รหัส 6 หลัก/).fill(totp(secret));
    await page.getByRole("button", { name: "เปิดใช้งาน" }).click();

    // ยืนยันสำเร็จ → พากลับ /admin และเข้าได้
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "เรื่องทั้งหมด" })).toBeVisible();
  });
});
