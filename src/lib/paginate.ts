/** แบ่งหน้า (โค้ดล้วน ทดสอบได้) — หน้าที่ขอเกินช่วงถูกบีบเข้าช่วงที่มีจริง ไม่ error */
export interface Page {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  /** ดัชนีเริ่ม/จบ (ใช้กับ slice) */
  start: number;
  end: number;
}

export function parsePage(v: string | string[] | undefined): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

export function paginate(total: number, requested: number, perPage: number): Page {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, requested), totalPages);
  const start = (page - 1) * perPage;
  return { page, perPage, total, totalPages, start, end: Math.min(start + perPage, total) };
}

/** เลขหน้าที่จะแสดงในแถบ: หน้าแรก, หน้ารอบ ๆ ปัจจุบัน, หน้าสุดท้าย (null = จุดไข่ปลา) */
export function pageWindow(page: number, totalPages: number, around = 2): (number | null)[] {
  const keep = new Set<number>([1, totalPages]);
  for (let i = page - around; i <= page + around; i++) if (i >= 1 && i <= totalPages) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}
