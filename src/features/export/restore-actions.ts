"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/admin/guard";
import { countWords, slugSchema } from "@/features/admin/schemas";
import { MAX_CHAPTER_CHARS } from "@/features/import/split-chapters";

const tagSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

const titleSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(200),
  author: z.string().trim().max(100).nullable(),
  synopsis: z.string().max(5000),
  status: z.enum(["ongoing", "completed", "hiatus"]),
  rating: z.enum(["all", "13", "18"]),
  updateDay: z.number().int().min(0).max(6).nullable(),
  published: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});

const chapterSchema = z.object({
  number: z.number().int().positive().max(100_000),
  name: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_CHAPTER_CHARS),
  status: z.enum(["draft", "scheduled", "published"]),
  access: z.enum(["inherit", "free", "premium"]),
  publishAt: z.string().datetime().nullable(),
  translations: z
    .array(
      z.object({
        lang: z.string().min(1).max(20),
        body: z.string().max(MAX_CHAPTER_CHARS),
        machine: z.boolean(),
      }),
    )
    .max(10),
});

export interface RestoreTitleResult {
  titleId?: string;
  created?: boolean;
  error?: string;
}

/** หาเรื่องตาม slug; ไม่มีก็สร้างตามข้อมูลสำรอง (มีอยู่แล้ว = เติมเฉพาะตอนที่ขาด ไม่แก้ข้อมูลเรื่องเดิม) */
export async function restoreTitle(raw: unknown): Promise<RestoreTitleResult> {
  const { db } = await requireAdmin();
  const p = titleSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลเรื่องไม่ถูกต้อง" };
  const t = p.data;

  const old = await db.from("titles").select("id, type").eq("slug", t.slug).maybeSingle();
  if (old.error) return { error: "ค้นหาเรื่องไม่สำเร็จ" };
  if (old.data) {
    return old.data.type === "novel"
      ? { titleId: old.data.id, created: false }
      : { error: `slug "${t.slug}" ถูกใช้โดยเรื่องที่ไม่ใช่นิยาย` };
  }

  const { data, error } = await db
    .from("titles")
    .insert({
      type: "novel",
      slug: t.slug,
      name: t.name,
      author: t.author,
      synopsis: t.synopsis,
      status: t.status,
      rating: t.rating,
      update_day: t.updateDay,
      published: t.published,
    })
    .select("id")
    .single();
  if (error) return { error: "สร้างเรื่องไม่สำเร็จ" };

  if (t.tags.length > 0) {
    await db.from("tags").upsert(
      t.tags.map((name) => ({ slug: tagSlug(name), name })),
      { onConflict: "slug", ignoreDuplicates: true },
    );
    const found = (await db.from("tags").select("id").in("slug", t.tags.map(tagSlug))).data ?? [];
    if (found.length) {
      await db.from("title_tags").insert(found.map((x) => ({ title_id: data.id, tag_id: x.id })));
    }
  }
  updateTag("catalog");
  return { titleId: data.id, created: true };
}

export interface RestoreBatchResult {
  created: number;
  /** เลขตอนที่ข้ามเพราะมีอยู่แล้ว */
  skipped: number[];
  error?: string;
}

/** กู้ตอนเป็นชุด (≤ 20 ตอน) พร้อมสถานะ/สิทธิ์/เวลาเผยแพร่/คำแปลตามไฟล์สำรอง; ตอนที่เลขซ้ำถูกข้าม ไม่เขียนทับ */
export async function restoreChapterBatch(raw: unknown): Promise<RestoreBatchResult> {
  const { db } = await requireAdmin();
  const empty = { created: 0, skipped: [] as number[] };
  const p = z
    .object({ titleId: z.string().uuid(), chapters: z.array(chapterSchema).min(1).max(20) })
    .safeParse(raw);
  if (!p.success) return { ...empty, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { titleId, chapters } = p.data;

  const nums = chapters.map((c) => c.number);
  if (new Set(nums).size !== nums.length) return { ...empty, error: "เลขตอนซ้ำกันในชุด" };
  const title = await db.from("titles").select("type").eq("id", titleId).maybeSingle();
  if (title.data?.type !== "novel") return { ...empty, error: "เรื่องนี้ไม่ใช่นิยาย" };

  const existing = await db
    .from("episodes")
    .select("number")
    .eq("title_id", titleId)
    .in("number", nums);
  if (existing.error) return { ...empty, error: "อ่านตอนที่มีอยู่ไม่สำเร็จ" };
  const have = new Set(existing.data.map((e) => e.number));
  const todo = chapters.filter((c) => !have.has(c.number));
  const skipped = chapters.filter((c) => have.has(c.number)).map((c) => c.number);
  if (todo.length === 0) return { created: 0, skipped };

  const ins = await db
    .from("episodes")
    .insert(
      todo.map((c) => ({
        title_id: titleId,
        number: c.number,
        name: c.name,
        access: c.access,
        status: c.status === "scheduled" && !c.publishAt ? ("draft" as const) : c.status,
        publish_at: c.status === "scheduled" ? c.publishAt : null,
      })),
    )
    .select("id, number");
  if (ins.error) {
    console.error("restore: สร้างตอนไม่สำเร็จ:", ins.error.message);
    return { ...empty, error: "สร้างตอนไม่สำเร็จ กรุณาลองใหม่" };
  }
  const idOf = new Map(ins.data.map((e) => [e.number, e.id]));

  const bodies = todo.map((c) => ({
    episode_id: idOf.get(c.number)!,
    body_markdown: c.body,
    word_count: countWords(c.body),
  }));
  const b = await db.from("novel_bodies").upsert(bodies);
  if (b.error) return { created: todo.length, skipped, error: "บันทึกเนื้อหาตอนไม่สำเร็จ" };

  const tr = todo.flatMap((c) =>
    c.translations.map((x) => ({
      episode_id: idOf.get(c.number)!,
      lang: x.lang,
      body_markdown: x.body,
      machine: x.machine,
    })),
  );
  if (tr.length) {
    const r = await db.from("novel_translations").upsert(tr);
    if (r.error) return { created: todo.length, skipped, error: "บันทึกคำแปลไม่สำเร็จ" };
  }
  updateTag("catalog");
  return { created: todo.length, skipped };
}
