"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { removeObjects, VIDEO_BUCKET } from "@/server/storage";
import { requireAdmin } from "./guard";
import { countWords, episodeSchema, thaiLocalToIso, titleSchema } from "./schemas";

export interface FormState {
  error?: string;
}

const uuid = z.string().uuid();
const refreshCatalog = () => updateTag("catalog");

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

function dbMessage(error: { code?: string; message: string }, what: string): string {
  if (error.code === "23505") return `${what}ซ้ำกับที่มีอยู่แล้ว`;
  console.error(`admin: ${what}:`, error.message);
  return `บันทึก${what}ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`;
}

/** ใช้ชื่อแท็กเป็น slug (ตัวพิมพ์เล็ก ช่องว่าง → ขีดกลาง) */
const tagSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

// ---------------------------------------------------------------- เรื่อง

export async function saveTitle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();

  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? uuid.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "รหัสเรื่องไม่ถูกต้อง" };

  const parsed = titleSchema.safeParse({
    type: formData.get("type"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    synopsis: formData.get("synopsis") ?? "",
    author: String(formData.get("author") ?? ""),
    status: formData.get("status"),
    rating: formData.get("rating"),
    update_day: String(formData.get("updateDay") ?? ""),
    access: formData.get("access"),
    published: formData.get("published") === "on",
    featured: formData.get("featured") === "on",
    tags: String(formData.get("tags") ?? ""),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { tags, type, ...fields } = parsed.data;

  let titleId: string;
  if (id?.success) {
    // ไม่ให้เปลี่ยนประเภทหลังสร้าง (เนื้อหาของแต่ละประเภทอยู่คนละตาราง)
    const { error } = await db.from("titles").update(fields).eq("id", id.data);
    if (error) return { error: dbMessage(error, "slug") };
    titleId = id.data;
  } else {
    const { data, error } = await db
      .from("titles")
      .insert({ ...fields, type })
      .select("id")
      .single();
    if (error) return { error: dbMessage(error, "slug") };
    titleId = data.id;
  }

  // แท็ก: สร้างที่ยังไม่มี แล้วซิงก์ความสัมพันธ์ (เพิ่มที่ขาด ลบที่เกิน)
  if (tags.length > 0) {
    const { error } = await db.from("tags").upsert(
      tags.map((name) => ({ slug: tagSlug(name), name })),
      {
        onConflict: "slug",
        ignoreDuplicates: true,
      },
    );
    if (error) return { error: dbMessage(error, "แท็ก") };
  }
  const wanted = tags.length
    ? ((await db.from("tags").select("id, slug").in("slug", tags.map(tagSlug))).data ?? [])
    : [];
  const current = (await db.from("title_tags").select("tag_id").eq("title_id", titleId)).data ?? [];
  const wantedIds = new Set(wanted.map((t) => t.id));
  const currentIds = new Set(current.map((t) => t.tag_id));
  const toRemove = [...currentIds].filter((t) => !wantedIds.has(t));
  const toAdd = [...wantedIds].filter((t) => !currentIds.has(t));
  if (toRemove.length) {
    await db.from("title_tags").delete().eq("title_id", titleId).in("tag_id", toRemove);
  }
  if (toAdd.length) {
    await db.from("title_tags").insert(toAdd.map((tag_id) => ({ title_id: titleId, tag_id })));
  }

  refreshCatalog();
  redirect(`/admin/titles/${titleId}?saved=1`);
}

export async function deleteTitle(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect("/admin");
  // ไฟล์รูปมังงะใน Storage ไม่ถูก cascade ตามแถว → เก็บรายชื่อไฟล์ก่อนลบ แล้วลบไฟล์ทิ้งด้วย (กันขยะค้าง)
  const episodes = await db.from("episodes").select("id").eq("title_id", id.data);
  const epIds = (episodes.data ?? []).map((e) => e.id);
  const pages = epIds.length
    ? await db.from("manga_pages").select("image_key").in("episode_id", epIds)
    : { data: [] };
  const videos = epIds.length
    ? await db.from("video_assets").select("stream_uid").in("episode_id", epIds)
    : { data: [] };
  // ลบแล้ว FK cascade ลบตอน เนื้อหา คำแปล ความคืบหน้า และรายการโปรดที่อ้างเรื่องนี้ทั้งหมด
  const { error } = await db.from("titles").delete().eq("id", id.data);
  if (error) redirect(`/admin/titles/${id.data}?error=delete`);
  await removeObjects(
    db,
    (pages.data ?? []).map((p) => p.image_key),
  );
  await removeObjects(
    db,
    (videos.data ?? []).map((v) => v.stream_uid),
    VIDEO_BUCKET,
  );
  refreshCatalog();
  redirect("/admin?deleted=1");
}

// ---------------------------------------------------------------- ตอน (นิยาย)

export async function saveEpisode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { db } = await requireAdmin();

  const titleId = uuid.safeParse(formData.get("titleId"));
  if (!titleId.success) return { error: "รหัสเรื่องไม่ถูกต้อง" };
  const episodeIdRaw = String(formData.get("episodeId") ?? "");
  const episodeId = episodeIdRaw ? uuid.safeParse(episodeIdRaw) : null;
  if (episodeId && !episodeId.success) return { error: "รหัสตอนไม่ถูกต้อง" };

  const parsed = episodeSchema.safeParse({
    number: formData.get("number"),
    name: formData.get("name"),
    access: formData.get("access"),
    status: formData.get("status"),
    publishAt: String(formData.get("publishAt") ?? "") || undefined,
    body: String(formData.get("body") ?? ""),
    en: String(formData.get("en") ?? ""),
    enMachine: formData.get("enMachine") === "on",
    zh: String(formData.get("zh") ?? ""),
    zhMachine: formData.get("zhMachine") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const title = await db.from("titles").select("type").eq("id", titleId.data).maybeSingle();
  if (title.data?.type !== "novel") return { error: "ตอนนี้รองรับการลงตอนเฉพาะนิยาย" };

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
  let id: string;
  if (episodeId?.success) {
    const { error } = await db.from("episodes").update(row).eq("id", episodeId.data);
    if (error) return { error: dbMessage(error, "เลขตอน") };
    id = episodeId.data;
  } else {
    const { data, error } = await db.from("episodes").insert(row).select("id").single();
    if (error) return { error: dbMessage(error, "เลขตอน") };
    id = data.id;
  }

  const body = await db
    .from("novel_bodies")
    .upsert({ episode_id: id, body_markdown: v.body, word_count: countWords(v.body) });
  if (body.error) return { error: dbMessage(body.error, "เนื้อหา") };

  // คำแปล: มีข้อความ → บันทึก, ว่าง → ลบคำแปลภาษานั้น
  for (const [lang, text, machine] of [
    ["en", v.en, v.enMachine],
    ["zh", v.zh, v.zhMachine],
  ] as const) {
    const { error } = text.trim()
      ? await db
          .from("novel_translations")
          .upsert({ episode_id: id, lang, body_markdown: text, machine })
      : await db.from("novel_translations").delete().eq("episode_id", id).eq("lang", lang);
    if (error) return { error: dbMessage(error, "คำแปล") };
  }

  refreshCatalog();
  redirect(`/admin/titles/${titleId.data}?saved=1`);
}

export async function deleteEpisode(formData: FormData) {
  const { db } = await requireAdmin();
  const titleId = uuid.safeParse(formData.get("titleId"));
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success || !titleId.success) redirect("/admin");
  const pages = await db.from("manga_pages").select("image_key").eq("episode_id", id.data);
  const video = await db.from("video_assets").select("stream_uid").eq("episode_id", id.data);
  const { error } = await db.from("episodes").delete().eq("id", id.data);
  if (!error) {
    await removeObjects(
      db,
      (video.data ?? []).map((v) => v.stream_uid),
      VIDEO_BUCKET,
    );
    await removeObjects(
      db,
      (pages.data ?? []).map((p) => p.image_key),
    ); // ไฟล์รูปไม่ถูก cascade ตามแถว ต้องลบเอง
  }
  refreshCatalog();
  redirect(`/admin/titles/${titleId.data}?deleted=1`);
}

/**
 * สลับลำดับตอนกับตอนที่อยู่ติดกัน (ขึ้น/ลง) — ลำดับของตอนคือ "เลขตอน" จึงสลับเลขกัน
 * (เลขตอนไม่ซ้ำในเรื่อง จึงพักเลขหนึ่งไว้ที่ค่าชั่วคราวก่อน เหมือนการสลับหน้ามังงะ)
 * ผลข้างเคียง: ลิงก์ /read/<เรื่อง>/<เลข> ของสองตอนนี้สลับกันตามลำดับใหม่
 */
export async function moveEpisode(formData: FormData) {
  const { db } = await requireAdmin();
  const titleId = uuid.safeParse(formData.get("titleId"));
  const id = uuid.safeParse(formData.get("id"));
  const dir = formData.get("dir");
  if (!titleId.success || !id.success || (dir !== "up" && dir !== "down")) redirect("/admin");

  const { data } = await db
    .from("episodes")
    .select("id, number")
    .eq("title_id", titleId.data)
    .order("number", { ascending: true });
  const list = data ?? [];
  const i = list.findIndex((e) => e.id === id.data);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) redirect(`/admin/titles/${titleId.data}`);

  const a = list[i];
  const b = list[j];
  const TEMP = 1_000_000;
  const step1 = await db.from("episodes").update({ number: TEMP }).eq("id", a.id);
  const step2 = step1.error
    ? step1
    : await db.from("episodes").update({ number: a.number }).eq("id", b.id);
  const step3 = step2.error
    ? step2
    : await db.from("episodes").update({ number: b.number }).eq("id", a.id);
  if (step3.error) {
    console.error("admin: สลับลำดับตอน:", step3.error.message);
    // พยายามคืนเลขเดิมของตอนที่ถูกพักไว้ ไม่ให้ค้างที่เลขชั่วคราว
    await db.from("episodes").update({ number: a.number }).eq("id", a.id).eq("number", TEMP);
  }
  refreshCatalog();
  redirect(`/admin/titles/${titleId.data}`);
}
