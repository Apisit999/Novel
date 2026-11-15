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
  scheduledPast: randomUUID(), // ตั้งเวลาไว้ และเลยเวลาแล้ว → ต้องมองเห็น
  scheduledFuture: randomUUID(), // ตั้งเวลาไว้ ยังไม่ถึง → ต้องซ่อน
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

const FREE_ONLY = ["freeInherit", "premButFreeEp", "scheduledPast"].sort();
const ALL_PUBLISHED = [
  "freeInherit",
  "freeButPremiumEp",
  "premInherit",
  "premButFreeEp",
  "scheduledPast",
].sort();
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
    // ตั้งเวลา: ต้องระบุ publish_at (มี constraint) — เลยเวลาแล้ว vs ยังไม่ถึง
    for (const [id, n, when] of [
      [ep.scheduledPast, 4, "now() - interval '1 hour'"],
      [ep.scheduledFuture, 5, "now() + interval '1 hour'"],
    ] as const) {
      await db.query(
        `insert into episodes (id, title_id, number, name, access, status, publish_at)
         values ($1, $2, $3, 'ep', 'inherit', 'scheduled', ${when})`,
        [id, free, n],
      );
    }
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
    it("ตอนที่ตั้งเวลา: เลยเวลาแล้วเห็น ยังไม่ถึงไม่เห็น (แอดมินเห็นทั้งหมด)", async () => {
      const visible = async (who: Who) =>
        (
          await as(who, () =>
            db.query(`select id from episodes where id = any($1::uuid[])`, [
              [ep.scheduledPast, ep.scheduledFuture],
            ]),
          )
        ).rows.map((r) => r.id);
      expect(await visible("anon")).toEqual([ep.scheduledPast]);
      expect((await visible("admin")).sort()).toEqual(
        [ep.scheduledPast, ep.scheduledFuture].sort(),
      );
    });
    it("ตั้งสถานะ scheduled โดยไม่ระบุเวลาไม่ได้ (constraint)", async () => {
      await db.query("savepoint s");
      await expect(
        db.query(
          `insert into episodes (title_id, number, name, status) select id, 99, 'x', 'scheduled' from titles where slug = $1`,
          [`rls-free-${tag}`],
        ),
      ).rejects.toThrow(/episodes_scheduled_needs_time/);
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

  describe("บัคเก็ตรูปมังงะ (Storage) ใช้สิทธิ์เดียวกับ can_access", () => {
    const prefix = `rls-${tag}`;
    // ตอนที่ให้มีรูป: ฟรี / ฟรีแต่ตอน premium / เรื่อง premium / draft
    const withImage = ["freeInherit", "freeButPremiumEp", "premInherit", "draft"] as const;

    beforeAll(async () => {
      await setPaywall(true);
      for (const k of withImage) {
        const key = `${prefix}/${k}.webp`;
        await db.query(
          `insert into manga_pages (episode_id, page_no, image_key) values ($1, 1, $2)`,
          [ep[k], key],
        );
        await db.query(`insert into storage.objects (bucket_id, name) values ('manga', $1)`, [key]);
      }
      // ไฟล์ที่ไม่ผูกกับหน้าใดเลย (กำพร้า) ต้องไม่เห็น ยกเว้นแอดมิน
      await db.query(`insert into storage.objects (bucket_id, name) values ('manga', $1)`, [
        `${prefix}/orphan.webp`,
      ]);
    });

    const objects = (who: Who) =>
      as(who, async () => {
        const r = await db.query(
          `select name from storage.objects where bucket_id = 'manga' and name like $1`,
          [`${prefix}/%`],
        );
        return r.rows
          .map((x) => (x.name as string).slice(prefix.length + 1, -".webp".length))
          .sort();
      });

    it("ผู้เยี่ยมชมเห็นรูปเฉพาะตอนฟรี (premium/draft/กำพร้า ไม่เห็น)", async () => {
      expect(await objects("anon")).toEqual(["freeInherit"]);
    });
    it("สมาชิกเห็นรูปตอนที่เผยแพร่ทั้งหมด แต่ไม่เห็น draft", async () => {
      expect(await objects("subActive")).toEqual(
        ["freeButPremiumEp", "freeInherit", "premInherit"].sort(),
      );
    });
    it("สมาชิกที่หมดอายุเห็นเฉพาะตอนฟรี", async () => {
      expect(await objects("subCanceledExpired")).toEqual(["freeInherit"]);
    });
    it("แอดมินเห็นทุกไฟล์ รวม draft และไฟล์กำพร้า", async () => {
      expect(await objects("admin")).toEqual(
        ["draft", "freeButPremiumEp", "freeInherit", "orphan", "premInherit"].sort(),
      );
    });
    it("paywall ปิด: ผู้เยี่ยมชมเห็นรูปตอนที่เผยแพร่ทั้งหมด (draft/กำพร้า ยังไม่เห็น)", async () => {
      await setPaywall(false);
      expect(await objects("anon")).toEqual(
        ["freeButPremiumEp", "freeInherit", "premInherit"].sort(),
      );
      await setPaywall(true);
    });
    it("ผู้ใช้ทั่วไปอัปโหลดไฟล์ไม่ได้ (เฉพาะแอดมิน)", async () => {
      await db.query("savepoint s");
      await expect(
        as("user", () =>
          db.query(`insert into storage.objects (bucket_id, name) values ('manga', $1)`, [
            `${prefix}/hack.webp`,
          ]),
        ),
      ).rejects.toThrow(/row-level security|permission denied/);
      await db.query("rollback to savepoint s");

      // (การลบทำผ่าน Storage API เท่านั้น — Supabase ห้ามลบตารางจัดเก็บด้วย SQL ตรง ๆ จึงทดสอบใน e2e หลังบ้าน)
      expect(await objects("admin")).toHaveLength(5);
    });
    it("ผู้ดูแลอัปโหลดได้", async () => {
      await as("admin", () =>
        db.query(`insert into storage.objects (bucket_id, name) values ('manga', $1)`, [
          `${prefix}/ok.webp`,
        ]),
      );
      expect(await objects("admin")).toContain("ok");
    });
  });

  describe("โปรไฟล์ตอนสมัคร (trigger)", () => {
    const profileOf = async (id: string) =>
      (await db.query(`select display_name, avatar_url from profiles where id = $1`, [id])).rows[0];
    const signup = (id: string, email: string, meta: object) =>
      db.query(
        `insert into auth.users (id, aud, role, email, raw_user_meta_data)
         values ($1, 'authenticated', 'authenticated', $2, $3::jsonb)`,
        [id, email, JSON.stringify(meta)],
      );

    it("สมัครด้วย Google: ใช้ชื่อเต็มและรูปจาก Google", async () => {
      const id = randomUUID();
      await signup(id, `g-${tag}@test.invalid`, {
        full_name: "สมชาย ใจดี",
        avatar_url: "https://lh3.googleusercontent.com/a/example",
      });
      expect(await profileOf(id)).toEqual({
        display_name: "สมชาย ใจดี",
        avatar_url: "https://lh3.googleusercontent.com/a/example",
      });
    });
    it("ผู้ให้บริการที่ส่งเป็น name/picture ก็ใช้ได้", async () => {
      const id = randomUUID();
      await signup(id, `p-${tag}@test.invalid`, { name: "Jane", picture: "https://x.test/p.png" });
      expect(await profileOf(id)).toEqual({
        display_name: "Jane",
        avatar_url: "https://x.test/p.png",
      });
    });
    it("สมัครด้วยอีเมลล้วน: ใช้ชื่อหน้า @ และไม่มีรูป", async () => {
      const id = randomUUID();
      await signup(id, `plain-${tag}@test.invalid`, {});
      expect(await profileOf(id)).toEqual({ display_name: `plain-${tag}`, avatar_url: null });
    });
    it("ค่าว่างจากผู้ให้บริการไม่ทับชื่อสำรอง", async () => {
      const id = randomUUID();
      await signup(id, `empty-${tag}@test.invalid`, { full_name: "", avatar_url: "" });
      expect(await profileOf(id)).toEqual({ display_name: `empty-${tag}`, avatar_url: null });
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

  describe("หน้าแรกอัตโนมัติ (home_sections / home_pins / collections / ยอดรายวัน)", () => {
    const mk = async (slug: string, published: boolean) =>
      (
        await db.query(
          `insert into titles (type, slug, name, access, published)
           values ('novel', $1, $1, 'free', $2) returning id`,
          [`home-${slug}-${tag}`, published],
        )
      ).rows[0].id as string;

    const titlesOf = async (who: Who, table: string, col = "title") =>
      as(who, async () => {
        const r = await db.query(`select ${col} from ${table} where ${col} like $1`, [`%${tag}`]);
        return r.rows.map((x) => x[col] as string).sort();
      });

    it("ผู้เยี่ยมชมเห็นเฉพาะส่วนที่เปิดอยู่และอยู่ในช่วงเวลา; แอดมินเห็นทั้งหมด", async () => {
      const add = (name: string, enabled: boolean, start: string, end: string) =>
        db.query(
          `insert into home_sections (kind, title, enabled, starts_at, ends_at, config)
           values ('latest', $1, $2, ${start}, ${end}, '{}'::jsonb)`,
          [`${name}-${tag}`, enabled],
        );
      await add("on", true, "null", "null");
      await add("off", false, "null", "null");
      await add("future", true, "now() + interval '1 day'", "null");
      await add("expired", true, "null", "now() - interval '1 day'");
      await add("window", true, "now() - interval '1 day'", "now() + interval '1 day'");

      expect(await titlesOf("anon", "home_sections")).toEqual([`on-${tag}`, `window-${tag}`]);
      expect(await titlesOf("user", "home_sections")).toEqual([`on-${tag}`, `window-${tag}`]);
      expect((await titlesOf("admin", "home_sections")).length).toBe(5);
    });

    it("ผู้ใช้ทั่วไป/ผู้เยี่ยมชม เขียนส่วนของหน้าแรกไม่ได้", async () => {
      for (const who of ["anon", "user"] as const) {
        await expect(
          as(who, () =>
            db.query(`insert into home_sections (kind, title) values ('latest', 'hack-${tag}')`),
          ),
        ).rejects.toThrow();
      }
      // แก้/ลบ: ไม่ error แต่ไม่มีแถวใดถูกกระทบ (RLS กรองออก)
      const upd = await as("user", () =>
        db.query(`update home_sections set enabled = false where title = $1`, [`on-${tag}`]),
      );
      expect(upd.rowCount).toBe(0);
      const del = await as("user", () =>
        db.query(`delete from home_sections where title = $1`, [`on-${tag}`]),
      );
      expect(del.rowCount).toBe(0);
      expect(await titlesOf("admin", "home_sections")).toContain(`on-${tag}`);
    });

    it("kind ที่ไม่รู้จักถูกฐานข้อมูลปฏิเสธ", async () => {
      await expect(
        as("admin", () => db.query(`insert into home_sections (kind) values ('evil')`)),
      ).rejects.toThrow();
    });

    it("การปัก: ผู้เยี่ยมชมเห็นเฉพาะที่อยู่ในช่วงเวลาและของเรื่องที่เผยแพร่แล้ว", async () => {
      const pub = await mk("pin-pub", true);
      const hid = await mk("pin-hid", false);
      const pin = (t: string, note: string, start: string, end: string) =>
        db.query(
          `insert into home_pins (title_id, placement, note, starts_at, ends_at)
           values ($1, 'spotlight', $2, ${start}, ${end})`,
          [t, `${note}-${tag}`],
        );
      await pin(pub, "active", "null", "null");
      await pin(pub, "future", "now() + interval '1 day'", "null");
      await pin(pub, "expired", "null", "now() - interval '1 day'");
      await pin(hid, "unpublished", "null", "null");

      expect(await titlesOf("anon", "home_pins", "note")).toEqual([`active-${tag}`]);
      expect((await titlesOf("admin", "home_pins", "note")).length).toBe(4);
      await expect(
        as("user", () =>
          db.query(`insert into home_pins (title_id, placement) values ($1, 'hidden')`, [pub]),
        ),
      ).rejects.toThrow();
    });

    it("ชุดคัดสรร: ชุดที่ซ่อนมองไม่เห็น และรายการแสดงเฉพาะเรื่องที่เผยแพร่", async () => {
      const pub = await mk("col-pub", true);
      const hid = await mk("col-hid", false);
      const col = async (slug: string, published: boolean) =>
        (
          await db.query(
            `insert into collections (slug, title, published) values ($1, $1, $2) returning id`,
            [`col-${slug}-${tag}`, published],
          )
        ).rows[0].id as string;
      const shown = await col("shown", true);
      const secret = await col("secret", false);
      for (const [c, t] of [
        [shown, pub],
        [shown, hid],
        [secret, pub],
      ]) {
        await db.query(`insert into collection_items (collection_id, title_id) values ($1, $2)`, [
          c,
          t,
        ]);
      }

      expect(await titlesOf("anon", "collections")).toEqual([`col-shown-${tag}`]);
      expect((await titlesOf("admin", "collections")).length).toBe(2);

      const items = (who: Who) =>
        as(who, async () => {
          const r = await db.query(
            `select collection_id, title_id from collection_items where collection_id = any($1::uuid[])`,
            [[shown, secret]],
          );
          return r.rows
            .map(
              (x) =>
                `${x.collection_id === shown ? "shown" : "secret"}:${x.title_id === pub ? "pub" : "hid"}`,
            )
            .sort();
        });
      expect(await items("anon")).toEqual(["shown:pub"]); // ชุดซ่อน/เรื่องไม่เผยแพร่ ไม่โผล่
      expect((await items("admin")).length).toBe(3);
      await expect(
        as("user", () =>
          db.query(`insert into collections (slug, title) values ('x-${tag}', 'x')`),
        ),
      ).rejects.toThrow();
    });

    it("ยอดรายวัน: อ่านได้เฉพาะเรื่องที่เผยแพร่; นับยอดเรียกได้เฉพาะ service role", async () => {
      const pub = await mk("views-pub", true);
      const hid = await mk("views-hid", false);
      // record_title_view ไม่นับเรื่องที่ไม่เผยแพร่ และนับทั้งยอดสะสมและรายวัน
      await db.query(`select record_title_view($1)`, [`home-views-pub-${tag}`]);
      await db.query(`select record_title_view($1)`, [`home-views-pub-${tag}`]);
      await db.query(`select record_title_view($1)`, [`home-views-hid-${tag}`]);
      const total = await db.query(`select view_count from title_views where title_id = $1`, [pub]);
      expect(total.rows[0].view_count).toBe("2");
      const daily = await db.query(`select view_count from title_views_daily where title_id = $1`, [
        pub,
      ]);
      expect(daily.rows).toEqual([{ view_count: 2 }]);
      expect(
        (await db.query(`select 1 from title_views_daily where title_id = $1`, [hid])).rowCount,
      ).toBe(0);

      const seen = (who: Who) =>
        as(
          who,
          async () =>
            (
              await db.query(
                `select title_id from title_views_daily where title_id = any($1::uuid[])`,
                [[pub, hid]],
              )
            ).rows.length,
        );
      expect(await seen("anon")).toBe(1);

      for (const who of ["anon", "user"] as const) {
        await expect(
          as(who, () => db.query(`select record_title_view($1)`, [`home-views-pub-${tag}`])),
        ).rejects.toThrow();
      }
    });
  });
});
