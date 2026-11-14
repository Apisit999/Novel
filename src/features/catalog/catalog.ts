import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Access, EpisodeAccess } from "@/features/access/can-access";
import { publicDb } from "@/server/db";
import { signedReadUrls } from "@/server/storage";

export type TitleType = "novel" | "manga" | "video";
export type TitleStatus = "ongoing" | "completed" | "hiatus";

export interface TitleSummary {
  slug: string;
  type: TitleType;
  name: string;
  synopsis: string;
  status: TitleStatus;
  access: Access;
  tags: string[];
}

export interface EpisodeSummary {
  number: number;
  name: string;
  access: EpisodeAccess;
}

export type TranslationLang = "en" | "zh";

export interface NovelTranslation {
  bodyMarkdown: string;
  /** true = แปลอัตโนมัติด้วย AI ยังไม่ผ่านการตรวจ → แสดงป้ายกำกับ */
  machine: boolean;
}

export interface NovelEpisode extends EpisodeSummary {
  bodyMarkdown: string;
  /** ภาษาที่มีคำแปล (ภาษาไทยคือต้นฉบับ) */
  translations: Partial<Record<TranslationLang, NovelTranslation>>;
}

export interface TitleFilter {
  tag?: string;
  status?: TitleStatus;
}

/**
 * ช่องทางเดียวที่หน้าเว็บใช้ดึงข้อมูลเรื่อง/ตอน — อ่านจาก Supabase ในนามผู้เยี่ยมชม (anon)
 * ทุกแถวผ่าน RLS: เห็นเฉพาะที่เผยแพร่แล้ว และเนื้อหาตอนต้องผ่าน can_access
 *
 * รายการเรื่อง/ตอนเหมือนกันทุกคน จึงแคชแบบ `use cache` (แท็ก "catalog") — แอดมินแก้แล้วเรียก
 * revalidateTag("catalog") ให้มีผลทันที ส่วนเนื้อหาตอนไม่แคช เพราะขึ้นกับสิทธิ์ผู้อ่านตาม RLS
 */

const TITLE_COLUMNS = "slug, type, name, synopsis, status, access, title_tags(tags(name))";

interface TitleRow {
  slug: string;
  type: TitleType;
  name: string;
  synopsis: string;
  status: TitleStatus;
  access: Access;
  title_tags: { tags: { name: string } | null }[];
}

function toSummary(row: TitleRow): TitleSummary {
  return {
    slug: row.slug,
    type: row.type,
    name: row.name,
    synopsis: row.synopsis,
    status: row.status,
    access: row.access,
    tags: row.title_tags.flatMap((t) => (t.tags ? [t.tags.name] : [])).sort(),
  };
}

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`อ่าน${what}จากฐานข้อมูลไม่สำเร็จ: ${result.error.message}`);
  return result.data as T;
}

export async function listAllTitles(): Promise<TitleSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const rows = must(
    await publicDb()
      .from("titles")
      .select(TITLE_COLUMNS)
      .eq("published", true)
      .order("updated_at", { ascending: false }),
    "รายการเรื่อง",
  );
  return (rows as unknown as TitleRow[]).map(toSummary);
}

export async function listTitles(
  type: TitleType,
  filter: TitleFilter = {},
): Promise<TitleSummary[]> {
  return (await listAllTitles()).filter(
    (t) =>
      t.type === type &&
      (!filter.tag || t.tags.includes(filter.tag)) &&
      (!filter.status || t.status === filter.status),
  );
}

/** แท็กทั้งหมดที่มีในประเภทนี้ (ไว้ทำตัวกรอง) */
export async function listTags(type: TitleType): Promise<string[]> {
  return [
    ...new Set((await listAllTitles()).filter((t) => t.type === type).flatMap((t) => t.tags)),
  ].sort();
}

export async function getTitle(slug: string): Promise<TitleSummary | undefined> {
  return (await listAllTitles()).find((t) => t.slug === slug);
}

export async function listEpisodes(slug: string): Promise<EpisodeSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const rows = must(
    await publicDb()
      .from("episodes")
      .select("number, name, access, titles!inner(slug)")
      .eq("titles.slug", slug)
      .order("number", { ascending: true }),
    "รายการตอน",
  );
  return rows.map((r) => ({ number: r.number, name: r.name, access: r.access }));
}

/**
 * คืนเนื้อหาเต็ม (ต้นฉบับ + คำแปล) — ไม่แคช เพราะผลขึ้นกับสิทธิ์ผู้อ่านตาม RLS
 * ถ้าผู้อ่านไม่มีสิทธิ์ ฐานข้อมูลจะไม่คืนแถวเนื้อหา → คืน undefined (ผู้เรียกควรขึ้น paywall)
 * ผู้เรียกยังต้องตรวจ canAccess ก่อนเสมอ (ป้องกันสองชั้นกับ RLS)
 */
export async function getNovelEpisode(
  slug: string,
  number: number,
): Promise<NovelEpisode | undefined> {
  const db = publicDb();
  const epRes = await db
    .from("episodes")
    .select("id, number, name, access, titles!inner(slug)")
    .eq("titles.slug", slug)
    .eq("number", number)
    .maybeSingle();
  if (epRes.error) throw new Error(`อ่านตอนจากฐานข้อมูลไม่สำเร็จ: ${epRes.error.message}`);
  const ep = epRes.data;
  if (!ep) return undefined;

  const [body, translations] = await Promise.all([
    db.from("novel_bodies").select("body_markdown").eq("episode_id", ep.id).maybeSingle(),
    db.from("novel_translations").select("lang, body_markdown, machine").eq("episode_id", ep.id),
  ]);
  const bodyRow = must(body, "เนื้อหาตอน");
  if (!bodyRow) return undefined; // RLS ไม่ให้อ่าน (หรือไม่มีเนื้อหา)

  const result: NovelEpisode = {
    number: ep.number,
    name: ep.name,
    access: ep.access,
    bodyMarkdown: bodyRow.body_markdown,
    translations: {},
  };
  for (const t of must(translations, "คำแปล")) {
    if (t.lang === "en" || t.lang === "zh") {
      result.translations[t.lang] = { bodyMarkdown: t.body_markdown, machine: t.machine };
    }
  }
  return result;
}

/** ค้นหาจากชื่อ เรื่องย่อ และแท็ก ข้ามทุกประเภท (ตอนนี้จับคำตรง ๆ; ค้นหาไทยจริงจังรอเฟส 6) */
export async function searchTitles(query: string): Promise<TitleSummary[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return (await listAllTitles()).filter((t) =>
    [t.name, t.synopsis, ...t.tags].some((s) => s.toLowerCase().includes(q)),
  );
}

/** เรื่องเด่นหน้าแรก (เฟส 3 ให้แอดมินเลือกเอง) */
export async function getFeatured(): Promise<TitleSummary | undefined> {
  const all = await listAllTitles();
  return all.find((t) => t.type === "novel" && t.access === "premium") ?? all[0];
}

/** ทุกเรื่องพร้อมตอน (ไว้สร้าง sitemap) — เฉพาะที่ผู้เยี่ยมชมเปิดอ่านได้ฟรี */
export async function listForSitemap(): Promise<
  { title: TitleSummary; episodes: EpisodeSummary[] }[]
> {
  const titles = await listAllTitles();
  return Promise.all(
    titles.map(async (title) => ({
      title,
      episodes: (await listEpisodes(title.slug)).filter(
        (e) => (e.access === "inherit" ? title.access : e.access) === "free",
      ),
    })),
  );
}

export interface MangaPage {
  pageNo: number;
  /** ลิงก์รูปที่หมดอายุ (ไม่ใช่ URL ถาวร) */
  url: string;
  width: number | null;
  height: number | null;
}

export interface MangaEpisode extends EpisodeSummary {
  pages: MangaPage[];
}

/**
 * ตอนมังงะพร้อมรูปทุกหน้า — ไม่แคช เพราะผลขึ้นกับสิทธิ์ผู้อ่านและลิงก์รูปหมดอายุ
 * ฐานข้อมูลคืนหน้าและออกลิงก์ให้เฉพาะเมื่อผู้อ่านมีสิทธิ์ตาม can_access (RLS ทั้งตารางและ Storage)
 * ไม่มีสิทธิ์ → pages ว่าง (ผู้เรียกควรขึ้น paywall ก่อนเรียกอยู่แล้ว)
 * หมายเหตุ: ใช้ไคลเอนต์ผู้เยี่ยมชม (anon) เหมือนนิยาย — เมื่อเปิดสิทธิ์สมาชิกจริง (เฟส 7) ต้องเปลี่ยนเป็นของผู้ใช้
 */
export async function getMangaEpisode(
  slug: string,
  number: number,
): Promise<MangaEpisode | undefined> {
  const db = publicDb();
  const epRes = await db
    .from("episodes")
    .select("id, number, name, access, titles!inner(slug)")
    .eq("titles.slug", slug)
    .eq("number", number)
    .maybeSingle();
  if (epRes.error) throw new Error(`อ่านตอนจากฐานข้อมูลไม่สำเร็จ: ${epRes.error.message}`);
  const ep = epRes.data;
  if (!ep) return undefined;

  const pagesRes = await db
    .from("manga_pages")
    .select("page_no, image_key, width, height")
    .eq("episode_id", ep.id)
    .order("page_no", { ascending: true });
  if (pagesRes.error) throw new Error(`อ่านหน้ามังงะไม่สำเร็จ: ${pagesRes.error.message}`);

  const urls = await signedReadUrls(
    db,
    pagesRes.data.map((p) => p.image_key),
  );
  const pages: MangaPage[] = pagesRes.data.flatMap((p) => {
    const url = urls.get(p.image_key);
    return url ? [{ pageNo: p.page_no, url, width: p.width, height: p.height }] : [];
  });
  return { number: ep.number, name: ep.name, access: ep.access, pages };
}
