"use server";

import { z } from "zod";
import { authDb, getCurrentUser } from "@/server/auth-db";
import type { LibraryData } from "./types";

/**
 * ซิงก์ห้องสมุด (เรื่องที่ชอบ + ตำแหน่งอ่านค้าง) ระหว่างเครื่องกับบัญชี
 * ทุกคำสั่งทำในนามผู้ใช้ที่ล็อกอิน (ผ่าน RLS: แตะได้เฉพาะแถวของตัวเอง) ไม่ล็อกอิน → ไม่ทำอะไร
 * ฝั่งเบราว์เซอร์เป็นข้อมูลที่ผู้ใช้แก้ได้ จึงตรวจรูปแบบทุกค่าก่อนใช้
 */

const slug = z.string().min(1).max(200);
const percent = z.number().min(0).max(100);

const pushSchema = z.object({
  favorites: z.array(slug).max(500),
  progress: z
    .record(
      slug,
      z.object({ number: z.number().int().positive(), percent, updatedAt: z.number().int() }),
    )
    .refine((r) => Object.keys(r).length <= 500),
});

async function me() {
  const user = await getCurrentUser();
  return user ? { id: user.id, db: await authDb() } : null;
}

/** อ่านห้องสมุดของบัญชี (null = ยังไม่ล็อกอิน) */
export async function pullLibrary(): Promise<LibraryData | null> {
  const ctx = await me();
  if (!ctx) return null;

  const [bookmarks, progress] = await Promise.all([
    ctx.db.from("bookmarks").select("titles(slug)").order("created_at", { ascending: false }),
    ctx.db
      .from("progress")
      .select("position, updated_at, episodes(number, titles(slug))")
      .order("updated_at", { ascending: false }),
  ]);
  if (bookmarks.error || progress.error) {
    console.error("pullLibrary:", bookmarks.error?.message ?? progress.error?.message);
    return null;
  }

  const result: LibraryData = {
    favorites: bookmarks.data.flatMap((b) => (b.titles ? [b.titles.slug] : [])),
    progress: {},
  };
  for (const row of progress.data) {
    const s = row.episodes?.titles?.slug;
    if (!s || result.progress[s] || !row.episodes) continue; // เรียงใหม่→เก่า: ตัวแรกของแต่ละเรื่องคือล่าสุด
    result.progress[s] = {
      number: row.episodes.number,
      percent: Number(row.position),
      updatedAt: Date.parse(row.updated_at),
    };
  }
  return result;
}

/** รวมข้อมูลในเครื่องขึ้นบัญชี (ตอนล็อกอินครั้งแรกบนเครื่องนี้): ไม่ลบของเดิม, ความคืบหน้าฝั่งไหนใหม่กว่าชนะ */
export async function pushLibrary(input: LibraryData): Promise<void> {
  const parsed = pushSchema.safeParse(input);
  const ctx = await me();
  if (!parsed.success || !ctx) return;
  const { favorites, progress } = parsed.data;

  const slugs = [...new Set([...favorites, ...Object.keys(progress)])];
  if (slugs.length === 0) return;

  const titles = await ctx.db.from("titles").select("id, slug").in("slug", slugs);
  const titleId = new Map((titles.data ?? []).map((t) => [t.slug, t.id]));

  const bookmarkRows = favorites.flatMap((s) =>
    titleId.has(s) ? [{ user_id: ctx.id, title_id: titleId.get(s)! }] : [],
  );
  if (bookmarkRows.length > 0) {
    await ctx.db
      .from("bookmarks")
      .upsert(bookmarkRows, { onConflict: "user_id,title_id", ignoreDuplicates: true });
  }

  const progressSlugs = Object.keys(progress).filter((s) => titleId.has(s));
  if (progressSlugs.length === 0) return;
  const episodes = await ctx.db
    .from("episodes")
    .select("id, number, titles!inner(slug)")
    .in("titles.slug", progressSlugs);
  const episodeId = new Map(
    (episodes.data ?? []).map((e) => [`${e.titles.slug}#${e.number}`, e.id]),
  );

  const rows = progressSlugs.flatMap((s) => {
    const p = progress[s];
    const id = episodeId.get(`${s}#${p.number}`);
    return id
      ? [
          {
            user_id: ctx.id,
            episode_id: id,
            position: p.percent,
            completed: p.percent >= 98,
            updated_at: new Date(p.updatedAt).toISOString(),
          },
        ]
      : [];
  });
  if (rows.length === 0) return;

  // ฝั่งเซิร์ฟเวอร์ใหม่กว่า → ไม่ทับ
  const existing = await ctx.db
    .from("progress")
    .select("episode_id, updated_at")
    .in(
      "episode_id",
      rows.map((r) => r.episode_id),
    );
  const serverTime = new Map(
    (existing.data ?? []).map((e) => [e.episode_id, Date.parse(e.updated_at)]),
  );
  const toWrite = rows.filter(
    (r) => (serverTime.get(r.episode_id) ?? 0) < Date.parse(r.updated_at),
  );
  if (toWrite.length > 0) {
    await ctx.db.from("progress").upsert(toWrite, { onConflict: "user_id,episode_id" });
  }
}

export async function setFavoriteRemote(rawSlug: string, on: boolean): Promise<void> {
  const parsedSlug = slug.safeParse(rawSlug);
  const ctx = await me();
  if (!parsedSlug.success || !ctx) return;

  const title = await ctx.db.from("titles").select("id").eq("slug", parsedSlug.data).maybeSingle();
  if (!title.data) return;
  if (on) {
    await ctx.db.from("bookmarks").upsert([{ user_id: ctx.id, title_id: title.data.id }], {
      onConflict: "user_id,title_id",
      ignoreDuplicates: true,
    });
  } else {
    await ctx.db.from("bookmarks").delete().eq("user_id", ctx.id).eq("title_id", title.data.id);
  }
}

export async function recordProgressRemote(
  rawSlug: string,
  number: number,
  rawPercent: number,
): Promise<void> {
  const parsed = z
    .object({ slug, number: z.number().int().positive(), percent })
    .safeParse({ slug: rawSlug, number, percent: rawPercent });
  const ctx = await me();
  if (!parsed.success || !ctx) return;

  const ep = await ctx.db
    .from("episodes")
    .select("id, titles!inner(slug)")
    .eq("titles.slug", parsed.data.slug)
    .eq("number", parsed.data.number)
    .maybeSingle();
  if (!ep.data) return;

  await ctx.db.from("progress").upsert(
    [
      {
        user_id: ctx.id,
        episode_id: ep.data.id,
        position: parsed.data.percent,
        completed: parsed.data.percent >= 98,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id,episode_id" },
  );
}
