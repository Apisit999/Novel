/**
 * กัน open redirect: รับเฉพาะ path ภายในเว็บ ("/library") ไม่รับ URL เต็มหรือ "//evil.com" หรือ "/\evil.com"
 * ค่าที่ไม่ปลอดภัย/ว่าง → กลับหน้าห้องสมุด
 */
export function safeNext(value: string | null | undefined, fallback = "/library"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
