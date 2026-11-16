/**
 * ตัวแบ่งตอนนิยายจากข้อความยาว ๆ (โค้ดล้วน ไม่แตะฐานข้อมูล/เบราว์เซอร์ จึงทดสอบได้ละเอียด)
 *
 * ออกแบบเป็น "วิธีแบ่ง" (strategy) ที่มีรูปแบบเดียวกัน: (ข้อความ, ตัวเลือก) → รายการตอน + คำเตือน
 * วิธีแบ่งใหม่ในอนาคต (เช่น ให้ AI ช่วยหาขอบเขตตอน) เพิ่มเป็นฟังก์ชันอีกตัวที่คืนผลรูปแบบเดียวกัน
 * โดยหน้านำเข้า/หน้าตัวอย่าง/ตัวบันทึกไม่ต้องแก้ (ดู SplitMethod ด้านล่าง)
 */

export interface DraftChapter {
  /** เลขตอนที่อ่านได้จากหัวตอน (null = ไม่พบ ให้เรียงต่อจากตอนก่อนหน้า) */
  number: number | null;
  /** ชื่อตอน (ปกติคือบรรทัดหัวตอนเดิม) */
  name: string;
  body: string;
  warnings: string[];
}

export type SplitMethod = "headings" | "separator" | "size";

export interface SplitOptions {
  method: SplitMethod;
  /** ใช้เมื่อไม่พบหัวตอนเลย: ตั้งชื่อตอนเดียวที่ได้ (เช่นชื่อไฟล์) */
  fallbackName?: string;
  /** method = "size": จำนวนตัวอักษรเป้าหมายต่อตอน */
  targetChars?: number;
}

export interface SplitResult {
  chapters: DraftChapter[];
  /** ข้อความที่อยู่ก่อนหัวตอนแรก (เช่นคำนำ/ชื่อเรื่อง) — ไม่ถูกนำเข้า แต่แจ้งให้รู้ */
  preface: string;
}

/** ตอนหนึ่งยาวเกินนี้ใกล้ถึงเพดานของระบบ (500,000 ตัวอักษร) */
export const MAX_CHAPTER_CHARS = 500_000;
const VERY_SHORT_CHARS = 200;
const VERY_LONG_CHARS = 200_000;

// ---------------------------------------------------------------- ทำความสะอาดข้อความ

/**
 * จัดข้อความให้พร้อมแบ่งตอน
 * - ตัด BOM / อักขระความกว้างศูนย์ / ช่องว่างท้ายบรรทัด, ยุบบรรทัดว่างติดกันเกิน 1 บรรทัด
 * - paragraphs: "auto" = ถ้าข้อความส่วนใหญ่ไม่มีบรรทัดว่างคั่น (หนึ่งบรรทัด = หนึ่งย่อหน้า แบบที่นิยายไทยมักเป็น)
 *   ให้คั่นย่อหน้าด้วยบรรทัดว่างให้ทุกบรรทัด; "keep" = ไม่แตะ; "every-line" = บังคับทุกบรรทัด
 */
export function normalizeText(
  raw: string,
  paragraphs: "auto" | "keep" | "every-line" = "auto",
): string {
  let t = raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[​‌‍⁠]/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const every =
    paragraphs === "every-line" || (paragraphs === "auto" && looksLineBasedParagraphs(t));
  if (every) t = t.replace(/([^\n])\n(?=[^\n])/g, "$1\n\n");
  return t;
}

/** ข้อความที่ "หนึ่งบรรทัด = หนึ่งย่อหน้า": ตัวคั่นย่อหน้าส่วนใหญ่เป็นแค่ขึ้นบรรทัดใหม่ ไม่ใช่บรรทัดว่าง */
function looksLineBasedParagraphs(text: string): boolean {
  const single = (text.match(/[^\n]\n(?=[^\n])/g) ?? []).length;
  const blank = (text.match(/\n\n/g) ?? []).length;
  return single > 0 && single >= blank * 2;
}

// ---------------------------------------------------------------- ตัวเลข

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function digitsToNumber(s: string): number | null {
  const ascii = [...s]
    .map((c) => (THAI_DIGITS.includes(c) ? String(THAI_DIGITS.indexOf(c)) : c))
    .join("");
  return /^\d{1,6}$/.test(ascii) ? Number(ascii) : null;
}

const ZH_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** เลขจีนพื้นฐาน (一百二十三 → 123) ครอบคลุมถึงหลักพัน; อ่านไม่ได้ = null */
export function chineseToNumber(s: string): number | null {
  if (!s) return null;
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let current = 0;
  for (const c of s) {
    if (c in ZH_DIGITS) {
      current = current * 10 + ZH_DIGITS[c];
    } else if (c in units) {
      total += (current === 0 ? 1 : current) * units[c];
      current = 0;
    } else {
      return null;
    }
  }
  return total + current;
}

function toNumber(s: string): number | null {
  return digitsToNumber(s) ?? chineseToNumber(s);
}

// ---------------------------------------------------------------- หัวตอน

const NUM = String.raw`([0-9๐-๙]{1,6}|[零〇一二两兩三四五六七八九十百千]{1,8})`;

/** แบบหัวตอนที่รู้จัก (ทั้งบรรทัด ไม่ยาวเกิน 120 ตัวอักษร) */
const HEADING_PATTERNS: RegExp[] = [
  // ตอนที่ 12 / บทที่ ๑๒ / ตอน 12 / บท 12  (+ ชื่อตอนต่อท้าย)
  new RegExp(String.raw`^(?:ตอนที่|บทที่|ตอน|บท)\s*${NUM}(?:\s*[:：.\-–—]\s*|\s+|$)(.*)$`),
  // Chapter 12 / Ch.12 / Episode 12 / Ep 12
  new RegExp(
    String.raw`^(?:chapter|ch\.?|episode|ep\.?)\s*${NUM}(?:\s*[:：.\-–—]\s*|\s+|$)(.*)$`,
    "i",
  ),
  // 第12章 / 第十二回
  new RegExp(String.raw`^第\s*${NUM}\s*[章回话話节節](?:\s*[:：.\-–—]?\s*|$)(.*)$`),
];

/** ถ้าบรรทัดเป็นหัวตอน คืนเลขตอน + ข้อความหัวตอนเต็ม; ไม่ใช่ = null */
export function parseHeading(line: string): { number: number; title: string } | null {
  const text = line.replace(/^#{1,3}\s*/, "").trim(); // ยอมรับ "# ตอนที่ 1" แบบ Markdown
  if (!text || text.length > 120) return null;
  for (const re of HEADING_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const n = toNumber(m[1]);
    if (n === null || n < 1) continue;
    return { number: n, title: text };
  }
  return null;
}

// ---------------------------------------------------------------- วิธีแบ่ง

/** ตัวช่วยสร้างตอน + คำเตือนระดับตอน */
function makeChapter(number: number | null, name: string, bodyRaw: string): DraftChapter {
  const body = bodyRaw.trim();
  const warnings: string[] = [];
  if (body.length === 0) warnings.push("ตอนนี้ไม่มีเนื้อหา");
  else if (body.length < VERY_SHORT_CHARS) warnings.push("เนื้อหาสั้นมาก (อาจแบ่งตอนผิดจุด)");
  if (body.length > MAX_CHAPTER_CHARS) {
    warnings.push(`เนื้อหายาวเกินเพดาน ${MAX_CHAPTER_CHARS.toLocaleString("th-TH")} ตัวอักษร`);
  } else if (body.length > VERY_LONG_CHARS) {
    warnings.push("เนื้อหายาวมาก (อาจรวมหลายตอนไว้ด้วยกัน)");
  }
  return { number, name: name.trim() || "ไม่มีชื่อตอน", body, warnings };
}

/** แบ่งตามหัวตอน เช่น "ตอนที่ 1", "บทที่ 2: ...", "Chapter 3", "第4章" */
function splitByHeadings(text: string, opts: SplitOptions): SplitResult {
  const lines = text.split("\n");
  const chapters: DraftChapter[] = [];
  const preface: string[] = [];
  let cur: { number: number; name: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h = parseHeading(line);
    if (h) {
      if (cur) chapters.push(makeChapter(cur.number, cur.name, cur.lines.join("\n")));
      cur = { number: h.number, name: h.title, lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      preface.push(line);
    }
  }
  if (cur) chapters.push(makeChapter(cur.number, cur.name, cur.lines.join("\n")));

  if (chapters.length === 0) {
    // ไม่พบหัวตอนเลย → ทั้งไฟล์เป็นตอนเดียว (เช่นไฟล์ละตอน ใช้ชื่อไฟล์เป็นชื่อตอน)
    const c = makeChapter(null, opts.fallbackName ?? "ตอนใหม่", text);
    return { chapters: text.trim() ? [c] : [], preface: "" };
  }
  return { chapters, preface: preface.join("\n").trim() };
}

/** แบ่งด้วยบรรทัดคั่น เช่น *** / === / ### (ตั้งแต่ 3 ตัวขึ้นไปทั้งบรรทัด) */
function splitBySeparator(text: string, opts: SplitOptions): SplitResult {
  const parts = text.split(/^\s*(?:\*{3,}|={3,}|#{3,}|_{3,})\s*$/m);
  const chapters = parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p, i) => makeChapter(null, opts.fallbackName ? `${opts.fallbackName} ${i + 1}` : "", p));
  return { chapters, preface: "" };
}

/** แบ่งตามความยาวเป้าหมาย โดยตัดที่ขอบย่อหน้า (ไม่ตัดกลางย่อหน้า) */
function splitBySize(text: string, opts: SplitOptions): SplitResult {
  const target = Math.max(500, opts.targetChars ?? 6000);
  const paragraphs = text.split(/\n{2,}/);
  const chapters: DraftChapter[] = [];
  let buf: string[] = [];
  let len = 0;
  const flush = () => {
    if (buf.length) chapters.push(makeChapter(null, "", buf.join("\n\n")));
    buf = [];
    len = 0;
  };
  for (const p of paragraphs) {
    if (len > 0 && len + p.length > target) flush();
    buf.push(p);
    len += p.length;
  }
  flush();
  return { chapters, preface: "" };
}

/**
 * แบ่งข้อความเป็นตอน แล้วตรวจความผิดปกติข้ามตอน (เลขซ้ำ/เลขข้าม/ชื่อซ้ำ) ใส่เป็นคำเตือน
 * ข้อความควรผ่าน normalizeText มาก่อน
 */
export function splitChapters(text: string, opts: SplitOptions): SplitResult {
  const result =
    opts.method === "separator"
      ? splitBySeparator(text, opts)
      : opts.method === "size"
        ? splitBySize(text, opts)
        : splitByHeadings(text, opts);
  annotateCrossChapter(result.chapters);
  return result;
}

function annotateCrossChapter(chapters: DraftChapter[]) {
  const seen = new Map<number, number>();
  const names = new Map<string, number>();
  let prev: number | null = null;
  chapters.forEach((c, i) => {
    if (c.number !== null) {
      if (seen.has(c.number)) c.warnings.push(`เลขตอน ${c.number} ซ้ำกับตอนก่อนหน้า`);
      else seen.set(c.number, i);
      if (prev !== null && c.number > prev + 1) {
        c.warnings.push(`เลขตอนข้ามจาก ${prev} เป็น ${c.number} (อาจขาดตอน)`);
      } else if (prev !== null && c.number < prev) {
        c.warnings.push(`เลขตอนย้อนกลับจาก ${prev} เป็น ${c.number}`);
      }
      prev = c.number;
    }
    const key = c.name.trim();
    if (key && names.has(key) && c.number === null) c.warnings.push("ชื่อตอนซ้ำกับตอนก่อนหน้า");
    names.set(key, i);
  });
}

// ---------------------------------------------------------------- กำหนดเลขตอนสุดท้าย

export interface NumberedChapter extends DraftChapter {
  /** เลขตอนที่จะใช้บันทึกจริง */
  finalNumber: number;
}

/**
 * ตัดสินเลขตอนที่จะบันทึก
 * - "from-headings": ใช้เลขจากหัวตอน; ตอนที่ไม่มีเลขเรียงต่อจากตอนก่อนหน้า (ตอนแรกที่ไม่มีเลข = startNumber)
 * - "sequential": เรียง startNumber, startNumber+1, … ตามลำดับ (ไม่สนเลขในหัวตอน)
 */
export function assignNumbers(
  chapters: DraftChapter[],
  mode: "from-headings" | "sequential",
  startNumber: number,
): NumberedChapter[] {
  let next = startNumber;
  return chapters.map((c) => {
    const n = mode === "from-headings" && c.number !== null ? c.number : next;
    next = n + 1;
    return { ...c, finalNumber: n };
  });
}

/** เลขตอนที่ซ้ำกันในรายการ (ไว้เตือนก่อนบันทึก) */
export function duplicateNumbers(chapters: NumberedChapter[]): number[] {
  const count = new Map<number, number>();
  for (const c of chapters) count.set(c.finalNumber, (count.get(c.finalNumber) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n > 1).map(([n]) => n);
}
