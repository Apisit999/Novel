/**
 * สร้างไฟล์ส่งออก/สำรองนิยาย (โค้ดล้วน ทดสอบได้ ไม่แตะฐานข้อมูล)
 *
 * รูปแบบไฟล์ข้อความรวมทั้งเรื่อง ออกแบบให้ "นำเข้ากลับได้" ด้วยตัวแบ่งตอนของหน้านำเข้า:
 * แต่ละตอนขึ้นต้นด้วยบรรทัดหัวตอนที่ parseHeading() อ่านเลขตอนได้ แล้วตามด้วยเนื้อหา
 */
import { parseHeading } from "@/features/import/split-chapters";

export interface ExportEpisode {
  number: number;
  name: string;
  status: "draft" | "scheduled" | "published";
  access: "inherit" | "free" | "premium";
  publishAt: string | null;
  body: string;
  translations: { lang: string; body: string; machine: boolean }[];
}

export interface ExportTitle {
  slug: string;
  name: string;
  author: string | null;
  synopsis: string;
  status: string;
  rating: string;
  updateDay: number | null;
  published: boolean;
  tags: string[];
}

/**
 * บรรทัดหัวตอนที่นำเข้ากลับแล้วได้เลขตอนเดิม
 * ชื่อตอนที่ขึ้นต้นเป็นหัวตอนอยู่แล้วและเลขตรงกัน (เช่น "ตอนที่ 5 การเดินทาง") ใช้ตามเดิม
 * ไม่งั้นเติม "ตอนที่ N" นำหน้า (เช่น ชื่อ "การเดินทาง" → "ตอนที่ 5 การเดินทาง")
 */
export function chapterHeading(number: number, name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  const parsed = parseHeading(n);
  if (parsed && parsed.number === number) return n;
  return n ? `ตอนที่ ${number} ${n}` : `ตอนที่ ${number}`;
}

/** ข้อความทั้งเรื่องรวมไฟล์เดียว: md = หัวตอนแบบ "# …", txt = หัวตอนล้วน */
export function buildNovelText(
  title: Pick<ExportTitle, "name" | "author">,
  episodes: Pick<ExportEpisode, "number" | "name" | "body">[],
  format: "md" | "txt",
): string {
  const mark = format === "md" ? "# " : "";
  const head = [`${format === "md" ? "# " : ""}${title.name}`];
  const lines = [head[0], title.author ? `ผู้แต่ง: ${title.author}` : ""].filter(Boolean).join("\n\n");
  const chapters = [...episodes]
    .sort((a, b) => a.number - b.number)
    .map((e) => `${mark}${chapterHeading(e.number, e.name)}\n\n${e.body.trim()}`);
  // ชื่อเรื่อง/ผู้แต่งอยู่ก่อนหัวตอนแรก → นำเข้ากลับจะถูกมองเป็น "คำนำ" ที่ไม่นำเข้า ไม่ปนเข้าไปในตอนใด
  return [lines, ...chapters].join("\n\n\n") + "\n";
}

/** ข้อมูลเรื่อง + รายการตอน (ไม่รวมเนื้อหา) เป็น JSON ไว้กู้สถานะ/สิทธิ์/เวลาเผยแพร่ */
export function buildInfoJson(title: ExportTitle, episodes: ExportEpisode[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      title,
      episodes: [...episodes]
        .sort((a, b) => a.number - b.number)
        .map((e) => ({
          number: e.number,
          name: e.name,
          status: e.status,
          access: e.access,
          publishAt: e.publishAt,
          characters: e.body.length,
          translations: e.translations.map((t) => ({ lang: t.lang, machine: t.machine })),
        })),
    },
    null,
    2,
  );
}

/** ชื่อไฟล์/โฟลเดอร์ปลอดภัย (ภาษาอังกฤษ ตัวเลข ขีด) จาก slug */
export function safeFileStem(slug: string): string {
  // ตัดจุด/ขีดหัวท้ายด้วย: ชื่อที่เป็น ".." ล้วนไม่ควรเป็นชื่อไฟล์/โฟลเดอร์
  return slug.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "novel";
}
