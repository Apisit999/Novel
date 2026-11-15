/** ตรรกะล้วน ๆ ของแถวหน้าแรก (ไม่แตะฐานข้อมูล จึงทดสอบง่าย) */

export interface EpisodeStamp {
  slug: string;
  /** เวลาที่ตอนออก: publish_at ถ้ามี ไม่งั้น created_at */
  at: string;
}

/** slug ของเรื่องเรียงตามตอนล่าสุดที่ออก (ใหม่สุดก่อน) โดยเรื่องละหนึ่งครั้ง */
export function latestSlugs(stamps: EpisodeStamp[]): string[] {
  const newest = new Map<string, number>();
  for (const { slug, at } of stamps) {
    const t = Date.parse(at);
    if (Number.isNaN(t)) continue;
    if (t > (newest.get(slug) ?? -Infinity)) newest.set(slug, t);
  }
  return [...newest.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
}

/**
 * เรื่องเด่นสำหรับแบนเนอร์: เลือกจากที่แอดมินติ๊ก "เรื่องเด่น" (เรื่องที่อัปเดตล่าสุดก่อน)
 * ถ้าไม่มีใครติ๊กเลย ใช้เรื่องที่อัปเดตล่าสุดแทน — หน้าแรกจะไม่มีวันว่าง
 */
export function pickFeatured<T extends { slug: string; featured: boolean }>(
  titles: T[],
  latest: string[],
): T | undefined {
  const rank = (t: T) => {
    const i = latest.indexOf(t.slug);
    return i === -1 ? Infinity : i;
  };
  const byRecency = (a: T, b: T) => rank(a) - rank(b);
  const chosen = titles.filter((t) => t.featured).sort(byRecency);
  if (chosen.length > 0) return chosen[0];
  return [...titles].sort(byRecency)[0];
}

/** แปลงรายการ slug เป็นเรื่อง ข้ามที่ไม่มี (เช่นถูกซ่อน/ลบไปแล้ว) */
export function resolveSlugs<T extends { slug: string }>(slugs: string[], titles: T[]): T[] {
  const bySlug = new Map(titles.map((t) => [t.slug, t]));
  return slugs.flatMap((s) => {
    const t = bySlug.get(s);
    return t ? [t] : [];
  });
}
