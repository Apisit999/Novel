import { readFileSync } from "node:fs";
import { admin, revalidateCatalog } from "./supabase";

/** วิดีโอ WebM สั้น ๆ ที่เบราว์เซอร์ทุกตัวในเทสต์เล่นได้ (สร้างด้วย MediaRecorder, ~3 KB) */
const TINY_WEBM = readFileSync("tests/e2e/helpers/tiny.webm");

export interface VideoFixture {
  slug: string;
  titleId: string;
  episodeIds: string[];
  keys: string[];
}

/** สร้างเรื่องวิดีโอทดสอบ: n ตอน (ตอนที่ withFile ตอนแรกมีไฟล์จริง ที่เหลือยังไม่มีไฟล์) */
export async function createVideoFixture(opts: {
  slug: string;
  episodes?: number;
  withFile?: number;
  episodeStatus?: "draft" | "published";
}): Promise<VideoFixture> {
  const db = admin();
  const title = await db
    .from("titles")
    .insert({ slug: opts.slug, name: "วิดีโอทดสอบ", type: "video", published: true })
    .select("id")
    .single();
  if (title.error) throw new Error(`สร้างเรื่องไม่ได้: ${title.error.message}`);

  const episodeIds: string[] = [];
  const keys: string[] = [];
  const n = opts.episodes ?? 2;
  const withFile = opts.withFile ?? n;
  for (let i = 1; i <= n; i++) {
    const ep = await db
      .from("episodes")
      .insert({
        title_id: title.data.id,
        number: i,
        name: `ตอนที่ ${i}`,
        status: opts.episodeStatus ?? "published",
      })
      .select("id")
      .single();
    if (ep.error) throw new Error(`สร้างตอนไม่ได้: ${ep.error.message}`);
    episodeIds.push(ep.data.id);
    if (i > withFile) continue;
    const key = `${title.data.id}/${ep.data.id}/fx-${i}.webm`;
    const up = await db.storage.from("video").upload(key, TINY_WEBM, { contentType: "video/webm" });
    if (up.error) throw new Error(`อัปโหลดวิดีโอไม่ได้: ${up.error.message}`);
    const row = await db
      .from("video_assets")
      .insert({ episode_id: ep.data.id, stream_uid: key, duration_sec: 3, ready: true });
    if (row.error) throw new Error(`บันทึกวิดีโอไม่ได้: ${row.error.message}`);
    keys.push(key);
  }
  await revalidateCatalog();
  return { slug: opts.slug, titleId: title.data.id, episodeIds, keys };
}

export async function deleteVideoFixture(slug: string) {
  const db = admin();
  const title = await db.from("titles").select("id").eq("slug", slug).maybeSingle();
  if (!title.data) return;
  const assets = await db
    .from("video_assets")
    .select("stream_uid, episodes!inner(title_id)")
    .eq("episodes.title_id", title.data.id);
  const keys = (assets.data ?? []).map((a) => a.stream_uid);
  if (keys.length) await db.storage.from("video").remove(keys);
  await db.from("titles").delete().eq("id", title.data.id);
}
