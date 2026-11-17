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

/**
 * เรื่องเด่นหลายเรื่องสำหรับ Spotlight: ที่แอดมินติ๊กก่อน (อัปเดตล่าสุดก่อน)
 * ถ้าไม่ถึง limit เติมด้วยเรื่องที่อัปเดตล่าสุดที่เหลือ — ไม่ซ้ำกัน
 */
export function pickFeaturedList<T extends { slug: string; featured: boolean }>(
  titles: T[],
  latest: string[],
  limit = 3,
): T[] {
  const rank = (t: T) => {
    const i = latest.indexOf(t.slug);
    return i === -1 ? Infinity : i;
  };
  const byRecency = (a: T, b: T) => rank(a) - rank(b);
  const chosen = titles.filter((t) => t.featured).sort(byRecency);
  const rest = titles.filter((t) => !t.featured).sort(byRecency);
  return [...chosen, ...rest].slice(0, limit);
}

/** แปลงรายการ slug เป็นเรื่อง ข้ามที่ไม่มี (เช่นถูกซ่อน/ลบไปแล้ว) */
export function resolveSlugs<T extends { slug: string }>(slugs: string[], titles: T[]): T[] {
  const bySlug = new Map(titles.map((t) => [t.slug, t]));
  return slugs.flatMap((s) => {
    const t = bySlug.get(s);
    return t ? [t] : [];
  });
}

/**
 * แถวตามแท็กสำหรับหน้าแรก: แท็กที่มีเรื่องมากสุดก่อน (เท่ากันเรียงตามชื่อ ให้ผลคงที่)
 * ข้ามแท็กที่มีน้อยกว่า minTitles เรื่อง เพราะแถวที่มีใบเดียวดูโหรง
 */
export function topTagRows<T extends { tags: string[] }>(
  titles: T[],
  { maxRows = 3, minTitles = 2, perRow = 12 } = {},
): { tag: string; titles: T[] }[] {
  const byTag = new Map<string, T[]>();
  for (const t of titles) {
    for (const tag of new Set(t.tags)) byTag.set(tag, [...(byTag.get(tag) ?? []), t]);
  }
  return [...byTag.entries()]
    .filter(([, list]) => list.length >= minTitles)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "th"))
    .slice(0, maxRows)
    .map(([tag, list]) => ({ tag, titles: list.slice(0, perRow) }));
}

/** slug ของเรื่องที่มีตอนออกภายใน days วันก่อน now (ใช้ติดป้าย "อัป") */
export function recentSlugs(stamps: EpisodeStamp[], now: number, days = 7): string[] {
  const cutoff = now - days * 86_400_000;
  const out = new Set<string>();
  for (const { slug, at } of stamps) {
    const t = Date.parse(at);
    if (Number.isFinite(t) && t >= cutoff && t <= now) out.add(slug);
  }
  return [...out];
}
