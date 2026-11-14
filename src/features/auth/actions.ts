"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getFlags } from "@/lib/flags";
import { publicEnv } from "@/lib/env";
import { adminDb } from "@/server/admin-db";
import { authDb, getCurrentUser } from "@/server/auth-db";
import { safeNext } from "./safe-next";

export interface LoginState {
  status: "idle" | "sent" | "error";
  message?: string;
}

const loginSchema = z.object({ email: z.email().max(254), next: z.string().max(500).optional() });

/** ตรวจกับ Supabase ว่าเปิดผู้ให้บริการนี้แล้วหรือยัง — กันผู้ใช้เจอหน้า JSON error ดิบ ๆ ของ Supabase */
async function isProviderEnabled(provider: "google"): Promise<boolean> {
  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.[provider] === true;
  } catch {
    return false;
  }
}

/**
 * ล็อกอิน/สมัครด้วย Google — ให้ Google ยืนยันตัวตน เราไม่เก็บรหัสผ่านและไม่ต้องยืนยันอีเมลเอง
 * ขอเฉพาะข้อมูลพื้นฐาน (ชื่อ อีเมล รูป) ใช้ PKCE: ผู้ใช้กลับมาที่ /auth/callback พร้อม code
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next")?.toString());
  if (!(await isProviderEnabled("google"))) redirect("/login?error=provider");

  const db = await authDb();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" }, // ให้เลือกบัญชีเสมอ (เครื่องที่ใช้หลายบัญชี Google)
    },
  });
  if (error || !data.url) {
    console.error("signInWithGoogle:", error?.message ?? "no url");
    redirect("/login?error=provider");
  }
  redirect(data.url);
}

/** ส่งลิงก์เข้าสู่ระบบ (magic link) ไปที่อีเมล — ใช้ทั้งสมัครและล็อกอิน (ปิดอยู่ถ้า EMAIL_LOGIN_ENABLED=false) */
export async function requestLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!getFlags().emailLoginEnabled) {
    return { status: "error", message: "ยังไม่เปิดให้เข้าสู่ระบบด้วยอีเมล กรุณาใช้ Google" };
  }
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    next: formData.get("next")?.toString() || undefined,
  });
  if (!parsed.success) return { status: "error", message: "กรุณากรอกอีเมลให้ถูกต้อง" };

  const next = safeNext(parsed.data.next);
  const db = await authDb();
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: getFlags().signupEnabled,
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      return { status: "error", message: "ส่งอีเมลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" };
    }
    // ปิดรับสมัครและไม่มีบัญชีนี้ → ตอบเหมือนสำเร็จ ไม่เปิดเผยว่าอีเมลนี้มีบัญชีอยู่หรือไม่
    if (/signups? not allowed/i.test(error.message)) return { status: "sent" };
    console.error("requestLoginLink:", error.message);
    return { status: "error", message: "ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  return { status: "sent" };
}

export async function signOut() {
  const db = await authDb();
  await db.auth.signOut();
  redirect("/");
}

/**
 * ลบบัญชีและข้อมูลทั้งหมดของผู้ใช้ (PDPA) — ลบ auth.users แล้ว FK cascade ลบ
 * โปรไฟล์ ความคืบหน้า เรื่องที่ชอบ และข้อมูลสมาชิกตามไปทั้งหมด
 * TODO(เฟส 7): ยกเลิกการสมัครสมาชิกใน Stripe ก่อนลบ ไม่งั้นจะถูกเรียกเก็บเงินต่อ
 */
export async function deleteAccount(formData: FormData) {
  if (formData.get("confirm") !== "on") redirect("/account?error=confirm");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const { error } = await adminDb().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteAccount:", error.message);
    redirect("/account?error=failed");
  }

  try {
    await (await authDb()).auth.signOut({ scope: "local" }); // เคลียร์ cookie (บัญชีหายไปแล้ว)
  } catch {
    /* ไม่เป็นไร: cookie จะใช้ไม่ได้อยู่แล้ว */
  }
  redirect("/?deleted=1");
}
