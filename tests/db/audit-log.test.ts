import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, dbConfig } from "./connect";

/**
 * ทดสอบตาราง admin_audit_log กับฐานข้อมูลจริง (ทรานแซกชันเดียว แล้ว ROLLBACK):
 * อ่าน/เพิ่มได้เฉพาะแอดมิน, ลงชื่อสวมรอยคนอื่นไม่ได้, แก้/ลบ/ล้างตารางไม่ได้แม้เป็นแอดมิน
 */
const enabled = dbConfig() !== null;

let db: Client;
const ids = { admin: randomUUID(), user: randomUUID(), otherAdmin: randomUUID() };
const tag = randomUUID().slice(0, 8);

type Who = keyof typeof ids | "anon";

async function as<T>(who: Who, fn: () => Promise<T>): Promise<T> {
  const claims = who === "anon" ? "{}" : JSON.stringify({ sub: ids[who], role: "authenticated" });
  await db.query(`set local role ${who === "anon" ? "anon" : "authenticated"}`);
  await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await db.query("savepoint as_user");
  try {
    const result = await fn();
    await db.query("release savepoint as_user");
    return result;
  } catch (e) {
    await db.query("rollback to savepoint as_user");
    throw e;
  } finally {
    await db.query("reset role");
  }
}

const insert = (admin: string, action: string) =>
  db.query(`insert into admin_audit_log (admin_id, action) values ($1, $2)`, [admin, action]);

describe.skipIf(!enabled)("admin_audit_log (RLS)", () => {
  beforeAll(async () => {
    db = await connect();
    await db.query("begin");
    for (const [name, id] of Object.entries(ids)) {
      await db.query(
        `insert into auth.users (id, aud, role, email, raw_user_meta_data)
         values ($1, 'authenticated', 'authenticated', $2, '{}'::jsonb)`,
        [id, `audit-${name}-${tag}@test.invalid`],
      );
    }
    await db.query(`update profiles set role = 'admin' where id = any($1::uuid[])`, [
      [ids.admin, ids.otherAdmin],
    ]);
  });
  afterAll(async () => {
    if (!db) return;
    await db.query("rollback");
    await db.end();
  });

  it("แอดมินเพิ่มบันทึกในชื่อตัวเองได้ และอ่านได้", async () => {
    await as("admin", () => insert(ids.admin, `test.write.${tag}`));
    const rows = await as(
      "admin",
      async () =>
        (
          await db.query(`select action from admin_audit_log where action = $1`, [
            `test.write.${tag}`,
          ])
        ).rows,
    );
    expect(rows).toHaveLength(1);
  });

  it("แอดมินลงชื่อเป็นคนอื่นไม่ได้ (สวมรอย)", async () => {
    await expect(as("admin", () => insert(ids.otherAdmin, `test.spoof.${tag}`))).rejects.toThrow();
  });

  it("ผู้ใช้ทั่วไปและผู้เยี่ยมชมเพิ่ม/อ่านไม่ได้", async () => {
    await expect(as("user", () => insert(ids.user, `test.user.${tag}`))).rejects.toThrow();
    const seen = async (who: Who) =>
      as(who, async () => (await db.query(`select id from admin_audit_log`)).rows.length);
    expect(await seen("user")).toBe(0);
    await expect(seen("anon")).rejects.toThrow(); // anon ไม่มีสิทธิ์ใช้ตารางเลย
  });

  it("แก้/ลบ/ล้างตารางไม่ได้แม้เป็นแอดมิน (เพิ่มได้อย่างเดียว)", async () => {
    await as("admin", () => insert(ids.admin, `test.immutable.${tag}`));
    await expect(
      as("admin", () =>
        db.query(`update admin_audit_log set action = 'x' where action like 'test.%'`),
      ),
    ).rejects.toThrow();
    await expect(
      as("admin", () => db.query(`delete from admin_audit_log where action like 'test.%'`)),
    ).rejects.toThrow();
    await expect(as("admin", () => db.query(`truncate admin_audit_log`))).rejects.toThrow();
  });
});
