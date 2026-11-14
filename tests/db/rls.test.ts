import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, dbConfig } from "./connect";

/**
 * ทดสอบ RLS + can_access() กับฐานข้อมูลจริง
 * - ทุกอย่างอยู่ในทรานแซกชันเดียว แล้ว ROLLBACK ตอนจบ → ไม่ทิ้งข้อมูลไว้
 * - จำลองผู้ใช้ด้วย `set local role` + jwt claims เหมือน PostgREST ทำ
 * ตารางผลลัพธ์ต้องตรงกับ canAccess() ใน src/features/access/can-access.ts
 */
const enabled = dbConfig() !== null;

let db: Client;
const ids = {
  admin: randomUUID(),
  user: randomUUID(),
  other: randomUUID(),
  subActive: randomUUID(),
  subCanceledValid: randomUUID(),
  subCanceledExpired: randomUUID(),
  subPastDue: randomUUID(),
};
const tag = randomUUID().slice(0, 8);
const ep = {
  freeInherit: randomUUID(), // เรื่องฟรี ตอน inherit
  freeButPremiumEp: randomUUID(), // เรื่องฟรี แต่ตอนตั้ง premium
  premInherit: randomUUID(), // เรื่อง premium ตอน inherit
  premButFreeEp: randomUUID(), // เรื่อง premium แต่ตอนตั้ง free
  unpublishedTitle: randomUUID(), // เรื่องยังไม่เผยแพร่
  draft: randomUUID(), // ตอน draft ในเรื่องฟรี
};
const allEpisodes = Object.values(ep);

type Who = keyof typeof ids | "anon";

/** รันคำสั่งในฐานะผู้ใช้ที่ระบุ แล้วคืนกลับเป็น postgres */
async function as<T>(who: Who, fn: () => Promise<T>): Promise<T> {
  const claims = who === "anon" ? "{}" : JSON.stringify({ sub: ids[who], role: "authenticated" });
  await db.query(`set local role ${who === "anon" ? "anon" : "authenticated"}`);
  await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  // savepoint: ถ้าคำสั่งถูกฐานข้อมูลปฏิเสธ (ซึ่งหลายเทสต์ตั้งใจให้เกิด) ทรานแซกชันจะไม่ค้างสถานะ aborted
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

async function readable(who: Who, table = "novel_bodies"): Promise<string[]> {
  return as(who, async () => {
    const r = await db.query(`select episode_id from ${table} where episode_id = any($1::uuid[])`, [
      allEpisodes,
    ]);
    return r.rows.map((x) => x.episode_id as string);
  });
}

const names = (idsList: string[]) =>
  Object.entries(ep)
    .filter(([, id]) => idsList.includes(id))
    .map(([k]) => k)
    .sort();

const FREE_ONLY = ["freeInherit", "premButFreeEp"].sort();
const ALL_PUBLISHED = ["freeInherit", "freeButPremiumEp", "premInherit", "premButFreeEp"].sort();
const EVERYTHING = Object.keys(ep).sort();

async function setPaywall(on: boolean) {
  await db.query(`update app_settings set value = $1::jsonb where key = 'paywall_enabled'`, [
    JSON.stringify(on),
  ]);
}

describe.skipIf(!enabled)("RLS และ can_access (ฐานข้อมูลจริง)", () => {
  beforeAll(async () => {
    db = await connect();
    await db.query("begin");

    for (const [name, id] of Object.entries(ids)) {
      await db.query(
        `insert into auth.users (id, aud, role, email, raw_user_meta_data)
         values ($1, 'authenticated', 'authenticated', $2, '{}'::jsonb)`,
        [id, `rls-${name}-${tag}@test.invalid`],
      );
    }
    await db.query(`update profiles set role = 'admin' where id = $1`, [ids.admin]);

    const sub = (id: string, status: string, end: string) =>
      db.query(
        `insert into subscriptions (user_id, status, current_period_end) values ($1, $2, ${end})`,
        [id, status],
      );
    await sub(ids.subActive, "active", "now() + interval '30 days'");
    await sub(ids.subCanceledValid, "canceled", "now() + interval '5 days'");
    await sub(ids.subCanceledExpired, "canceled", "now() - interval '1 day'");
    await sub(ids.subPastDue, "past_due", "now() + interval '5 days'");

    const title = async (slug: string, access: string, published: boolean) =>
      (
        await db.query(
          `insert into titles (type, slug, name, access, published)
           values ('novel', $1, $1, $2, $3) returning id`,
          [`rls-${slug}-${tag}`, access, published],
        )
      ).rows[0].id as string;
    const free = await title("free", "free", true);
    const prem = await title("prem", "premium", true);
    const hidden = await title("hidden", "free", false);

    const episode = (
      id: string,
      titleId: string,
      n: number,
      access: string,
      status = "published",
    ) =>
      db.query(
        `insert into episodes (id, title_id, number, name, access, status) values ($1,$2,$3,'ep',$4,$5)`,
        [id, titleId, n, access, status],
      );
    await episode(ep.freeInherit, free, 1, "inherit");
    await episode(ep.freeButPremiumEp, free, 2, "premium");
    await episode(ep.draft, free, 3, "inherit", "draft");
    await episode(ep.premInherit, prem, 1, "inherit");
    await episode(ep.premButFreeEp, prem, 2, "free");
    await episode(ep.unpublishedTitle, hidden, 1, "inherit");
    for (const id of allEpisodes) {
      await db.query(`insert into novel_bodies (episode_id, body_markdown) values ($1, 'x')`, [id]);
      await db.query(
        `insert into novel_translations (episode_id, lang, body_markdown) values ($1, 'en', 'x')`,
        [id],
      );
    }
  });

  afterAll(async () => {
    await db.query("rollback");
    await db.end();
  });

  describe("paywall เปิด: เนื้อหาที่อ่านได้ตามบทบาท", () => {
    beforeAll(() => setPaywall(true));

    it("ผู้เยี่ยมชม เห็นเฉพาะตอนฟรี", async () => {
      expect(names(await readable("anon"))).toEqual(FREE_ONLY);
    });
    it("ผู้ใช้ทั่วไป (ไม่มีสมาชิก) เห็นเฉพาะตอนฟรี", async () => {
      expect(names(await readable("user"))).toEqual(FREE_ONLY);
    });
    it("สมาชิก active เห็นทุกตอนที่เผยแพร่ (ไม่เห็น draft/เรื่องที่ซ่อน)", async () => {
      expect(names(await readable("subActive"))).toEqual(ALL_PUBLISHED);
    });
    it("สมาชิกที่ยกเลิกแต่ยังไม่หมดรอบบิล ยังเห็นเหมือนสมาชิก", async () => {
      expect(names(await readable("subCanceledValid"))).toEqual(ALL_PUBLISHED);
    });
    it("สมาชิกที่ยกเลิกและหมดรอบบิลแล้ว เห็นเฉพาะตอนฟรี", async () => {
      expect(names(await readable("subCanceledExpired"))).toEqual(FREE_ONLY);
    });
    it("past_due ไม่ให้สิทธิ์", async () => {
      expect(names(await readable("subPastDue"))).toEqual(FREE_ONLY);
    });
    it("คำแปลใช้สิทธิ์เดียวกับเนื้อหาต้นฉบับ (ผู้เยี่ยมชมไม่เห็นคำแปลตอน premium)", async () => {
      expect(names(await readable("anon", "novel_translations"))).toEqual(FREE_ONLY);
      expect(names(await readable("subActive", "novel_translations"))).toEqual(ALL_PUBLISHED);
      expect(names(await readable("admin", "novel_translations"))).toEqual(EVERYTHING);
    });
    it("แอดมินเห็นทุกอย่าง รวม draft และเรื่องที่ยังไม่เผยแพร่", async () => {
      expect(names(await readable("admin"))).toEqual(EVERYTHING);
    });
  });

  describe("paywall ปิด (ช่วงเปิดฟรี)", () => {
    beforeAll(() => setPaywall(false));

    it("ผู้เยี่ยมชมเห็นทุกตอนที่เผยแพร่ แต่ไม่เห็น draft/เรื่องที่ซ่อน", async () => {
      expect(names(await readable("anon"))).toEqual(ALL_PUBLISHED);
    });
  });

  describe("fail-closed", () => {
    it("ถ้าแถว paywall_enabled หาย ให้ถือว่า paywall เปิด (premium ไม่รั่ว)", async () => {
      await db.query("savepoint s");
      await db.query(`delete from app_settings where key = 'paywall_enabled'`);
      expect(names(await readable("anon"))).toEqual(FREE_ONLY);
      await db.query("rollback to savepoint s");
    });
  });

  describe("แคตตาล็อก", () => {
    const visibleTitles = (who: Who) =>
      as(who, async () => {
        const r = await db.query(`select slug from titles where slug like $1`, [`rls-%-${tag}`]);
        return r.rows.map((x) => x.slug as string).sort();
      });

    it("ผู้เยี่ยมชมเห็นเฉพาะเรื่องที่เผยแพร่", async () => {
      expect(await visibleTitles("anon")).toEqual([`rls-free-${tag}`, `rls-prem-${tag}`]);
    });
    it("แอดมินเห็นเรื่องที่ยังไม่เผยแพร่ด้วย", async () => {
      expect(await visibleTitles("admin")).toHaveLength(3);
    });
    it("ผู้ใช้ทั่วไปสร้างเรื่องไม่ได้", async () => {
      await db.query("savepoint s");
      await expect(
        as("user", () =>
          db.query(`insert into titles (type, slug, name) values ('novel', 'hack-${tag}', 'x')`),
        ),
      ).rejects.toThrow(/row-level security|permission denied/);
      await db.query("rollback to savepoint s");
    });
    it("รายการตอนที่เป็น draft ผู้เยี่ยมชมไม่เห็น", async () => {
      const rows = await as("anon", () =>
        db.query(`select id from episodes where id = $1`, [ep.draft]),
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  describe("ข้อมูลผู้ใช้", () => {
    it("ผู้ใช้เขียน progress ของตัวเองได้ แต่เขียนแทนคนอื่นไม่ได้", async () => {
      await as("user", () =>
        db.query(`insert into progress (user_id, episode_id, position) values ($1, $2, 10)`, [
          ids.user,
          ep.freeInherit,
        ]),
      );
      await db.query("savepoint s");
      await expect(
        as("user", () =>
          db.query(`insert into progress (user_id, episode_id, position) values ($1, $2, 10)`, [
            ids.other,
            ep.freeInherit,
          ]),
        ),
      ).rejects.toThrow(/row-level security/);
      await db.query("rollback to savepoint s");
    });
    it("ผู้ใช้อื่นมองไม่เห็น progress ของเรา", async () => {
      const r = await as("other", () =>
        db.query(`select 1 from progress where user_id = $1`, [ids.user]),
      );
      expect(r.rowCount).toBe(0);
    });
    it("ผู้ใช้แก้ role ตัวเองเป็น admin ไม่ได้", async () => {
      await db.query("savepoint s");
      await expect(
        as("user", () => db.query(`update profiles set role = 'admin' where id = $1`, [ids.user])),
      ).rejects.toThrow(/permission denied/);
      await db.query("rollback to savepoint s");
    });
    it("ผู้ใช้เห็นสมาชิกของตัวเอง แต่ไม่เห็นของคนอื่น", async () => {
      const own = await as("subActive", () => db.query(`select 1 from subscriptions`));
      expect(own.rowCount).toBe(1);
      const none = await as("user", () => db.query(`select 1 from subscriptions`));
      expect(none.rowCount).toBe(0);
    });
    it("ผู้ใช้เขียน subscription ให้ตัวเองไม่ได้", async () => {
      await db.query("savepoint s");
      await expect(
        as("user", () =>
          db.query(`insert into subscriptions (user_id, status) values ($1, 'active')`, [ids.user]),
        ),
      ).rejects.toThrow(/row-level security|permission denied/);
      await db.query("rollback to savepoint s");
    });
    it("ผู้ใช้เห็นโปรไฟล์ตัวเอง แต่ไม่เห็นของคนอื่น", async () => {
      const r = await as("user", () => db.query(`select id from profiles`));
      expect(r.rows.map((x) => x.id)).toEqual([ids.user]);
    });
  });

  describe("การตั้งค่า", () => {
    it("ผู้ใช้ทั่วไปแก้สวิตช์ paywall ไม่ได้ (แก้แล้วไม่มีผล)", async () => {
      await setPaywall(true);
      await as("user", () =>
        db.query(`update app_settings set value = 'false'::jsonb where key = 'paywall_enabled'`),
      );
      const r = await db.query(`select value from app_settings where key = 'paywall_enabled'`);
      expect(r.rows[0].value).toBe(true);
    });
  });
});
