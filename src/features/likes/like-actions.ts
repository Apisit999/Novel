"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { authDb, getCurrentUser } from "@/server/auth-db";

/** สถานะไลก์ของตอนหนึ่งสำหรับผู้ดูคนนี้ */
export interface LikeState {
  count: number;
  liked: boolean;
  /** false = ยังไม่ล็อกอิน (กดไลก์ไม่ได้) */
  signedIn: boolean;
}

const input = z.object({ slug: z.string().min(1).max(200), number: z.number().int().positive() });

async function read(slug: string, number: number): Promise<LikeState> {
  const user = await getCurrentUser();
  const db = await authDb();
  const counts = await db.rpc("episode_like_counts", { p_slug: slug });
  const count = Number(counts.data?.find((r) => r.number === number)?.likes ?? 0);
  if (!user) return { count, liked: false, signedIn: false };

  const ep = await db
    .from("episodes")
    .select("id, titles!inner(slug)")
    .eq("titles.slug", slug)
    .eq("number", number)
    .maybeSingle();
  if (!ep.data) return { count, liked: false, signedIn: true };
  const mine = await db
    .from("episode_likes")
    .select("episode_id")
    .eq("episode_id", ep.data.id)
    .eq("user_id", user.id)
    .maybeSingle();
  return { count, liked: Boolean(mine.data), signedIn: true };
}

export async function getLikeState(rawSlug: string, rawNumber: number): Promise<LikeState> {
  const p = input.safeParse({ slug: rawSlug, number: rawNumber });
  if (!p.success) return { count: 0, liked: false, signedIn: false };
  return read(p.data.slug, p.data.number);
}

/** กด/ยกเลิกไลก์ (ต้องล็อกอิน) คืนสถานะล่าสุด — ผ่าน RLS: แตะได้เฉพาะแถวของตัวเอง และเฉพาะตอนที่มองเห็น */
export async function setEpisodeLike(
  rawSlug: string,
  rawNumber: number,
  on: boolean,
): Promise<LikeState> {
  const p = input.safeParse({ slug: rawSlug, number: rawNumber });
  if (!p.success) return { count: 0, liked: false, signedIn: false };
  const user = await getCurrentUser();
  if (!user) return read(p.data.slug, p.data.number);

  const db = await authDb();
  const ep = await db
    .from("episodes")
    .select("id, titles!inner(slug)")
    .eq("titles.slug", p.data.slug)
    .eq("number", p.data.number)
    .maybeSingle();
  if (ep.data) {
    if (on) {
      await db.from("episode_likes").upsert([{ user_id: user.id, episode_id: ep.data.id }], {
        onConflict: "user_id,episode_id",
        ignoreDuplicates: true,
      });
    } else {
      await db.from("episode_likes").delete().eq("user_id", user.id).eq("episode_id", ep.data.id);
    }
    updateTag("likes"); // รายการตอนในหน้าเรื่องเห็นยอดใหม่ทันที
  }
  return read(p.data.slug, p.data.number);
}
