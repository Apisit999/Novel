/**
 * อ่านไฟล์ต้นฉบับนิยายในเบราว์เซอร์ → ข้อความ (ไม่อัปโหลดไฟล์ไปเซิร์ฟเวอร์ ส่งเฉพาะตอนที่ตรวจแล้ว)
 * รองรับ .docx (Word), .txt, .md
 */

/**
 * ถอดรหัสไฟล์ข้อความ: ลอง UTF-8 ก่อน ถ้าไม่ใช่ UTF-8 (ไฟล์ .txt ภาษาไทยจาก Windows รุ่นเก่ามักเป็น
 * Windows-874/TIS-620) จึงถอดเป็น windows-874 — กันภาษาไทยกลายเป็นตัวอักษรเพี้ยน
 */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-874").decode(buffer);
  }
}

export type SupportedKind = "docx" | "text";

export function fileKind(name: string): SupportedKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".markdown")) return "text";
  return null;
}

export class UnsupportedFileError extends Error {}

export async function readNovelFile(file: File): Promise<string> {
  const kind = fileKind(file.name);
  if (!kind) {
    const hint = /\.(doc|pdf|rtf|odt|pages)$/i.test(file.name)
      ? " (ไฟล์ชนิดนี้ยังไม่รองรับ — เปิดแล้วบันทึกเป็น .docx หรือ .txt ก่อน)"
      : "";
    throw new UnsupportedFileError(`ไม่รองรับไฟล์ ${file.name}${hint} — รองรับ .docx .txt .md`);
  }
  const buffer = await file.arrayBuffer();
  if (kind === "text") return decodeText(buffer);

  // โหลดตัวอ่าน Word เฉพาะตอนที่ใช้ (ไม่ให้หน้าแอดมินอื่นหนักขึ้น)
  const mod = await import("mammoth/mammoth.browser");
  const mammoth = mod.default ?? mod;
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value;
}

/** ชื่อไฟล์ไม่รวมนามสกุล (ไว้ใช้เป็นชื่อตอนสำรอง) */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
