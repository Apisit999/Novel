/** ค้นหา-แทนที่แบบตรงตัว (ไม่ใช่ regex) — โค้ดล้วน ทดสอบได้ */
export interface ReplaceResult {
  text: string;
  count: number;
}

export function replaceLiteral(
  text: string,
  find: string,
  replacement: string,
  matchCase: boolean,
): ReplaceResult {
  if (!find) return { text, count: 0 };
  const hay = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? find : find.toLowerCase();
  // toLowerCase อาจเปลี่ยนความยาวสตริง (อักขระพิเศษบางตัว) → ถ้าไม่ตรง ใช้ตำแหน่งจากต้นฉบับไม่ได้ จึงยอมแพ้อย่างปลอดภัย
  if (hay.length !== text.length) return replaceLiteral(text, find, replacement, true);
  let out = "";
  let i = 0;
  let count = 0;
  for (;;) {
    const j = hay.indexOf(needle, i);
    if (j < 0) break;
    out += text.slice(i, j) + replacement;
    i = j + find.length;
    count++;
  }
  return { text: count ? out + text.slice(i) : text, count };
}

/** ข้อความรอบจุดที่พบแรก (ไว้โชว์ตัวอย่างก่อนบันทึก) */
export function firstSnippet(text: string, find: string, matchCase: boolean, radius = 30): string {
  const j = (matchCase ? text : text.toLowerCase()).indexOf(matchCase ? find : find.toLowerCase());
  if (j < 0) return "";
  const a = Math.max(0, j - radius);
  return (
    (a > 0 ? "…" : "") +
    text.slice(a, j + find.length + radius).replace(/\s+/g, " ") +
    (j + find.length + radius < text.length ? "…" : "")
  );
}
