"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createUploadTargets, removeObjects, VIDEO_BUCKET } from "@/server/storage";
import { requireAdmin } from "./guard";

const uuid = z.string().uuid();
const videoExtSchema = z.enum(["mp4", "webm"]);

/** ตอนต้องเป็นของเรื่องประเภทวิดีโอ — คืน titleId ถ้าใช่ */
async function videoEpisodeOwner(
  db: Awaited<ReturnType<typeof requireAdmin>>["db"],
  episodeId: string,
) {
  const { data } = await db
    .from("episodes")
    .select("title_id, titles!inner(type)")
    .eq("id", episodeId)
    .maybeSingle();
  return data && data.titles.type === "video" ? data.title_id : null;
}

/** ขอลิงก์อัปโหลดไฟล์วิดีโอ 1 ไฟล์ (เบราว์เซอร์อัปโหลดตรงไป Storage) */
export async function requestVideoUpload(
  rawEpisodeId: string,
  rawExt: string,
): Promise<{ key: string; token: string }> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const ext = videoExtSchema.parse(rawExt);
  const titleId = await videoEpisodeOwner(db, episodeId);
  if (!titleId) throw new Error("ตอนนี้ไม่ใช่วิดีโอ");
  const key = `${titleId}/${episodeId}/${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${ext}`;
  const [target] = await createUploadTargets(db, [key], VIDEO_BUCKET);
  return target;
}

/** ผูกไฟล์ที่อัปโหลดเสร็จกับตอน (แทนไฟล์เดิมถ้ามี แล้วลบไฟล์เดิมทิ้ง) */
export async function registerVideo(
  rawEpisodeId: string,
  rawKey: string,
  rawDuration: number | null,
): Promise<void> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const key = z.string().min(1).max(300).parse(rawKey);
  const duration = z.number().int().positive().max(86_400).nullable().parse(rawDuration);
  const titleId = await videoEpisodeOwner(db, episodeId);
  if (!titleId) throw new Error("ตอนนี้ไม่ใช่วิดีโอ");
  if (!key.startsWith(`${titleId}/${episodeId}/`) || key.includes("..")) {
    throw new Error("คีย์ไฟล์ไม่ถูกต้อง");
  }

  const old = await db
    .from("video_assets")
    .select("stream_uid")
    .eq("episode_id", episodeId)
    .maybeSingle();
  const { error } = await db
    .from("video_assets")
    .upsert({ episode_id: episodeId, stream_uid: key, duration_sec: duration, ready: true });
  if (error) throw new Error(`บันทึกวิดีโอไม่สำเร็จ: ${error.message}`);
  if (old.data && old.data.stream_uid !== key) {
    await removeObjects(db, [old.data.stream_uid], VIDEO_BUCKET);
  }
}

export async function deleteVideo(rawEpisodeId: string): Promise<void> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const old = await db
    .from("video_assets")
    .select("stream_uid")
    .eq("episode_id", episodeId)
    .maybeSingle();
  if (!old.data) return;
  await db.from("video_assets").delete().eq("episode_id", episodeId);
  await removeObjects(db, [old.data.stream_uid], VIDEO_BUCKET);
}
