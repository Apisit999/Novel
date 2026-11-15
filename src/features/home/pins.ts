/** ตรรกะล้วน ๆ ของการปักโปรโมท/ซ่อนเรื่องในหน้าแรก (ทดสอบง่าย ไม่แตะฐานข้อมูล) */

export type Placement = "spotlight" | "top_ten_boost" | "hidden";

export interface Pin {
  slug: string;
  placement: Placement;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
}

/** ปักที่ยังอยู่ในช่วงเวลา ณ now (ไม่ตั้งเวลา = ใช้ได้เสมอ) เรียงตาม position */
export function activePins(pins: Pin[], now: Date): Pin[] {
  const t = now.getTime();
  return pins
    .filter((p) => {
      if (p.startsAt && Date.parse(p.startsAt) > t) return false;
      if (p.endsAt && Date.parse(p.endsAt) <= t) return false;
      return true;
    })
    .sort((a, b) => a.position - b.position);
}

const slugsOf = (pins: Pin[], placement: Placement) =>
  pins.filter((p) => p.placement === placement).map((p) => p.slug);

/** ตัดเรื่องที่แอดมินสั่งซ่อนจากหน้าแรกออก */
export function withoutHidden<T extends { slug: string }>(titles: T[], pins: Pin[]): T[] {
  const hidden = new Set(slugsOf(pins, "hidden"));
  return hidden.size === 0 ? titles : titles.filter((t) => !hidden.has(t.slug));
}

/** เอาเรื่องที่ปักไว้ขึ้นก่อน (ตาม position) ที่เหลือคงลำดับเดิม ไม่ซ้ำ */
function pinnedFirst<T extends { slug: string }>(base: T[], pool: T[], pinned: string[]): T[] {
  const bySlug = new Map(pool.map((t) => [t.slug, t]));
  const head = pinned.flatMap((s) => {
    const t = bySlug.get(s);
    return t ? [t] : [];
  });
  const seen = new Set(head.map((t) => t.slug));
  return [...head, ...base.filter((t) => !seen.has(t.slug))];
}

/** เรื่องเด่น: ที่ปักไว้ก่อน แล้วเติมด้วย base (เรื่องที่แอดมินติ๊ก/อัปเดตล่าสุด) ตัดที่ limit */
export function spotlightOrder<T extends { slug: string }>(
  base: T[],
  pool: T[],
  pins: Pin[],
  limit: number,
): T[] {
  return pinnedFirst(base, pool, slugsOf(pins, "spotlight")).slice(0, limit);
}

/** อันดับ: เรื่องที่ถูกดันขึ้นก่อน ที่เหลือตามคะแนนเดิม */
export function boostRanking<T extends { slug: string }>(ranked: T[], pool: T[], pins: Pin[]): T[] {
  return pinnedFirst(ranked, pool, slugsOf(pins, "top_ten_boost"));
}
