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

  // ผู้ใช้กดยกเลิก/ไม่อนุญาตที่หน้า Google → Supabase ส่ง ?error=access_denied กลับมา
  if (searchParams.get("error") === "access_denied") {
    return NextResponse.redirect(`${origin}/login?error=denied`);
  }

  // Supabase/Google ส่งสาเหตุกลับมาใน query (เช่น ?error=server_error&error_code=...&error_description=...)
  const providerError = searchParams.get("error_code") ?? searchParams.get("error");
  if (providerError && !code && !tokenHash) {
    console.error(
      "auth/callback: ผู้ให้บริการแจ้งข้อผิดพลาด:",
      providerError,
      searchParams.get("error_description") ?? "",
    );
    const detail =
      process.env.NODE_ENV === "production"
        ? ""
        : `&detail=${encodeURIComponent(`${providerError}: ${searchParams.get("error_description") ?? ""}`.slice(0, 300))}`; // เฉพาะตอนพัฒนา: ให้เห็นสาเหตุจริงในหน้า
    return NextResponse.redirect(
      `${origin}/login?error=${providerError === "otp_expired" ? "expired" : "provider-failed"}${detail}`,
    );
  }

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
    // ไม่มี code verifier = เปิดลิงก์คนละเบราว์เซอร์/คนละโดเมน (localhost vs 127.0.0.1) กับที่กดขอลิงก์
    const lost = /code verifier|flow_state_not_found/i.test(`${e.code ?? ""} ${e.message ?? ""}`);
    const expired = e.code === "otp_expired";
    return NextResponse.redirect(
      `${origin}/login?error=${lost ? "browser" : expired ? "expired" : "1"}`,
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
