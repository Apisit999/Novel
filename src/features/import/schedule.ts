/**
 * ตั้งเวลาเผยแพร่เป็นชุด: ตอนลำดับที่ i (นับจาก 0) ขึ้นวันที่ startDate + floor(i / perDay) เวลา time (เวลาไทย)
 * คืนรูปแบบเดียวกับ input datetime-local ("YYYY-MM-DDTHH:mm") ที่ thaiLocalToIso() รับได้
 * คำนวณวันด้วยเลขวันที่ล้วน (UTC) ไม่ผ่านเขตเวลาเครื่อง จึงไม่เพี้ยนตามที่ผู้ใช้เปิดเว็บอยู่
 */
export interface ScheduleOptions {
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "HH:mm" */
  time: string;
  /** ลงวันละกี่ตอน (≥ 1) */
  perDay: number;
}

export function validScheduleOptions(o: ScheduleOptions): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(o.startDate) &&
    !Number.isNaN(Date.parse(`${o.startDate}T00:00:00Z`)) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(o.time) &&
    Number.isInteger(o.perDay) &&
    o.perDay >= 1 &&
    o.perDay <= 100
  );
}

export function schedulePublishAt(index: number, o: ScheduleOptions): string {
  const day = Math.floor(index / o.perDay);
  const d = new Date(`${o.startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return `${d.toISOString().slice(0, 10)}T${o.time}`;
}
