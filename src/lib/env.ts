import { z } from "zod";

/**
 * ตรวจค่า environment ทั้งหมดที่เดียว
 * ขาด/ผิดรูปแบบ → โยน error พร้อมบอกชื่อตัวแปร แทนที่จะพังกลางทาง
 *
 * ค่าที่ขึ้นต้นด้วย NEXT_PUBLIC_ ถูกส่งไปเบราว์เซอร์ ห้ามใส่ความลับ
 * ต้องอ้าง process.env.NEXT_PUBLIC_xxx ตรง ๆ เพื่อให้ Next.js แทนค่าตอน build
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  // Supabase: เริ่มเป็น optional จนถึงเฟส 0.3 แล้วเปลี่ยนเป็น required
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

/** boolean จาก env: "true"/"1" = true, ที่เหลือ = ค่า default */
const flag = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === "true" || v === "1"));

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SIGNUP_ENABLED: flag(true),
  // ล็อกอินด้วยอีเมล (magic link): ปิดไว้ก่อน ใช้ Google เป็นทางหลัก — เปิดคืนด้วย EMAIL_LOGIN_ENABLED=true
  EMAIL_LOGIN_ENABLED: flag(false),
  // ความลับของ POST /api/revalidate (เคลียร์แคชหลังแก้ฐานข้อมูลโดยตรง) — ไม่ตั้ง = endpoint ปิด (404)
  REVALIDATE_SECRET: z.string().min(16).optional(),
  // บังคับแอดมินยืนยันสองขั้น (TOTP) ก่อนเข้าหลังบ้าน — ตั้ง true หลังแอดมินทุกคนลงทะเบียนแอปยืนยันที่ /account/security แล้ว
  ADMIN_REQUIRE_MFA: flag(false),
});

export function parsePublicEnv(source: Record<string, string | undefined>) {
  return publicSchema.parse(source);
}

export function parseServerEnv(source: Record<string, string | undefined>) {
  return serverSchema.parse(source);
}

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
