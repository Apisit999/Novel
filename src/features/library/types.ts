/** รูปแบบข้อมูลห้องสมุดที่ส่งระหว่างเบราว์เซอร์ ↔ เซิร์ฟเวอร์ (อ้างเรื่องด้วย slug, ตอนด้วยเลขตอน) */
export interface ReadProgress {
  number: number;
  /** 0–100 ของตอนนั้น */
  percent: number;
  updatedAt: number;
}

export interface LibraryData {
  favorites: string[];
  progress: Record<string, ReadProgress>;
}

export const EMPTY_LIBRARY: LibraryData = { favorites: [], progress: {} };
