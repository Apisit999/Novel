/** สีปกชั่วคราว (จนกว่าจะมีรูปปกจริงจาก R2) — คงที่ต่อเรื่อง สีมาจากชุดสีของดีไซน์ */
const PALETTE = ["#8a5a3c", "#6e7a4f", "#5a6e82", "#8a5560", "#7a6a3c", "#566b66"];

export function coverColor(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
