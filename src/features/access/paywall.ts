import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/server/db";

/**
 * สวิตช์ paywall มีต้นทางเดียว: ตาราง app_settings ในฐานข้อมูล (ตัวเดียวกับที่ RLS อ่าน)
 * - แถวหายหรืออ่านไม่ได้ → ถือว่า paywall เปิด (fail-closed) ให้ตรงกับฟังก์ชัน SQL can_access
 * - เปลี่ยนค่าในแอดมิน (เฟส 3) แล้วเรียก revalidateTag("settings") เพื่อให้มีผลทันที
 */
export async function isPaywallEnabled(): Promise<boolean> {
  "use cache";
  cacheLife("minutes");
  cacheTag("settings");

  const { data, error } = await publicDb()
    .from("app_settings")
    .select("value")
    .eq("key", "paywall_enabled")
    .maybeSingle();
  if (error || !data) return true;
  return data.value !== false;
}
