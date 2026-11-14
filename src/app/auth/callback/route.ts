import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/features/auth/safe-next";
import { authDb } from "@/server/auth-db";

/**
 * ปลายทางของลิงก์ในอีเมล — รองรับ 2 รูปแบบ:
 * - ?code=...                 (PKCE: ลิงก์จาก signInWithOtp ปกติ)
 * - ?token_hash=...&type=...  (ลิงก์แบบ token hash ตามเทมเพลตอีเมลที่กำหนดเอง)
 * สำเร็จ → ตั้ง cookie เซสชัน แล้วไปหน้า next (ผ่าน safeNext); ล้มเหลว → /login?error=1
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const db = await authDb();
  let error: unknown = new Error("ลิงก์ไม่ครบ");
  if (code) {
    ({ error } = await db.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await db.auth.verifyOtp({ type, token_hash: tokenHash }));
  }

  if (error) {
    // บันทึกเฉพาะรหัส/สถานะ (ไม่บันทึกโทเคนหรืออีเมล) ไว้ไล่ปัญหา เช่น ลิงก์หมดอายุ หรือโดนจำกัดความถี่
    const e = error as { code?: string; status?: number; message?: string };
    console.error("auth/callback ล้มเหลว:", e.status ?? "-", e.code ?? e.message);
    return NextResponse.redirect(`${origin}/login?error=1`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
