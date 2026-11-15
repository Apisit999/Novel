/**
 * ค้นหาเรื่อง — ตัดคำด้วย Intl.Segmenter (รองรับภาษาไทยที่ไม่มีช่องว่างคั่นคำ)
 * ทุกคำในคำค้นต้องเจอ (AND) และเรียงคะแนน: ชื่อ > แท็ก > เรื่องย่อ
 * ทำในหน่วยความจำกับแคตตาล็อกที่แคชไว้แล้ว — พอเรื่องเกินหลักพัน ค่อยย้ายไป pg_trgm ในฐานข้อมูล
 */

export interface Searchable {
  name: string;
  synopsis: string;
  tags: string[];
}

const segmenter = new Intl.Segmenter("th", { granularity: "word" });

/** ทำให้ข้อความเทียบกันได้: ตัวพิมพ์เล็ก + รวมรูปอักขระ */
export function normalize(text: string): string {
  // NFC ไม่ใช่ NFKC: NFKC แตกสระ "ำ" เป็น "ํ"+"า" ทำให้ตัดคำไทยเพี้ยน
  return text.normalize("NFC").toLowerCase();
}

/** แตกคำค้นเป็นคำ (ตัดช่องว่าง/เครื่องหมายทิ้ง); ไม่เกิน 8 คำเพื่อกันคำค้นยาวผิดปกติ */
export function tokenize(query: string): string[] {
  const tokens: string[] = [];
  for (const part of segmenter.segment(normalize(query))) {
    if (part.isWordLike) tokens.push(part.segment);
  }
  return [...new Set(tokens)].slice(0, 8);
}

/** คะแนนความตรง (0 = ไม่ตรง); ทุก token ต้องเจออย่างน้อยหนึ่งช่อง */
export function scoreTitle(title: Searchable, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = normalize(title.name);
  const tags = title.tags.map(normalize);
  const synopsis = normalize(title.synopsis);

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    if (name.includes(token)) best = name.startsWith(token) ? 12 : 10;
    else if (tags.some((t) => t.includes(token))) best = 6;
    else if (synopsis.includes(token)) best = 2;
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function searchIn<T extends Searchable>(items: T[], query: string): T[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return items
    .map((item, index) => ({ item, index, score: scoreTitle(item, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
