import type { Access, EpisodeAccess } from "@/features/access/can-access";

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

interface CatalogEntry extends TitleSummary {
  /** ตอนของนิยาย (มังงะ/วิดีโอจะมาในเฟส 4/5) */
  novelEpisodes: NovelEpisode[];
}

/**
 * ช่องทางเดียวที่หน้าเว็บใช้ดึงข้อมูลเรื่อง/ตอน — รองรับกี่เรื่องก็ได้ ทุกเรื่องมีตอนของตัวเอง
 * ตอนนี้อ่านจากข้อมูลจำลอง; เมื่อฐานข้อมูลพร้อม เปลี่ยนแค่ไฟล์นี้เป็น query Supabase
 */
function makeEpisodes(count: number, premiumFrom?: number): NovelEpisode[] {
  return Array.from({ length: count }, (_, i) => {
    const number = i + 1;
    const premium = premiumFrom !== undefined && number >= premiumFrom;
    return {
      number,
      name: `ตอนที่ ${number}${premium ? " (premium)" : ""}`,
      access: premium ? "premium" : "inherit",
      bodyMarkdown: [
        `นี่คือเนื้อหาตัวอย่างของตอนที่ ${number}`,
        "ย่อหน้าตัวอย่างสำหรับทดสอบการเลื่อนอ่านและแถบความคืบหน้า ข้อความนี้ยาวพอให้เห็นการตัดบรรทัดบนหน้าจอหลายขนาด ตั้งแต่มือถือจนถึงจอคอมพิวเตอร์",
        "ย่อหน้าที่สามของตอน ใช้ทดสอบการปรับขนาดตัวอักษร ฟอนต์ และธีมสีของตัวอ่าน",
        "ย่อหน้าที่สี่ ผู้อ่านสามารถปัดหรือกดลูกศรเพื่อไปตอนถัดไปได้",
        "ย่อหน้าสุดท้ายของตอน",
      ].join("\n\n"),
      translations: {
        en: {
          bodyMarkdown: [
            `This is the sample content of episode ${number}.`,
            "A sample paragraph for testing scrolling and the progress bar. This text is long enough to show line wrapping on many screen sizes, from phones to desktop monitors.",
            "The third paragraph, used to test font size, typeface and color themes in the reader.",
            "The fourth paragraph. Readers can swipe or press the arrow keys to reach the next episode.",
            "The last paragraph of the episode.",
          ].join("\n\n"),
          machine: false,
        },
        zh: {
          bodyMarkdown: [
            `这是第 ${number} 集的示例内容。`,
            "用于测试滚动和进度条的示例段落。这段文字足够长，可以在从手机到电脑显示器的多种屏幕尺寸上显示换行效果。",
            "第三段，用于测试阅读器中的字体大小、字体和颜色主题。",
            "第四段。读者可以滑动或按方向键前往下一集。",
            "本集的最后一段。",
          ].join("\n\n"),
          machine: true,
        },
      },
    };
  });
}

const CATALOG: CatalogEntry[] = [
  {
    slug: "sample-novel",
    type: "novel",
    name: "นิยายตัวอย่าง",
    synopsis: "เรื่องย่อของนิยายตัวอย่างสำหรับทดสอบระบบ",
    status: "ongoing",
    access: "free",
    tags: ["แฟนตาซี", "แอ็คชัน"],
    novelEpisodes: makeEpisodes(2, 2),
  },
  {
    slug: "moonlit-garden",
    type: "novel",
    name: "สวนใต้แสงจันทร์",
    synopsis: "เรื่องรักอบอุ่นของคนสองคนในสวนเก่าแห่งหนึ่ง",
    status: "completed",
    access: "free",
    tags: ["โรแมนติก"],
    novelEpisodes: makeEpisodes(5),
  },
  {
    slug: "dragon-ledger",
    type: "novel",
    name: "บัญชีมังกร",
    synopsis: "นักบัญชีหนุ่มถูกลากเข้าสู่สงครามระหว่างอาณาจักรมังกร",
    status: "ongoing",
    access: "premium",
    tags: ["แฟนตาซี"],
    novelEpisodes: makeEpisodes(4),
  },
  {
    slug: "sample-manga",
    type: "manga",
    name: "มังงะตัวอย่าง",
    synopsis: "มังงะตัวอย่างสำหรับทดสอบระบบ",
    status: "ongoing",
    access: "free",
    tags: [],
    novelEpisodes: [],
  },
  {
    slug: "sample-video",
    type: "video",
    name: "วิดีโอตัวอย่าง",
    synopsis: "วิดีโอ placeholder สำหรับทดสอบระบบ",
    status: "ongoing",
    access: "premium",
    tags: [],
    novelEpisodes: [],
  },
];

function toSummary(entry: CatalogEntry): TitleSummary {
  const { novelEpisodes, ...summary } = entry;
  void novelEpisodes;
  return summary;
}

export async function listTitles(
  type: TitleType,
  filter: TitleFilter = {},
): Promise<TitleSummary[]> {
  return CATALOG.filter(
    (t) =>
      t.type === type &&
      (!filter.tag || t.tags.includes(filter.tag)) &&
      (!filter.status || t.status === filter.status),
  ).map(toSummary);
}

/** แท็กทั้งหมดที่มีในประเภทนี้ (ไว้ทำตัวกรอง) */
export async function listTags(type: TitleType): Promise<string[]> {
  return [...new Set(CATALOG.filter((t) => t.type === type).flatMap((t) => t.tags))].sort();
}

export async function getTitle(slug: string): Promise<TitleSummary | undefined> {
  const entry = CATALOG.find((t) => t.slug === slug);
  return entry && toSummary(entry);
}

export async function listEpisodes(slug: string): Promise<EpisodeSummary[]> {
  const entry = CATALOG.find((t) => t.slug === slug);
  return (entry?.novelEpisodes ?? []).map(({ number, name, access }) => ({
    number,
    name,
    access,
  }));
}

/** คืนเนื้อหาเต็ม — ผู้เรียกต้องตรวจ canAccess ก่อนเสมอ */
export async function getNovelEpisode(
  slug: string,
  number: number,
): Promise<NovelEpisode | undefined> {
  return CATALOG.find((t) => t.slug === slug)?.novelEpisodes.find((e) => e.number === number);
}

/** ค้นหาจากชื่อ เรื่องย่อ และแท็ก ข้ามทุกประเภท (ตอนนี้จับคำตรง ๆ; ค้นหาไทยจริงจังรอเฟส 6) */
export async function searchTitles(query: string): Promise<TitleSummary[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOG.filter((t) =>
    [t.name, t.synopsis, ...t.tags].some((s) => s.toLowerCase().includes(q)),
  ).map(toSummary);
}

/** เรื่องเด่นหน้าแรก (เฟส 3 ให้แอดมินเลือกเอง) */
export async function getFeatured(): Promise<TitleSummary | undefined> {
  const entry = CATALOG.find((t) => t.type === "novel" && t.access === "premium") ?? CATALOG[0];
  return entry && toSummary(entry);
}

/** ทุกเรื่องพร้อมตอน (ไว้สร้าง sitemap) — เฉพาะที่ผู้เยี่ยมชมเปิดอ่านได้ฟรี */
export async function listForSitemap(): Promise<
  { title: TitleSummary; episodes: EpisodeSummary[] }[]
> {
  return CATALOG.map((entry) => ({
    title: toSummary(entry),
    episodes: entry.novelEpisodes
      .filter((e) => (e.access === "inherit" ? entry.access : e.access) === "free")
      .map(({ number, name, access }) => ({ number, name, access })),
  }));
}

/** ทุกเรื่อง (สรุป) — ส่งให้หน้าห้องสมุดฝั่งเบราว์เซอร์จับคู่กับรายการโปรด/ประวัติที่เก็บในเครื่อง */
export async function listAllTitles(): Promise<TitleSummary[]> {
  return CATALOG.map(toSummary);
}
