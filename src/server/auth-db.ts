import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * ไคลเอนต์ Supabase ในนามผู้ใช้ที่ล็อกอิน (อ่านเซสชันจาก cookie) — ข้อมูลผ่าน RLS ตามผู้ใช้คนนั้น
 * ใช้ได้เฉพาะในคำขอเดียว ห้ามเก็บเป็นตัวแปรระดับโมดูล และห้ามใช้ภายใน `use cache`
 * (ผลขึ้นกับผู้ใช้ จะแคชข้ามคนไม่ได้) — ส่วนแคตตาล็อกสาธารณะให้ใช้ publicDb() แทน
 */
export async function authDb() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("ไม่มีค่า NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // เรียกจาก Server Component (เขียน cookie ไม่ได้) — proxy.ts ต่ออายุเซสชันให้แทน
        }
      },
    },
  });
}

/** ผู้ใช้ปัจจุบัน (ตรวจกับเซิร์ฟเวอร์ Auth จริง ไม่เชื่อ cookie อย่างเดียว) หรือ null — จำผลไว้ภายในคำขอเดียว */
export const getCurrentUser = cache(async () => {
  const db = await authDb();
  const { data } = await db.auth.getUser();
  return data.user;
});
