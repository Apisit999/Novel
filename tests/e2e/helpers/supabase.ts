import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** ค่าจาก process.env หรือ .env.local (Playwright ไม่โหลดไฟล์ .env ให้เอง) */
function env(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() || undefined;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");

/** ที่อยู่ Supabase ที่เทสต์ใช้ (ไว้ยิงตรงเพื่อตรวจ Storage) */
export const SUPABASE_URL = url ?? "";
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

/** เทสต์ที่ต้องสร้างผู้ใช้จริงจะถูกข้ามถ้าไม่มี service role key */
export const hasAdmin = Boolean(url && serviceKey);

export function admin() {
  return createClient(url!, serviceKey!, { auth: { persistSession: false } });
}

export interface TestUser {
  id: string;
  email: string;
  /** token_hash สำหรับ /auth/callback — เทียบเท่ากดลิงก์ในอีเมล โดยไม่ต้องส่งอีเมลจริง */
  tokenHash: string;
  /** ผู้ใช้ใหม่ได้ลิงก์ชนิด signup ผู้ใช้เดิมได้ magiclink — ต้องใช้ชนิดที่ Supabase ออกให้ */
  linkType: string;
}

/** สร้างผู้ใช้ทดสอบ + ลิงก์เข้าสู่ระบบ (ลบด้วย deleteUser ตอนจบเทสต์) */
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.invalid`;
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.user) throw new Error(`สร้างผู้ใช้ทดสอบไม่ได้: ${error?.message}`);
  return {
    id: data.user.id,
    email,
    tokenHash: data.properties.hashed_token,
    linkType: data.properties.verification_type,
  };
}

export async function deleteUser(id: string) {
  // ประวัติแอดมินเพิ่มได้อย่างเดียวและไม่ cascade (admin_id = set null) → เก็บกวาดแถวของผู้ใช้ทดสอบก่อนลบผู้ใช้
  await admin().from("admin_audit_log").delete().eq("admin_id", id);
  await admin().auth.admin.deleteUser(id); // ไม่พบแล้ว (เทสต์ลบเองไปแล้ว) ก็ไม่เป็นไร
}

export const callbackUrl = (u: TestUser, next = "/library") =>
  `/auth/callback?token_hash=${u.tokenHash}&type=${u.linkType}&next=${encodeURIComponent(next)}`;

/** ตั้งผู้ใช้ทดสอบเป็นแอดมิน (ทำผ่าน service role — เหมือนสคริปต์ make-admin) */
export async function makeAdmin(id: string) {
  const { error } = await admin().from("profiles").update({ role: "admin" }).eq("id", id);
  if (error) throw new Error(`ตั้งแอดมินไม่ได้: ${error.message}`);
}

/** เก็บกวาดเรื่องทดสอบ (ลบแล้ว FK cascade ลบตอน/เนื้อหา/คำแปลตามไปเอง) */
export async function deleteTitleBySlug(slug: string) {
  const db = admin();
  const t = await db.from("titles").select("id").eq("slug", slug).maybeSingle();
  const titleId = t.data?.id;
  if (titleId) {
    // ไฟล์ปกไม่ถูก cascade ตามฐานข้อมูล — ลบเอง
    const files = await db.storage.from("covers").list(titleId);
    if (files.data?.length) {
      await db.storage.from("covers").remove(files.data.map((f) => `${titleId}/${f.name}`));
    }
  }
  await db.from("titles").delete().eq("slug", slug);
}

/**
 * เคลียร์แคชข้อมูลของเว็บที่กำลังทดสอบ — จำเป็นหลังสร้างข้อมูลด้วย service role ตรง ๆ
 * (รายการเรื่องแคชไว้ 1 นาที; หลังบ้านเคลียร์ให้เองแต่การเขียนตรงไม่ผ่านหลังบ้าน)
 */
export async function revalidateCatalog() {
  const secret = env("REVALIDATE_SECRET");
  if (!secret) throw new Error("ไม่มี REVALIDATE_SECRET ใน .env.local / environment");
  const res = await fetch("http://localhost:3100/api/revalidate", {
    method: "POST",
    headers: { "x-revalidate-secret": secret },
  });
  if (!res.ok) throw new Error(`เคลียร์แคชไม่สำเร็จ: ${res.status}`);
}

export const REVALIDATE_SECRET = env("REVALIDATE_SECRET");

/** ไคลเอนต์ผู้เยี่ยมชม (anon key) — ไว้ตรวจว่าสิ่งที่ไม่ควรทำได้ ทำไม่ได้จริง */
export function anon() {
  return createClient(url!, env("NEXT_PUBLIC_SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
  });
}
