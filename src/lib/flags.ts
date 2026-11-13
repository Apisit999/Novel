import "server-only";
import { parseServerEnv } from "@/lib/env";

/**
 * Feature flags (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 * - paywallEnabled=false → ทุกเนื้อหาเปิดฟรี (ช่วงเปิดตัว)
 * - เปิดเก็บเงินภายหลังด้วยการตั้ง PAYWALL_ENABLED=true โดยไม่ต้องแก้โค้ด
 */
export function getFlags() {
  const env = parseServerEnv(process.env);
  return {
    paywallEnabled: env.PAYWALL_ENABLED,
    signupEnabled: env.SIGNUP_ENABLED,
  };
}
