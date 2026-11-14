import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
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
  return { user, db };
});
