"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { removeObjects, VIDEO_BUCKET } from "@/server/storage";
import { schedulePublishAt, validScheduleOptions } from "@/features/import/schedule";
import { requireAdmin } from "./guard";
import { thaiLocalToIso } from "./schemas";

const MAX_IDS = 1000;
const CHUNK = 100; // จำกัดจำนวน id ต่อคำสั่ง (ความยาว URL ของ PostgREST)

const opSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status"), status: z.enum(["draft", "published"]) }),
  z.object({
    kind: z.literal("schedule"),
    startDate: z.string(),
    time: z.string(),
    perDay: z.number().int().min(1).max(100),
  }),
  z.object({ kind: z.literal("access"), access: z.enum(["inherit", "free", "premium"]) }),
  z.object({ kind: z.literal("delete") }),
]);

const inputSchema = z.object({
  titleId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(MAX_IDS),
  op: opSchema,
});

export type BulkOp = z.infer<typeof opSchema>;
export interface BulkResult {
  /** จำนวนตอนที่จัดการสำเร็จ */
  done: number;
  error?: string;
}

const chunks = <T>(xs: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * จัดการหลายตอนพร้อมกัน (เผยแพร่/ฉบับร่าง/ตั้งเวลาทยอยลง/เปลี่ยนสิทธิ์/ลบ) — เฉพาะแอดมิน
 * ใช้เฉพาะตอนที่เป็นของเรื่องนี้จริง (กรองตาม title_id ก่อนเสมอ กันส่ง id ของเรื่องอื่นมา)
 */
export async function bulkUpdateEpisodes(raw: unknown): Promise<BulkResult> {
  const { db } = await requireAdmin();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { done: 0, error: "ข้อมูลไม่ถูกต้อง" };
  const { titleId, ids, op } = parsed.data;

  // เอาเฉพาะ id ที่อยู่ในเรื่องนี้ (เรียงตามเลขตอน — ใช้ลำดับนี้ตอนตั้งเวลาทยอยลง)
  const owned: { id: string; number: number }[] = [];
  for (const part of chunks([...new Set(ids)], CHUNK)) {
    const { data, error } = await db
      .from("episodes")
      .select("id, number")
      .eq("title_id", titleId)
      .in("id", part);
    if (error) return { done: 0, error: "อ่านรายการตอนไม่สำเร็จ" };
    owned.push(...data);
  }
  owned.sort((a, b) => a.number - b.number);
  if (owned.length === 0) return { done: 0, error: "ไม่พบตอนที่เลือกในเรื่องนี้" };
  const ownedIds = owned.map((e) => e.id);

  const fail = (what: string, e: { message: string }): BulkResult => {
    console.error(`admin bulk ${op.kind}:`, e.message);
    return { done: 0, error: `${what}ไม่สำเร็จ กรุณาลองใหม่` };
  };

  if (op.kind === "status") {
    for (const part of chunks(ownedIds, CHUNK)) {
      const { error } = await db
        .from("episodes")
        .update({ status: op.status, publish_at: null })
        .in("id", part);
      if (error) return fail("เปลี่ยนสถานะ", error);
    }
  } else if (op.kind === "access") {
    for (const part of chunks(ownedIds, CHUNK)) {
      const { error } = await db.from("episodes").update({ access: op.access }).in("id", part);
      if (error) return fail("เปลี่ยนสิทธิ์", error);
    }
  } else if (op.kind === "schedule") {
    if (!validScheduleOptions(op)) return { done: 0, error: "วันที่หรือเวลาไม่ถูกต้อง" };
    // ตอนที่เวลาเดียวกันอัปเดตพร้อมกันในคำสั่งเดียว (วันละ N ตอน → จำนวนคำสั่ง ≈ จำนวนตอน / N)
    const groups = new Map<string, string[]>();
    owned.forEach((e, i) => {
      const iso = thaiLocalToIso(schedulePublishAt(i, op));
      if (!iso) return;
      groups.set(iso, [...(groups.get(iso) ?? []), e.id]);
    });
    for (const [iso, groupIds] of groups) {
      for (const part of chunks(groupIds, CHUNK)) {
        const { error } = await db
          .from("episodes")
          .update({ status: "scheduled", publish_at: iso })
          .in("id", part);
        if (error) return fail("ตั้งเวลาเผยแพร่", error);
      }
    }
  } else {
    // ลบ: ไฟล์ของมังงะ/วิดีโอใน Storage ไม่ถูก cascade ตามแถว ต้องเก็บชื่อไฟล์ก่อนแล้วลบเอง
    const imageKeys: string[] = [];
    const videoKeys: string[] = [];
    for (const part of chunks(ownedIds, CHUNK)) {
      const pages = await db.from("manga_pages").select("image_key").in("episode_id", part);
      imageKeys.push(...(pages.data ?? []).map((p) => p.image_key));
      const video = await db.from("video_assets").select("stream_uid").in("episode_id", part);
      videoKeys.push(...(video.data ?? []).map((v) => v.stream_uid));
    }
    for (const part of chunks(ownedIds, CHUNK)) {
      const { error } = await db.from("episodes").delete().in("id", part);
      if (error) return fail("ลบตอน", error);
    }
    for (const part of chunks(imageKeys, CHUNK)) await removeObjects(db, part);
    for (const part of chunks(videoKeys, CHUNK)) await removeObjects(db, part, VIDEO_BUCKET);
  }

  updateTag("catalog");
  return { done: owned.length };
}
