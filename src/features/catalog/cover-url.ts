/** URL สาธารณะของรูปปก (บัคเก็ต covers เป็นสาธารณะ) — ไม่มีรูป = null แล้วใช้ปกสีชั่วคราวแทน */
export function coverUrl(key: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !base) return null;
  return `${base}/storage/v1/object/public/covers/${key.split("/").map(encodeURIComponent).join("/")}`;
}
