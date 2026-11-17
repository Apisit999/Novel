/**
 * จัดกลุ่มไฟล์รูปจากโฟลเดอร์ที่เลือก (webkitRelativePath) เป็นตอน: โฟลเดอร์ย่อยละตอน
 *   เรื่อง/ตอน 1/001.jpg → ตอน "ตอน 1"; ไฟล์วางตรงใน root → ตอนเดียว
 * เลขตอนดึงจากตัวเลขแรกในชื่อโฟลเดอร์ ถ้าไม่มี/ซ้ำ ให้ไล่ต่อจากเลขสูงสุดที่ใช้ไปแล้ว
 */
export interface FolderFile {
  path: string;
  file: File;
}
export interface ChapterGroup {
  folder: string;
  number: number;
  name: string;
  files: File[];
}

const IMAGE = /\.(jpe?g|png|webp)$/i;
const natural = (a: string, b: string) =>
  a.localeCompare(b, "th", { numeric: true, sensitivity: "base" });

export function groupChapterFolders(items: FolderFile[], startAt = 1): ChapterGroup[] {
  const byFolder = new Map<string, File[]>();
  for (const { path, file } of items) {
    if (!IMAGE.test(path)) continue;
    const parts = path.split("/").filter(Boolean);
    const folder = parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : "";
    if (!folder) continue;
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  }
  const used = new Set<number>();
  return [...byFolder.keys()].sort(natural).map((folder) => {
    const m = /\d+/.exec(folder);
    let number = m ? parseInt(m[0], 10) : 0;
    if (number < 1 || used.has(number)) number = Math.max(startAt - 1, 0, ...used) + 1;
    used.add(number);
    const files = [...(byFolder.get(folder) ?? [])].sort((a, b) => natural(a.name, b.name));
    return { folder, number, name: folder.trim().slice(0, 200), files };
  });
}
