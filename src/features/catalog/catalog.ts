import type { Access, EpisodeAccess } from "@/features/access/can-access";

export interface TitleSummary {
  slug: string;
  type: "novel" | "manga" | "video";
  name: string;
  synopsis: string;
  status: "ongoing" | "completed" | "hiatus";
  access: Access;
  tags: string[];
}

export interface EpisodeSummary {
  number: number;
  name: string;
  access: EpisodeAccess;
}

export interface NovelEpisode extends EpisodeSummary {
  bodyMarkdown: string;
}

/**
 * ช่องทางเดียวที่หน้าเว็บใช้ดึงข้อมูลเรื่อง/ตอน
 * ตอนนี้อ่านจากข้อมูลจำลอง (สะท้อน supabase/seed.sql) — เมื่อฐานข้อมูลพร้อม
 * เปลี่ยนแค่ไฟล์นี้เป็น query Supabase โดยหน้าเว็บไม่ต้องแก้
 */
const TITLES: TitleSummary[] = [
  {
    slug: "sample-novel",
    type: "novel",
    name: "นิยายตัวอย่าง",
    synopsis: "เรื่องย่อของนิยายตัวอย่างสำหรับทดสอบระบบ",
    status: "ongoing",
    access: "free",
    tags: ["แฟนตาซี", "แอ็คชัน"],
  },
  {
    slug: "sample-manga",
    type: "manga",
    name: "มังงะตัวอย่าง",
    synopsis: "มังงะตัวอย่างสำหรับทดสอบระบบ",
    status: "ongoing",
    access: "free",
    tags: [],
  },
  {
    slug: "sample-video",
    type: "video",
    name: "วิดีโอตัวอย่าง",
    synopsis: "วิดีโอ placeholder สำหรับทดสอบระบบ",
    status: "ongoing",
    access: "premium",
    tags: [],
  },
];

const NOVEL_EPISODES: Record<string, NovelEpisode[]> = {
  "sample-novel": [
    { number: 1, name: "ตอนที่ 1", access: "inherit", bodyMarkdown: "นี่คือเนื้อหาตัวอย่างของตอนแรก" },
    {
      number: 2,
      name: "ตอนที่ 2 (premium)",
      access: "premium",
      bodyMarkdown: "เนื้อหา premium สำหรับทดสอบ",
    },
  ],
};

export async function listTitles(type: TitleSummary["type"]): Promise<TitleSummary[]> {
  return TITLES.filter((t) => t.type === type);
}

export async function getTitle(slug: string): Promise<TitleSummary | undefined> {
  return TITLES.find((t) => t.slug === slug);
}

export async function listEpisodes(slug: string): Promise<EpisodeSummary[]> {
  return (NOVEL_EPISODES[slug] ?? []).map(({ number, name, access }) => ({ number, name, access }));
}

/** คืนเนื้อหาเต็ม — ผู้เรียกต้องตรวจ canAccess ก่อนเสมอ */
export async function getNovelEpisode(
  slug: string,
  number: number,
): Promise<NovelEpisode | undefined> {
  return NOVEL_EPISODES[slug]?.find((e) => e.number === number);
}
