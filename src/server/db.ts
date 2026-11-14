import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | undefined;

/**
 * ไคลเอนต์สาธารณะ (anon) ฝั่งเซิร์ฟเวอร์ — อ่านแคตตาล็อกที่ทุกคนเห็นเหมือนกัน
 * ข้อมูลทุกแถวผ่าน RLS ในฐานข้อมูลเสมอ (ไม่ใช้ service role ที่นี่)
 * เมื่อต้องอ่านในนามผู้ใช้ที่ล็อกอิน (เฟส 2) ให้สร้างไคลเอนต์แยกจาก cookie ห้ามใช้ตัวนี้ร่วม/แคชข้ามผู้ใช้
 */
export function publicDb(): SupabaseClient<Database> {
  if (client) return client;
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "ไม่มีค่า NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — ตั้งใน .env.local (ดู .env.example)",
    );
  }
  client = createClient<Database>(url, key, { auth: { persistSession: false } });
  return client;
}
