/** ตารางอัปเดตรายสัปดาห์: 0 = อาทิตย์ … 6 = เสาร์ (เวลาไทย) */
export const WEEKDAYS = [
  { id: 1, label: "จันทร์" },
  { id: 2, label: "อังคาร" },
  { id: 3, label: "พุธ" },
  { id: 4, label: "พฤหัสบดี" },
  { id: 5, label: "ศุกร์" },
  { id: 6, label: "เสาร์" },
  { id: 0, label: "อาทิตย์" },
] as const;

export function weekdayLabel(day: number): string {
  return WEEKDAYS.find((d) => d.id === day)?.label ?? "";
}

/** วันในสัปดาห์ตามเวลาไทยของเวลา now (0 = อาทิตย์) */
export function bangkokWeekday(now: Date): number {
  return new Date(now.getTime() + 7 * 3_600_000).getUTCDay();
}

/** ค่าจากฟอร์ม/URL → วัน 0–6 หรือ null (ว่าง/ไม่ถูกต้อง) */
export function parseWeekday(v: unknown): number | null {
  if (typeof v !== "string" || !/^[0-6]$/.test(v)) return null;
  return Number(v);
}

/** วันที่แบบไทยสั้น ๆ เช่น "17 พ.ย. 69" (เวลาไทย, ปี พ.ศ. 2 หลัก) */
const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
export function thaiShortDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${String((d.getUTCFullYear() + 543) % 100).padStart(2, "0")}`;
}

/** ตอนที่ขึ้นภายใน days วันก่อน now (ใช้ติดป้าย "ใหม่") */
export function isRecent(iso: string | undefined, now: number, days = 7): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t <= now && now - t < days * 86_400_000;
}
