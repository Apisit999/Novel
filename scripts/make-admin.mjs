// ตั้ง/ถอนสิทธิ์แอดมินให้ผู้ใช้ตามอีเมล (ต้องเคยล็อกอินเข้าเว็บอย่างน้อยหนึ่งครั้งแล้ว)
//   npm run make-admin -- someone@gmail.com          ตั้งเป็นแอดมิน
//   npm run make-admin -- someone@gmail.com --revoke  ถอนสิทธิ์
// ใช้ SUPABASE_SERVICE_ROLE_KEY จาก .env.local — รันบนเครื่องคุณเท่านั้น ห้ามเปิดเป็นหน้าเว็บ
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const [email, flag] = process.argv.slice(2);

if (!url || !key) {
  console.error("ไม่พบ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error("วิธีใช้: npm run make-admin -- อีเมล [--revoke]");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const target = email.trim().toLowerCase();

// หาผู้ใช้จากอีเมล (เดินทีละหน้า — โปรเจกต์ขนาดเล็กพอ)
let user;
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("อ่านรายชื่อผู้ใช้ไม่สำเร็จ:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === target);
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`ไม่พบผู้ใช้อีเมล ${target} — ให้ล็อกอินเข้าเว็บด้วยอีเมลนี้ก่อนหนึ่งครั้ง แล้วรันใหม่`);
  process.exit(1);
}

const role = flag === "--revoke" ? "user" : "admin";
const { error } = await db.from("profiles").update({ role }).eq("id", user.id);
if (error) {
  console.error("ตั้งสิทธิ์ไม่สำเร็จ:", error.message);
  process.exit(1);
}
console.log(`${target} → ${role === "admin" ? "เป็นแอดมินแล้ว" : "ถอนสิทธิ์แอดมินแล้ว"}`);
