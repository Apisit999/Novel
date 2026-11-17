"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { auditLog } from "./audit";
import { requireAdmin } from "./guard";
import { firstSnippet, replaceLiteral } from "./replace-text";
import { countWords } from "./schemas";

const inputSchema = z.object({
  titleId: z.string().uuid(),
  find: z.string().min(1, "กรอกคำที่ต้องการค้นหา").max(200),
  replacement: z.string().max(200),
  matchCase: z.boolean(),
});

export interface ReplacePreview {
  episodes: number;
  matches: number;
  samples: { number: number; name: string; snippet: string }[];
  error?: string;
}

const PAGE = 40; // เนื้อหาตอนใหญ่ → อ่านทีละน้อย

type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

/** วนอ่านเนื้อหานิยายทุกตอนของเรื่อง */
async function* eachBody(db: Db, titleId: string) {
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("episodes")
      .select("id, number, name, novel_bodies(body_markdown)")
      .eq("title_id", titleId)
      .order("number", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error("อ่านตอนไม่สำเร็จ");
    for (const e of data) {
      const nb = e.novel_bodies as unknown as
        { body_markdown: string } | { body_markdown: string }[] | null;
      const body = (Array.isArray(nb) ? nb[0]?.body_markdown : nb?.body_markdown) ?? null;
      if (body !== null) yield { id: e.id, number: e.number, name: e.name, body };
    }
    if (data.length < PAGE) return;
  }
}

async function ensureNovel(db: Db, titleId: string) {
  const t = await db.from("titles").select("type").eq("id", titleId).maybeSingle();
  return t.data?.type === "novel";
}

/** นับว่าจะเจอกี่จุด/กี่ตอน พร้อมตัวอย่าง (ยังไม่แก้อะไร) */
export async function previewReplace(raw: unknown): Promise<ReplacePreview> {
  const { db } = await requireAdmin();
  const empty = { episodes: 0, matches: 0, samples: [] };
  const p = inputSchema.safeParse(raw);
  if (!p.success) return { ...empty, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { titleId, find, replacement, matchCase } = p.data;
  if (!(await ensureNovel(db, titleId))) return { ...empty, error: "เรื่องนี้ไม่ใช่นิยาย" };

  const out: ReplacePreview = { ...empty, samples: [] };
  for await (const e of eachBody(db, titleId)) {
    const r = replaceLiteral(e.body, find, replacement, matchCase);
    if (!r.count) continue;
    out.episodes++;
    out.matches += r.count;
    if (out.samples.length < 5) {
      out.samples.push({
        number: e.number,
        name: e.name,
        snippet: firstSnippet(e.body, find, matchCase),
      });
    }
  }
  return out;
}

/** แทนที่จริงในเนื้อหาทุกตอนของเรื่อง (ไม่มีปุ่มย้อนกลับ — หน้าจอแนะนำให้ส่งออกสำรองก่อน) */
export async function applyReplace(
  raw: unknown,
): Promise<{ episodes: number; matches: number; error?: string }> {
  const ctx = await requireAdmin();
  const { db } = ctx;
  const p = inputSchema.safeParse(raw);
  if (!p.success) return { episodes: 0, matches: 0, error: p.error.issues[0]?.message };
  const { titleId, find, replacement, matchCase } = p.data;
  if (!(await ensureNovel(db, titleId))) {
    return { episodes: 0, matches: 0, error: "เรื่องนี้ไม่ใช่นิยาย" };
  }
  let episodes = 0;
  let matches = 0;
  try {
    for await (const e of eachBody(db, titleId)) {
      const r = replaceLiteral(e.body, find, replacement, matchCase);
      if (!r.count) continue;
      const { error } = await db
        .from("novel_bodies")
        .update({ body_markdown: r.text, word_count: countWords(r.text) })
        .eq("episode_id", e.id);
      if (error) throw new Error(`บันทึกตอนที่ ${e.number} ไม่สำเร็จ`);
      episodes++;
      matches += r.count;
    }
  } catch (e) {
    return {
      episodes,
      matches,
      error: `${e instanceof Error ? e.message : "แทนที่ไม่สำเร็จ"} (แก้ไปแล้ว ${episodes} ตอน)`,
    };
  }
  await auditLog(ctx, "replace.apply", titleId, { episodes, matches, findLength: find.length });
  updateTag("catalog");
  return { episodes, matches };
}
