import "server-only";
import { parseServerEnv } from "@/lib/env";

/**
 * Feature flags ฝั่งเซิร์ฟเวอร์ที่มาจาก env
 * หมายเหตุ: สวิตช์ paywall ไม่อยู่ที่นี่ — ต้นทางเดียวคือตาราง app_settings ในฐานข้อมูล
 * (ดู isPaywallEnabled ใน src/features/access/paywall.ts) เพื่อให้ตรงกับ RLS เสมอ
 */
export function getFlags() {
  const env = parseServerEnv(process.env);
  return {
    signupEnabled: env.SIGNUP_ENABLED,
    emailLoginEnabled: env.EMAIL_LOGIN_ENABLED,
  };
}
