import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * ชั้นเก็บไฟล์รูป — ที่เดียวที่รู้ว่าใช้ Supabase Storage อยู่
 * (แผนเดิมคือ Cloudflare R2: ถ้าย้ายภายหลัง แก้เฉพาะไฟล์นี้ ผู้เรียกใช้เหมือนเดิม)
 *
 * บัคเก็ตเป็นแบบส่วนตัว ไม่มี URL สาธารณะ: รูปที่ผู้อ่านเห็นมาจาก "ลิงก์ที่หมดอายุ" เท่านั้น
 * และฐานข้อมูลจะออกลิงก์ให้เฉพาะรูปที่ผู้เรียกมีสิทธิ์อ่านตาม can_access (policy บน storage.objects)
 */
export const MANGA_BUCKET = "manga";

/** อายุลิงก์รูปของผู้อ่าน (วินาที) — นานพอที่จะอ่านทั้งตอนจบโดยไม่หมดอายุกลางคัน */
const READ_URL_TTL = 2 * 60 * 60;

type Db = SupabaseClient<Database>;

/** ออกลิงก์อ่านรูปหลายไฟล์ในคราวเดียว — คีย์ที่ไม่มีสิทธิ์/ไม่มีไฟล์จะไม่มีในผลลัพธ์ */
export async function signedReadUrls(db: Db, keys: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (keys.length === 0) return urls;
  const { data, error } = await db.storage.from(MANGA_BUCKET).createSignedUrls(keys, READ_URL_TTL);
  if (error) throw new Error(`ออกลิงก์รูปไม่สำเร็จ: ${error.message}`);
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

/** ออกลิงก์ "อัปโหลด" ให้เบราว์เซอร์ส่งไฟล์ขึ้นตรง ๆ (ไม่ผ่านเซิร์ฟเวอร์เรา) — เรียกได้เฉพาะแอดมิน (policy insert) */
export async function createUploadTargets(
  db: Db,
  keys: string[],
): Promise<{ key: string; token: string }[]> {
  const out: { key: string; token: string }[] = [];
  for (const key of keys) {
    const { data, error } = await db.storage.from(MANGA_BUCKET).createSignedUploadUrl(key);
    if (error || !data) throw new Error(`ออกลิงก์อัปโหลดไม่สำเร็จ: ${error?.message}`);
    out.push({ key, token: data.token });
  }
  return out;
}

export async function removeObjects(db: Db, keys: string[]) {
  if (keys.length === 0) return;
  const { error } = await db.storage.from(MANGA_BUCKET).remove(keys);
  if (error) console.error("removeObjects:", error.message);
}
