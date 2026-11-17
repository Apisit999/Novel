/**
 * ตัดสินว่าแอดมินต้องยืนยันตัวตนสองขั้น (TOTP) ก่อนเข้าหลังบ้านหรือไม่ — โค้ดล้วน ทดสอบได้
 * - required = false (ADMIN_REQUIRE_MFA ไม่เปิด) → ผ่านเสมอ
 * - เซสชันอยู่ระดับ aal2 แล้ว → ผ่าน
 * - มีแอปยืนยัน (factor) ที่ลงทะเบียนแล้วแต่ยังไม่ยืนยันในเซสชันนี้ (nextLevel = aal2) → "challenge" (กรอกรหัส 6 หลัก)
 * - ยังไม่เคยลงทะเบียน → "enroll" (ต้องตั้งแอปยืนยันก่อน)
 */
export type MfaGate = "ok" | "challenge" | "enroll";

export function adminMfaGate(
  required: boolean,
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined,
): MfaGate {
  if (!required) return "ok";
  if (currentLevel === "aal2") return "ok";
  return nextLevel === "aal2" ? "challenge" : "enroll";
}
