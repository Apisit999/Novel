/**
 * สัญญากลางของ "ประเภทเนื้อหา" — ทุกประเภทต้องกรอกครบ
 * ตอนนี้เป็น metadata ล้วน (ไม่ผูก React) เพื่อให้เทสต์ง่าย
 * เฟส 1/4/5 จะเพิ่มช่อง reader / uploader ของแต่ละประเภทเข้ามา
 */
export interface ContentTypeDef {
  id: "novel" | "manga" | "video";
  /** ชื่อประเภท เช่น "นิยาย" */
  label: string;
  /** ชื่อเรียกหน่วยย่อย เช่น "ตอน" */
  episodeNoun: string;
  /** กริยาของการบริโภค: อ่าน / ดู */
  verb: string;
  /** progress เก็บเป็นหน่วยอะไร */
  progressUnit: "percent" | "page" | "second";
}
