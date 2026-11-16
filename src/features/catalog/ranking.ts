/** ตรรกะล้วน ๆ ของอันดับ "ฮิตช่วงนี้" (ไม่แตะฐานข้อมูล จึงทดสอบง่าย) */

export interface DailyView {
  slug: string;
  /** วันที่แบบ YYYY-MM-DD (เวลาไทย) */
  day: string;
  count: number;
}

export interface TrendingOptions {
  /** นับย้อนหลังกี่วัน (เก่ากว่านี้ไม่นับ) */
  windowDays?: number;
  /** ครึ่งชีวิต: ยอดเมื่อ N วันก่อนมีน้ำหนักครึ่งหนึ่งของยอดวันนี้ */
  halfLifeDays?: number;
  /** เรื่องที่เพิ่งมีตอนใหม่ — คูณคะแนนเพิ่มเล็กน้อย ให้เรื่องที่กำลังอัปเดตดันขึ้นก่อน */
  fresh?: string[];
  freshBoost?: number;
}

const DAY_MS = 86_400_000;
const BANGKOK_OFFSET = "+07:00";

/** อายุของวัน (เต็มวัน) ณ เวลา now — วันนี้/อนาคต = 0 */
function ageInDays(day: string, now: Date): number {
  const t = Date.parse(`${day}T00:00:00${BANGKOK_OFFSET}`);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

/**
 * คะแนนแต่ละเรื่อง = Σ ยอดรายวัน × 0.5^(อายุวัน / ครึ่งชีวิต) (× โบนัสถ้ามีตอนใหม่)
 * คืน slug เรียงคะแนนมากไปน้อย (คะแนนเท่ากันเรียงตามชื่อ slug ให้ผลคงที่) เฉพาะเรื่องที่มีคะแนน > 0
 */
export function trendingSlugs(
  rows: DailyView[],
  now: Date,
  { windowDays = 14, halfLifeDays = 3, fresh = [], freshBoost = 1.25 }: TrendingOptions = {},
): string[] {
  const score = new Map<string, number>();
  for (const { slug, day, count } of rows) {
    if (!(count > 0)) continue;
    const age = ageInDays(day, now);
    if (age > windowDays) continue;
    score.set(slug, (score.get(slug) ?? 0) + count * Math.pow(0.5, age / halfLifeDays));
  }
  for (const slug of fresh) {
    const s = score.get(slug);
    if (s !== undefined) score.set(slug, s * freshBoost);
  }
  return [...score.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug]) => slug);
}

/** วันที่ (เวลาไทย) ย้อนหลัง n วัน เป็น YYYY-MM-DD — ใช้เป็นขอบล่างของคิวรียอดรายวัน */
export function bangkokDayAgo(now: Date, days: number): string {
  const shifted = new Date(now.getTime() + 7 * 3_600_000 - days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/** การขยับอันดับเทียบเมื่อวาน: เลขบวก = ขึ้น N อันดับ, ลบ = ลง, "new" = เพิ่งเข้าอันดับ */
export type RankMove = number | "new";

/**
 * เทียบอันดับ "ตอนนี้" กับ "เมื่อวานนี้" (ตัดยอดของวันนี้ออกแล้วคิดอันดับเหมือนเมื่อวาน)
 * คืนเฉพาะเรื่องที่อยู่ในอันดับปัจจุบัน; ยอดเมื่อวานไม่มีเลย (เว็บใหม่) → ไม่แสดงการขยับ (ว่าง)
 * ไม่คิดโบนัสเรื่องมีตอนใหม่ (fresh) กับอันดับเมื่อวาน เพราะไม่รู้ว่าเมื่อวานใครมีตอนใหม่
 */
export function rankMovement(
  rows: DailyView[],
  now: Date,
  opts: TrendingOptions = {},
): Map<string, RankMove> {
  const current = trendingSlugs(rows, now, opts);
  const yesterday = new Date(now.getTime() - DAY_MS);
  const cutoff = bangkokDayAgo(now, 1);
  const previous = trendingSlugs(
    rows.filter((r) => r.day <= cutoff),
    yesterday,
    { ...opts, fresh: [] },
  );
  const out = new Map<string, RankMove>();
  if (previous.length === 0) return out;
  const before = new Map(previous.map((slug, i) => [slug, i]));
  current.forEach((slug, i) => {
    const was = before.get(slug);
    if (was === undefined) out.set(slug, "new");
    else if (was !== i) out.set(slug, was - i);
  });
  return out;
}
