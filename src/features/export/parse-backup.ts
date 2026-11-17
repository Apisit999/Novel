/**
 * อ่านไฟล์สำรองต่อเรื่อง (novel.md + info.json + translations/<lang>.md ที่ /admin/export สร้าง) กลับเป็นข้อมูลพร้อมกู้คืน
 * โค้ดล้วน ไม่แตะฐานข้อมูล ทดสอบได้
 */
import { splitChapters } from "@/features/import/split-chapters";

export interface RestorableChapter {
  number: number;
  name: string;
  body: string;
  status: "draft" | "scheduled" | "published";
  access: "inherit" | "free" | "premium";
  publishAt: string | null;
  translations: { lang: string; body: string; machine: boolean }[];
}

export interface RestorableTitle {
  slug: string;
  name: string;
  author: string | null;
  synopsis: string;
  status: "ongoing" | "completed" | "hiatus";
  rating: "all" | "13" | "18";
  updateDay: number | null;
  published: boolean;
  tags: string[];
}

export interface RestorableNovel {
  title: RestorableTitle;
  chapters: RestorableChapter[];
  /** ตอนที่มีใน info.json แต่ไม่พบเนื้อหาใน novel.md */
  missingBodies: number[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

function bodiesByNumber(md: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const c of splitChapters(md, { method: "headings" }).chapters) {
    if (c.number !== null && !map.has(c.number)) map.set(c.number, c.body);
  }
  return map;
}

export function parseBackup(
  novelMd: string,
  infoJson: string,
  translationFiles: Record<string, string>,
): RestorableNovel {
  let info: unknown;
  try {
    info = JSON.parse(infoJson);
  } catch {
    throw new Error("info.json อ่านไม่ได้");
  }
  if (!isObj(info) || !isObj(info.title) || !Array.isArray(info.episodes)) {
    throw new Error("info.json ไม่ใช่รูปแบบไฟล์สำรอง");
  }
  const t = info.title;
  if (typeof t.slug !== "string" || typeof t.name !== "string") {
    throw new Error("info.json ไม่มี slug/ชื่อเรื่อง");
  }
  const title: RestorableTitle = {
    slug: t.slug,
    name: t.name,
    author: typeof t.author === "string" && t.author ? t.author : null,
    synopsis: typeof t.synopsis === "string" ? t.synopsis : "",
    status: oneOf(t.status, ["ongoing", "completed", "hiatus"], "ongoing"),
    rating: oneOf(t.rating, ["all", "13", "18"], "all"),
    updateDay:
      typeof t.updateDay === "number" && t.updateDay >= 0 && t.updateDay <= 6 ? t.updateDay : null,
    published: t.published === true,
    tags: Array.isArray(t.tags) ? t.tags.filter((x): x is string => typeof x === "string") : [],
  };

  const bodies = bodiesByNumber(novelMd);
  const trans = new Map<string, Map<number, string>>();
  for (const [lang, md] of Object.entries(translationFiles)) trans.set(lang, bodiesByNumber(md));

  const chapters: RestorableChapter[] = [];
  const missingBodies: number[] = [];
  for (const raw of info.episodes) {
    if (!isObj(raw) || typeof raw.number !== "number" || !Number.isInteger(raw.number)) continue;
    const body = bodies.get(raw.number);
    if (body === undefined) {
      missingBodies.push(raw.number);
      continue;
    }
    const status = oneOf(raw.status, ["draft", "scheduled", "published"], "draft");
    const publishAt = typeof raw.publishAt === "string" ? raw.publishAt : null;
    const tlist = Array.isArray(raw.translations) ? raw.translations : [];
    const translations = tlist.flatMap((x) => {
      if (!isObj(x) || typeof x.lang !== "string") return [];
      const b = trans.get(x.lang)?.get(raw.number as number);
      return b === undefined ? [] : [{ lang: x.lang, body: b, machine: x.machine === true }];
    });
    chapters.push({
      number: raw.number,
      name: typeof raw.name === "string" && raw.name ? raw.name : `ตอนที่ ${raw.number}`,
      body,
      // ตั้งเวลาแต่ไม่มีเวลา → เก็บเป็นฉบับร่างแทน (กันค้างสถานะที่ใช้ไม่ได้)
      status: status === "scheduled" && !publishAt ? "draft" : status,
      access: oneOf(raw.access, ["inherit", "free", "premium"], "inherit"),
      publishAt: status === "scheduled" ? publishAt : null,
      translations,
    });
  }
  return { title, chapters, missingBodies };
}
