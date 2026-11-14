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
  await admin().auth.admin.deleteUser(id); // ไม่พบแล้ว (เทสต์ลบเองไปแล้ว) ก็ไม่เป็นไร
}

export const callbackUrl = (u: TestUser, next = "/library") =>
  `/auth/callback?token_hash=${u.tokenHash}&type=${u.linkType}&next=${encodeURIComponent(next)}`;
