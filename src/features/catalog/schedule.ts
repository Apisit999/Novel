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
