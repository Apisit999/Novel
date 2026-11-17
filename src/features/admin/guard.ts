import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { adminMfaGate } from "@/features/auth/mfa-gate";
import { getFlags } from "@/lib/flags";
import { authDb, getCurrentUser } from "@/server/auth-db";

/**
 * ด่านเข้าหลังบ้าน — เรียกที่ต้นของ "ทุกหน้าและทุก action" ของแอดมิน (ห้ามพึ่ง layout อย่างเดียว
 * เพราะ Server Action เรียกตรงได้โดยไม่ผ่านหน้า)
 * - ยังไม่ล็อกอิน → ไปหน้าล็อกอิน
 * - ล็อกอินแล้วแต่ไม่ใช่แอดมิน → 404 (ไม่เปิดเผยว่ามีหลังบ้านอยู่)
 * (จำผลไว้ต่อหนึ่งคำขอ — layout กับหน้าเรียกซ้ำได้โดยไม่คิวรีซ้ำ)
 * ชั้นที่สองคือ RLS ในฐานข้อมูล: ต่อให้ข้ามด่านนี้ได้ ผู้ใช้ทั่วไปก็แก้ตารางไม่ได้ (policy *_admin)
 */
export const requireAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");

  const db = await authDb();
  const { data } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") notFound();

  // ยืนยันสองขั้น (เปิดด้วย ADMIN_REQUIRE_MFA=true): บัญชี Google ถูกยึดเมื่อไหร่ก็เข้าหลังบ้านไม่ได้ถ้าไม่มีแอปยืนยัน
  if (getFlags().adminRequireMfa) {
    const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    const gate = adminMfaGate(true, aal?.currentLevel, aal?.nextLevel);
    if (gate !== "ok") redirect(`/account/security?${gate}=1&next=/admin`);
  }
  return { user, db };
});
