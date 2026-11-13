import type { ContentTypeDef } from "./types";
import { novel } from "./novel/definition";
import { manga } from "./manga/definition";
import { video } from "./video/definition";

/**
 * ทะเบียนประเภทเนื้อหา — เพิ่มประเภทใหม่ = สร้างโฟลเดอร์ + เพิ่มบรรทัดเดียวที่นี่
 * เมนู หน้า browse และหน้าอื่นอ่านจากที่นี่ ไม่ต้องแก้ทีละหน้า
 */
export const CONTENT_TYPES: readonly ContentTypeDef[] = [novel, manga, video];

export type ContentTypeId = (typeof CONTENT_TYPES)[number]["id"];

export function getContentType(id: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find((t) => t.id === id);
}
