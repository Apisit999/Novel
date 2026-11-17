"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/features/admin/audit";
import { requireAdmin } from "@/features/admin/guard";
import { countWords, thaiLocalToIso } from "@/features/admin/schemas";
import { MAX_CHAPTER_CHARS } from "./split-chapters";

/** ตอนที่จะนำเข้า 1 ตอน (ส่งเป็นชุดเล็ก ๆ จากเบราว์เซอร์เพราะนิยายหนึ่งเรื่องอาจมีหลายร้อยตอน) */
const chapterSchema = z.object({
  number: z.number().int().positive().max(100_000),
  name: z.string().trim().min(1, "ชื่อตอนว่าง").max(200, "ชื่อตอนยาวเกิน 200 ตัวอักษร"),
  body: z.string().min(1, "เนื้อหาว่าง").max(MAX_CHAPTER_CHARS, "เนื้อหายาวเกินเพดาน"),
  /** "YYYY-MM-DDTHH:mm" เวลาไทย — ใช้เมื่อ status = scheduled */
  publishAt: z.string().nullable(),
});

const batchSchema = z.object({
  titleId: z.string().uuid(),
  status: z.enum(["draft", "published", "scheduled"]),
  /** เลขตอนซ้ำกับที่มีอยู่แล้ว: ข้าม หรือ เขียนทับชื่อ+เนื้อหา (ไม่แตะสถานะ/เวลา/สิทธิ์เดิม) */
  onConflict: z.enum(["skip", "overwrite"]),
  chapters: z.array(chapterSchema).min(1).max(30),
});

export interface ImportBatchResult {
  created: number;
  overwritten: number;
  /** เลขตอนที่ถูกข้ามเพราะมีอยู่แล้ว */
  skipped: number[];
  /** ข้อผิดพลาดที่ทำให้ชุดนี้บันทึกไม่ได้ (ว่าง = สำเร็จ) */
  error?: string;
}

/**
 * นำเข้านิยายเป็นชุด (≤ 30 ตอนต่อครั้ง) — เฉพาะแอดมิน ทำในนามแอดมินผ่าน RLS
 * ตรวจทุกค่าซ้ำฝั่งเซิร์ฟเวอร์ (ข้อมูลจากเบราว์เซอร์เชื่อไม่ได้) และทำแบบ "ทั้งชุดหรือรายงานผิดพลาด"
 * ต่อชุด: ถ้าสร้างตอนไม่สำเร็จ จะไม่เขียนเนื้อหาของชุดนั้น
 */
export async function importChapterBatch(raw: unknown): Promise<ImportBatchResult> {
  const ctx = await requireAdmin();
  const { db } = ctx;
  const empty: ImportBatchResult = { created: 0, overwritten: 0, skipped: [] };

  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ...empty, error: parsed.error.issues[0]?.message ?? "ข้อมูลนำเข้าไม่ถูกต้อง" };
  }
  const { titleId, status, onConflict, chapters } = parsed.data;

  const numbers = chapters.map((c) => c.number);
  if (new Set(numbers).size !== numbers.length) {
    return { ...empty, error: "มีเลขตอนซ้ำกันในชุดนำเข้า" };
  }

  const title = await db.from("titles").select("type").eq("id", titleId).maybeSingle();
  if (title.data?.type !== "novel") return { ...empty, error: "เรื่องนี้ไม่ใช่นิยาย" };

  // เวลาเผยแพร่: ตั้งเวลาต้องมีเวลาที่ถูกต้องทุกตอน
  const publishAt = new Map<number, string | null>();
  for (const c of chapters) {
    if (status !== "scheduled") {
      publishAt.set(c.number, null);
      continue;
    }
    const iso = thaiLocalToIso(c.publishAt ?? undefined);
    if (!iso) return { ...empty, error: `ตอนที่ ${c.number}: วันและเวลาเผยแพร่ไม่ถูกต้อง` };
    publishAt.set(c.number, iso);
  }

  const existing = await db
    .from("episodes")
    .select("id, number")
    .eq("title_id", titleId)
    .in("number", numbers);
  if (existing.error) return { ...empty, error: "อ่านตอนที่มีอยู่ไม่สำเร็จ" };
  const existingByNumber = new Map(existing.data.map((e) => [e.number, e.id]));

  const toCreate = chapters.filter((c) => !existingByNumber.has(c.number));
  const toOverwrite = chapters.filter((c) => existingByNumber.has(c.number));
  const skipped = onConflict === "skip" ? toOverwrite.map((c) => c.number) : [];

  const ids = new Map<number, string>();

  if (toCreate.length > 0) {
    const inserted = await db
      .from("episodes")
      .insert(
        toCreate.map((c) => ({
          title_id: titleId,
          number: c.number,
          name: c.name,
          access: "inherit" as const,
          status,
          publish_at: publishAt.get(c.number) ?? null,
        })),
      )
      .select("id, number");
    if (inserted.error) {
      console.error("import: สร้างตอนไม่สำเร็จ:", inserted.error.message);
      return {
        ...empty,
        error:
          inserted.error.code === "23505"
            ? "เลขตอนซ้ำกับที่เพิ่งมีคนบันทึก — ลองนำเข้าใหม่อีกครั้ง"
            : "สร้างตอนไม่สำเร็จ กรุณาลองใหม่",
      };
    }
    for (const e of inserted.data) ids.set(e.number, e.id);
  }

  if (onConflict === "overwrite") {
    for (const c of toOverwrite) {
      const id = existingByNumber.get(c.number)!;
      const { error } = await db.from("episodes").update({ name: c.name }).eq("id", id);
      if (error) {
        console.error("import: เขียนทับชื่อตอนไม่สำเร็จ:", error.message);
        return { ...empty, created: toCreate.length, error: `เขียนทับตอนที่ ${c.number} ไม่สำเร็จ` };
      }
      ids.set(c.number, id);
    }
  }

  const bodies = chapters.flatMap((c) => {
    const id = ids.get(c.number);
    return id ? [{ episode_id: id, body_markdown: c.body, word_count: countWords(c.body) }] : [];
  });
  if (bodies.length > 0) {
    const { error } = await db.from("novel_bodies").upsert(bodies);
    if (error) {
      console.error("import: บันทึกเนื้อหาไม่สำเร็จ:", error.message);
      return { ...empty, created: toCreate.length, error: "บันทึกเนื้อหาตอนไม่สำเร็จ กรุณาลองใหม่" };
    }
  }

  await auditLog(ctx, "episodes.import", titleId, {
    created: toCreate.length,
    overwritten: onConflict === "overwrite" ? toOverwrite.length : 0,
  });
  updateTag("catalog");
  return {
    created: toCreate.length,
    overwritten: onConflict === "overwrite" ? toOverwrite.length : 0,
    skipped,
  };
}
