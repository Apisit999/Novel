import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ExportEpisode, ExportTitle } from "./build-export";

type Db = SupabaseClient<Database>;

export interface LoadedNovel {
  title: ExportTitle;
  episodes: ExportEpisode[];
}

const PAGE = 100;

/**
 * โหลดนิยายพร้อมทุกตอน เนื้อหา และคำแปล (ทุกสถานะรวมฉบับร่าง) ในนามแอดมินผ่าน RLS
 * อ่านตอนเป็นชุดละ 100 (นิยายหลายร้อยตอน ไม่ชนเพดานจำนวนแถวต่อคำขอ)
 */
export async function loadNovel(db: Db, titleId: string): Promise<LoadedNovel | null> {
  const t = await db
    .from("titles")
    .select(
      "slug, name, author, synopsis, status, rating, update_day, published, type, title_tags(tags(name))",
    )
    .eq("id", titleId)
    .maybeSingle();
  if (t.error) throw new Error(`อ่านเรื่องไม่สำเร็จ: ${t.error.message}`);
  if (!t.data || t.data.type !== "novel") return null;

  const episodes: ExportEpisode[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("episodes")
      .select(
        "number, name, status, access, publish_at, novel_bodies(body_markdown), novel_translations(lang, body_markdown, machine)",
      )
      .eq("title_id", titleId)
      .order("number", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`อ่านตอนไม่สำเร็จ: ${error.message}`);
    for (const e of data) {
      // novel_bodies เป็นความสัมพันธ์หนึ่งต่อหนึ่ง (อาจเป็นอ็อบเจ็กต์หรืออาร์เรย์ตามชนิดที่ไลบรารีอนุมาน)
      const nb = e.novel_bodies as unknown as
        { body_markdown: string } | { body_markdown: string }[] | null;
      const body = (Array.isArray(nb) ? nb[0]?.body_markdown : nb?.body_markdown) ?? "";
      episodes.push({
        number: e.number,
        name: e.name,
        status: e.status,
        access: e.access,
        publishAt: e.publish_at,
        body,
        translations: e.novel_translations.map((x) => ({
          lang: x.lang,
          body: x.body_markdown,
          machine: x.machine,
        })),
      });
    }
    if (data.length < PAGE) break;
  }

  return {
    title: {
      slug: t.data.slug,
      name: t.data.name,
      author: t.data.author,
      synopsis: t.data.synopsis,
      status: t.data.status,
      rating: t.data.rating,
      updateDay: t.data.update_day,
      published: t.data.published,
      tags: t.data.title_tags.flatMap((x) => (x.tags ? [x.tags.name] : [])).sort(),
    },
    episodes,
  };
}

/** id ของนิยายทุกเรื่อง (ไว้สำรองทั้งระบบ) */
export async function listNovelIds(db: Db): Promise<string[]> {
  const { data, error } = await db.from("titles").select("id").eq("type", "novel").order("name");
  if (error) throw new Error(`อ่านรายการเรื่องไม่สำเร็จ: ${error.message}`);
  return data.map((r) => r.id);
}
