"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { updateTag } from "next/cache";
import {
  createCoverUploadTarget,
  createUploadTargets,
  removeCover,
  removeObjects,
} from "@/server/storage";
import type { FormState } from "./actions";
import { requireAdmin } from "./guard";
import {
  imageExtSchema,
  MAX_PAGES_PER_BATCH,
  mangaEpisodeSchema,
  registerSchema,
} from "./manga-schemas";
import { thaiLocalToIso } from "./schemas";

const uuid = z.string().uuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

/** ตอนต้องเป็นของเรื่องประเภทมังงะ — คืน titleId ถ้าใช่ */
async function mangaEpisodeOwner(
  db: Awaited<ReturnType<typeof requireAdmin>>["db"],
  episodeId: string,
) {
  const { data } = await db
    .from("episodes")
    .select("title_id, titles!inner(type)")
    .eq("id", episodeId)
    .maybeSingle();
  return data && data.titles.type === "manga" ? data.title_id : null;
}

// ---------------------------------------------------------------- ตอนมังงะ

export async function saveMangaEpisode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();

  const titleId = uuid.safeParse(formData.get("titleId"));
  if (!titleId.success) return { error: "รหัสเรื่องไม่ถูกต้อง" };
  const episodeIdRaw = String(formData.get("episodeId") ?? "");
  const episodeId = episodeIdRaw ? uuid.safeParse(episodeIdRaw) : null;
  if (episodeId && !episodeId.success) return { error: "รหัสตอนไม่ถูกต้อง" };

  const parsed = mangaEpisodeSchema.safeParse({
    number: formData.get("number"),
    name: formData.get("name"),
    access: formData.get("access"),
    status: formData.get("status"),
    publishAt: String(formData.get("publishAt") ?? "") || undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const title = await db.from("titles").select("type").eq("id", titleId.data).maybeSingle();
  if (title.data?.type !== "manga") return { error: "เรื่องนี้ไม่ใช่มังงะ" };

  const publishAt = v.status === "scheduled" ? thaiLocalToIso(v.publishAt) : null;
  if (v.status === "scheduled" && !publishAt) return { error: "วันและเวลาเผยแพร่ไม่ถูกต้อง" };

  const row = {
    title_id: titleId.data,
    number: v.number,
    name: v.name,
    access: v.access,
    status: v.status,
    publish_at: publishAt,
  };
  const result = episodeId?.success
    ? await db.from("episodes").update(row).eq("id", episodeId.data)
    : await db.from("episodes").insert(row);
  if (result.error) {
    return {
      error: result.error.code === "23505" ? "เลขตอนซ้ำกับที่มีอยู่แล้ว" : "บันทึกตอนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
  // ไปหน้าแก้ไขตอน เพื่ออัปโหลดรูปหน้าต่อได้ทันที
  redirect(`/admin/titles/${titleId.data}/episodes/${v.number}?saved=1`);
}

// ---------------------------------------------------------------- หน้ามังงะ

/** ขอลิงก์อัปโหลดสำหรับไฟล์ n ไฟล์ (เบราว์เซอร์อัปโหลดตรงไปที่ Storage ไม่ผ่านเซิร์ฟเวอร์เรา) */
export async function requestPageUploads(
  rawEpisodeId: string,
  rawExts: string[],
): Promise<{ key: string; token: string }[]> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const exts = z.array(imageExtSchema).min(1).max(MAX_PAGES_PER_BATCH).parse(rawExts);

  const titleId = await mangaEpisodeOwner(db, episodeId);
  if (!titleId) throw new Error("ตอนนี้ไม่ใช่มังงะ");

  const stamp = Date.now().toString(36);
  const keys = exts.map(
    (ext, i) => `${titleId}/${episodeId}/${stamp}-${i}-${randomBytes(3).toString("hex")}.${ext}`,
  );
  return createUploadTargets(db, keys);
}

/** ผูกไฟล์ที่อัปโหลดเสร็จเป็นหน้าถัดไปของตอน (ต่อท้ายหน้าเดิม) */
export async function registerPages(
  rawEpisodeId: string,
  rawItems: { key: string; width: number; height: number }[],
): Promise<void> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const items = registerSchema.min(1).max(MAX_PAGES_PER_BATCH).parse(rawItems);

  const titleId = await mangaEpisodeOwner(db, episodeId);
  if (!titleId) throw new Error("ตอนนี้ไม่ใช่มังงะ");
  // กันผูกไฟล์ของตอน/เรื่องอื่น
  const prefix = `${titleId}/${episodeId}/`;
  if (items.some((i) => !i.key.startsWith(prefix) || i.key.includes(".."))) {
    throw new Error("คีย์ไฟล์ไม่ถูกต้อง");
  }

  const last = await db
    .from("manga_pages")
    .select("page_no")
    .eq("episode_id", episodeId)
    .order("page_no", { ascending: false })
    .limit(1);
  let next = (last.data?.[0]?.page_no ?? 0) + 1;

  const { error } = await db.from("manga_pages").insert(
    items.map((i) => ({
      episode_id: episodeId,
      page_no: next++,
      image_key: i.key,
      width: i.width,
      height: i.height,
    })),
  );
  if (error) throw new Error(`บันทึกหน้าไม่สำเร็จ: ${error.message}`);
}

/** สลับลำดับหน้ากับหน้าข้างเคียง (dir = -1 ขึ้น, 1 ลง) */
export async function movePage(rawEpisodeId: string, pageNo: number, dir: -1 | 1): Promise<void> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const a = z.number().int().positive().parse(pageNo);
  const b = a + (dir === 1 ? 1 : -1);
  if (b < 1) return;

  const pages = await db
    .from("manga_pages")
    .select("page_no")
    .eq("episode_id", episodeId)
    .in("page_no", [a, b]);
  if (pages.data?.length !== 2) return; // ไม่มีหน้าข้างเคียงให้สลับ

  // page_no เป็นคีย์หลัก: ใช้เลขชั่วคราวพักไว้ก่อนสลับ
  const TEMP = 1_000_000;
  await db
    .from("manga_pages")
    .update({ page_no: TEMP })
    .eq("episode_id", episodeId)
    .eq("page_no", a);
  await db.from("manga_pages").update({ page_no: a }).eq("episode_id", episodeId).eq("page_no", b);
  await db
    .from("manga_pages")
    .update({ page_no: b })
    .eq("episode_id", episodeId)
    .eq("page_no", TEMP);
}

/** ลบหน้า (ลบทั้งแถวและไฟล์) แล้วเลื่อนเลขหน้าถัดไปขึ้นมาให้ต่อเนื่อง */
export async function deletePage(rawEpisodeId: string, pageNo: number): Promise<void> {
  const { db } = await requireAdmin();
  const episodeId = uuid.parse(rawEpisodeId);
  const n = z.number().int().positive().parse(pageNo);

  const row = await db
    .from("manga_pages")
    .select("image_key")
    .eq("episode_id", episodeId)
    .eq("page_no", n)
    .maybeSingle();
  if (!row.data) return;
  await db.from("manga_pages").delete().eq("episode_id", episodeId).eq("page_no", n);
  await removeObjects(db, [row.data.image_key]);

  const after = await db
    .from("manga_pages")
    .select("page_no")
    .eq("episode_id", episodeId)
    .gt("page_no", n)
    .order("page_no", { ascending: true });
  for (const p of after.data ?? []) {
    await db
      .from("manga_pages")
      .update({ page_no: p.page_no - 1 })
      .eq("episode_id", episodeId)
      .eq("page_no", p.page_no);
  }
}

// ---------------------------------------------------------------- รูปปกเรื่อง

/** ขอลิงก์อัปโหลดปก — คีย์ใหม่ทุกครั้ง (เปลี่ยนปกแล้ว URL เปลี่ยน แคชของเบราว์เซอร์/CDN ไม่ค้างรูปเก่า) */
export async function requestCoverUpload(
  rawTitleId: string,
  rawExt: string,
): Promise<{ key: string; token: string }> {
  const { db } = await requireAdmin();
  const titleId = uuid.parse(rawTitleId);
  const ext = imageExtSchema.parse(rawExt);
  const { data } = await db.from("titles").select("id").eq("id", titleId).maybeSingle();
  if (!data) throw new Error("ไม่พบเรื่อง");
  const key = `${titleId}/${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${ext}`;
  return createCoverUploadTarget(db, key);
}

/** ตั้งปกเรื่อง (key = null → ลบปก) แล้วลบไฟล์ปกเดิมทิ้ง */
export async function setTitleCover(rawTitleId: string, rawKey: string | null): Promise<void> {
  const { db } = await requireAdmin();
  const titleId = uuid.parse(rawTitleId);
  if (rawKey !== null && (!rawKey.startsWith(`${titleId}/`) || rawKey.includes(".."))) {
    throw new Error("คีย์ไฟล์ไม่ถูกต้อง");
  }
  const old = await db.from("titles").select("cover_key").eq("id", titleId).maybeSingle();
  if (!old.data) throw new Error("ไม่พบเรื่อง");
  const { error } = await db.from("titles").update({ cover_key: rawKey }).eq("id", titleId);
  if (error) throw new Error("บันทึกปกไม่สำเร็จ");
  if (old.data.cover_key && old.data.cover_key !== rawKey)
    await removeCover(db, old.data.cover_key);
  updateTag("catalog");
}
