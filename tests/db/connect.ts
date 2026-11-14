import { existsSync, readFileSync } from "node:fs";
import { Client } from "pg";

/** อ่านค่าจาก process.env ก่อน ไม่มีค่อยดู .env.local (vitest ไม่โหลดให้เอง) */
function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (line.startsWith(`${key}=`)) {
      return (
        line
          .slice(key.length + 1)
          .trim()
          .replace(/^(["'])(.*)\1$/, "$2") || undefined
      );
    }
  }
  return undefined;
}

/**
 * ที่อยู่ฐานข้อมูลสำหรับเทสต์ (ลำดับ):
 * 1) SUPABASE_DB_URL — เช่นฐานข้อมูลในเครื่อง postgresql://postgres:postgres@127.0.0.1:54322/postgres
 * 2) โปรเจกต์ที่ `supabase link` ไว้ + SUPABASE_DB_PASSWORD
 * ไม่มีทั้งสองแบบ → คืน null แล้วเทสต์จะถูกข้าม (CI ที่ไม่มีฐานข้อมูลไม่พัง)
 */
export function dbConfig() {
  const url = envValue("SUPABASE_DB_URL");
  if (url) {
    return {
      connectionString: url,
      ssl: url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    };
  }

  const password = envValue("SUPABASE_DB_PASSWORD");
  if (!password || !existsSync("supabase/.temp/pooler-url")) return null;
  const u = new URL(readFileSync("supabase/.temp/pooler-url", "utf8").trim());
  return {
    host: u.hostname,
    port: Number(u.port),
    user: decodeURIComponent(u.username),
    password,
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  };
}

export async function connect(): Promise<Client> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("ไม่มีค่าเชื่อมต่อฐานข้อมูล");
  const client = new Client(cfg);
  await client.connect();
  return client;
}
