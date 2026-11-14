import "server-only";
import { createClient } from "@supabase/supabase-js";
import { parseServerEnv, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * ไคลเอนต์สิทธิ์สูงสุด (service role) — ข้าม RLS ทั้งหมด!
 * ใช้เฉพาะงานที่ต้องทำเองฝั่งเซิร์ฟเวอร์จริง ๆ เช่น ลบบัญชี, webhook ชำระเงิน
 * ห้ามส่งผลลัพธ์ดิบไปให้เบราว์เซอร์ และห้ามเรียกโดยไม่ตรวจว่าผู้เรียกคือเจ้าของข้อมูลก่อน
 */
export function adminDb() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = parseServerEnv(process.env).SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ไม่มี SUPABASE_SERVICE_ROLE_KEY ใน environment ของเซิร์ฟเวอร์");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
