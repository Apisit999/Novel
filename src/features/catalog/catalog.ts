import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Access, EpisodeAccess } from "@/features/access/can-access";
import { adminDb } from "@/server/admin-db";
import { publicDb } from "@/server/db";
import { activePins, type Pin } from "@/features/home/pins";
import { latestSlugs, pickFeatured, pickFeaturedList, resolveSlugs } from "./discovery";
import { bangkokDayAgo, rankMovement, trendingSlugs, type RankMove } from "./ranking";
import { signedReadUrls, VIDEO_BUCKET } from "@/server/storage";
import { searchIn } from "./search";

export type TitleType = "novel" | "manga" | "video";
export type TitleStatus = "ongoing" | "completed" | "hiatus";
export type AgeRating = "all" | "13" | "18";

export interface TitleSummary {
  slug: string;
  type: TitleType;
  name: string;
  synopsis: string;
  status: TitleStatus;
  access: Access;
  tags: string[];
  /** คีย์รูปปกในบัคเก็ต covers (null = ยังไม่มีปก) */
  coverKey: string | null;
  /** แอดมินติ๊กเป็นเรื่องเด่น (แบนเนอร์หน้าแรก) */
  featured: boolean;
  /** วันอัปเดตประจำสัปดาห์ 0 = อาทิตย์ … 6 = เสาร์ (null = ไม่ระบุ) */
  updateDay: number | null;
  /** เรตอายุ: all = ทุกวัย */
  rating: AgeRating;
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
  /** ซ่อนเรื่องเรต 18+ */
  hideAdult?: boolean;
}

/**
 * ช่องทางเดียวที่หน้าเว็บใช้ดึงข้อมูลเรื่อง/ตอน — อ่านจาก Supabase ในนามผู้เยี่ยมชม (anon)
 * ทุกแถวผ่าน RLS: เห็นเฉพาะที่เผยแพร่แล้ว และเนื้อหาตอนต้องผ่าน can_access
 *
 * รายการเรื่อง/ตอนเหมือนกันทุกคน จึงแคชแบบ `use cache` (แท็ก "catalog") — แอดมินแก้แล้วเรียก
 * revalidateTag("catalog") ให้มีผลทันที ส่วนเนื้อหาตอนไม่แคช เพราะขึ้นกับสิทธิ์ผู้อ่านตาม RLS
 */

const TITLE_COLUMNS =
  "slug, type, name, synopsis, status, access, featured, update_day, rating, cover_key, title_tags(tags(name))";

interface TitleRow {
  slug: string;
  type: TitleType;
  name: string;
  synopsis: string;
  status: TitleStatus;
  access: Access;
  featured: boolean;
  update_day: number | null;
  rating: AgeRating;
  cover_key: string | null;
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
    featured: row.featured,
    updateDay: row.update_day,
    rating: row.rating,
    coverKey: row.cover_key,
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
      (!filter.status || t.status === filter.status) &&
      (!filter.hideAdult || t.rating !== "18"),
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

/** ค้นหาจากชื่อ เรื่องย่อ และแท็ก ข้ามทุกประเภท — ตัดคำไทยและเรียงคะแนนใน search.ts */
export async function searchTitles(query: string): Promise<TitleSummary[]> {
  return searchIn(await listAllTitles(), query.slice(0, 100));
}

/** เรื่องที่มีตอนออกล่าสุด (ใหม่สุดก่อน) — ใช้ตอนที่ออกจริง ไม่ใช่เวลาแก้เรื่อง */
export async function listLatestUpdated(limit = 10): Promise<TitleSummary[]> {
  const slugs = await latestEpisodeSlugs();
  return resolveSlugs(slugs, await listAllTitles()).slice(0, limit);
}

async function latestEpisodeSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  // RLS ให้เห็นเฉพาะตอนที่เผยแพร่แล้ว (รวมตอนตั้งเวลาที่ถึงเวลาแล้ว)
  const rows = must(
    await publicDb()
      .from("episodes")
      .select("created_at, publish_at, titles!inner(slug)")
      .order("created_at", { ascending: false })
      .limit(200),
    "ตอนล่าสุด",
  );
  return latestSlugs(rows.map((r) => ({ slug: r.titles.slug, at: r.publish_at ?? r.created_at })));
}

/** เรื่องยอดนิยมตามยอดอ่าน/ดู (เฉพาะเรื่องที่มียอดแล้ว) */
export async function listPopular(limit = 10): Promise<TitleSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "views");

  const rows = must(
    await publicDb()
      .from("title_views")
      .select("view_count, titles!inner(slug)")
      .gt("view_count", 0)
      .order("view_count", { ascending: false })
      .limit(limit),
    "ยอดนิยม",
  );
  return resolveSlugs(
    rows.map((r) => r.titles.slug),
    await listAllTitles(),
  );
}

/** เรื่องเด่นหน้าแรก: จากที่แอดมินติ๊ก ถ้าไม่มีใช้เรื่องที่อัปเดตล่าสุด */
export async function getFeatured(): Promise<TitleSummary | undefined> {
  return pickFeatured(await listAllTitles(), await latestEpisodeSlugs());
}

/** เรื่องเด่นหลายเรื่องสำหรับ Spotlight (ที่แอดมินติ๊กก่อน แล้วเติมด้วยเรื่องอัปเดตล่าสุด) */
export async function listFeatured(limit = 3): Promise<TitleSummary[]> {
  return pickFeaturedList(await listAllTitles(), await latestEpisodeSlugs(), limit);
}

/** นับยอดอ่าน 1 ครั้ง (ฝั่งเซิร์ฟเวอร์เท่านั้น ใช้ service role) — พังเงียบ ๆ ไม่ให้กระทบการอ่าน */
export async function recordTitleView(slug: string): Promise<void> {
  try {
    const { error } = await adminDb().rpc("record_title_view", { p_slug: slug });
    if (error) console.error("นับยอดอ่านไม่สำเร็จ:", error.message);
  } catch (e) {
    console.error("นับยอดอ่านไม่สำเร็จ:", e instanceof Error ? e.message : e);
  }
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

export interface VideoEpisode extends EpisodeSummary {
  /** ลิงก์ไฟล์วิดีโอที่หมดอายุ — undefined = ยังไม่มีไฟล์/ไม่มีสิทธิ์ */
  url?: string;
  durationSec: number | null;
}

/**
 * ตอนวิดีโอพร้อมลิงก์ไฟล์ — ไม่แคช (ขึ้นกับสิทธิ์ผู้ดูและลิงก์หมดอายุ) เหมือนมังงะ
 * ฐานข้อมูลคืนแถวและออกลิงก์ให้เฉพาะเมื่อมีสิทธิ์ตาม can_access (RLS ทั้งตารางและ Storage)
 */
export async function getVideoEpisode(
  slug: string,
  number: number,
): Promise<VideoEpisode | undefined> {
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

  const assetRes = await db
    .from("video_assets")
    .select("stream_uid, duration_sec, ready")
    .eq("episode_id", ep.id)
    .maybeSingle();
  if (assetRes.error) throw new Error(`อ่านวิดีโอไม่สำเร็จ: ${assetRes.error.message}`);
  const asset = assetRes.data;
  let url: string | undefined;
  if (asset?.ready) {
    url = (await signedReadUrls(db, [asset.stream_uid], VIDEO_BUCKET)).get(asset.stream_uid);
  }
  return {
    number: ep.number,
    name: ep.name,
    access: ep.access,
    url,
    durationSec: asset?.duration_sec ?? null,
  };
}

// ---------------------------------------------------------------- หน้าแรกอัตโนมัติ

/**
 * เรื่องฮิต "ช่วงนี้" — คะแนนจากยอดรายวันย้อนหลัง 14 วัน ยอดใหม่หนักกว่ายอดเก่า (ดู ranking.ts)
 * ยังไม่มียอดรายวันเลย → คืนว่าง ผู้เรียกใช้ fallback เองได้ (listPopular / listLatestUpdated)
 */
export async function listTrending(limit = 60): Promise<TitleSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "views");

  const now = new Date();
  const rows = must(
    await publicDb()
      .from("title_views_daily")
      .select("day, view_count, titles!inner(slug)")
      .gte("day", bangkokDayAgo(now, 14))
      .limit(5000),
    "ยอดนิยมช่วงนี้",
  );
  const fresh = (await latestEpisodeSlugs()).slice(0, 5);
  const slugs = trendingSlugs(
    rows.map((r) => ({ slug: r.titles.slug, day: r.day, count: r.view_count })),
    now,
    { fresh },
  );
  return resolveSlugs(slugs, await listAllTitles()).slice(0, limit);
}

/** การขยับอันดับ "ฮิตช่วงนี้" เทียบเมื่อวาน (slug → ขึ้น/ลง/เข้าใหม่) — ว่างถ้ายังไม่มียอดเมื่อวาน */
export async function listTrendingMovement(): Promise<Record<string, RankMove>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "views");

  const now = new Date();
  const rows = must(
    await publicDb()
      .from("title_views_daily")
      .select("day, view_count, titles!inner(slug)")
      .gte("day", bangkokDayAgo(now, 16))
      .limit(5000),
    "ยอดรายวัน",
  );
  const moves = rankMovement(
    rows.map((r) => ({ slug: r.titles.slug, day: r.day, count: r.view_count })),
    now,
  );
  return Object.fromEntries(moves);
}

/** ยอดดู/อ่านสะสมต่อเรื่อง (slug → จำนวน) */
export async function listViewCounts(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "views");

  const rows = must(
    await publicDb().from("title_views").select("view_count, titles!inner(slug)").limit(5000),
    "ยอดดูสะสม",
  );
  return Object.fromEntries(rows.map((r) => [r.titles.slug, Number(r.view_count)]));
}

/** จำนวนผู้ติดตามต่อเรื่อง (นับจากผู้ใช้ที่ล็อกอิน) — เรื่องที่ไม่มีผู้ติดตามไม่อยู่ในผลลัพธ์ */
export async function listFollowerCounts(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "followers");

  const rows = must(await publicDb().rpc("title_follower_counts"), "ผู้ติดตาม");
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.followers)]));
}

/** จำนวนไลก์ต่อตอนของเรื่อง (เลขตอน → จำนวน) — ตอนที่ไม่มีไลก์ไม่อยู่ในผลลัพธ์ */
export async function listEpisodeLikeCounts(slug: string): Promise<Record<number, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "likes");

  const rows = must(await publicDb().rpc("episode_like_counts", { p_slug: slug }), "ไลก์รายตอน");
  return Object.fromEntries(rows.map((r) => [r.number, Number(r.likes)]));
}

export interface HomeSectionRow {
  id: string;
  kind: string;
  title: string;
  position: number;
  /** ยังไม่ตรวจ — ตรวจด้วย parseConfig ตอนแสดงผล */
  config: unknown;
}

/** ส่วนของหน้าแรกที่เปิดอยู่และอยู่ในช่วงเวลา (RLS กรองให้ผู้เยี่ยมชม) เรียงตามตำแหน่ง */
export async function listHomeSections(): Promise<HomeSectionRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("home");

  const rows = must(
    await publicDb()
      .from("home_sections")
      .select("id, kind, title, position, config")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    "ส่วนของหน้าแรก",
  );
  return rows;
}

/** การปักโปรโมท/ซ่อนที่ยังอยู่ในช่วงเวลา (กรองสองชั้น: RLS + activePins) */
export async function listActivePins(): Promise<Pin[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("home", "catalog");

  const rows = must(
    await publicDb()
      .from("home_pins")
      .select("placement, position, starts_at, ends_at, titles!inner(slug)"),
    "การปักโปรโมท",
  );
  return activePins(
    rows.map((r) => ({
      slug: r.titles.slug,
      placement: r.placement as Pin["placement"],
      position: r.position,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
    })),
    new Date(),
  );
}

export interface CollectionView {
  title: string;
  description: string;
  titles: TitleSummary[];
}

/** ชุดคัดสรรตาม slug พร้อมเรื่องในชุด (เรียงตามที่แอดมินจัด) — ไม่พบ/ไม่เผยแพร่ = undefined */
export async function getCollection(slug: string): Promise<CollectionView | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("home", "catalog");

  const { data: row, error } = await publicDb()
    .from("collections")
    .select("title, description, collection_items(position, titles!inner(slug))")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`อ่านชุดคัดสรรจากฐานข้อมูลไม่สำเร็จ: ${error.message}`);
  if (!row) return undefined;
  const slugs = [...row.collection_items]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.titles.slug);
  return {
    title: row.title,
    description: row.description,
    titles: resolveSlugs(slugs, await listAllTitles()),
  };
}
