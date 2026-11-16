import type { TitleSummary } from "./catalog";

/** วิธีเรียงรายการเรื่องในหน้าหมวด */
export const SORTS = [
  { id: "latest", label: "อัปเดตล่าสุด" },
  { id: "popular", label: "ยอดนิยม" },
  { id: "name", label: "ชื่อ ก–ฮ" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

export function parseSort(v: unknown): SortId {
  return SORTS.some((s) => s.id === v) ? (v as SortId) : "latest";
}

/**
 * เรียงเรื่อง (ไม่แก้อาร์เรย์เดิม)
 * - latest: คงลำดับเดิมจากฐานข้อมูล (ใหม่สุดก่อน)
 * - popular: ยอดดูสะสมมากไปน้อย (ไม่มียอด = 0) เท่ากันเรียงตามชื่อ
 * - name: ตามชื่อ (ภาษาไทย)
 */
export function sortTitles(
  titles: TitleSummary[],
  sort: SortId,
  views: Record<string, number> = {},
): TitleSummary[] {
  const byName = (a: TitleSummary, b: TitleSummary) => a.name.localeCompare(b.name, "th");
  if (sort === "popular") {
    return [...titles].sort((a, b) => (views[b.slug] ?? 0) - (views[a.slug] ?? 0) || byName(a, b));
  }
  if (sort === "name") return [...titles].sort(byName);
  return [...titles];
}

/** ตัวเลขสั้นอ่านง่าย: 1234 → 1.2K, 2500000 → 2.5M */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
