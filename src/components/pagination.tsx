import Link from "next/link";
import { pageWindow } from "@/lib/paginate";

const cell =
  "border-border flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 font-bold no-underline";

/**
 * แถบแบ่งหน้า: ก่อนหน้า · 1 … 4 5 [6] 7 8 … 20 · ถัดไป
 * ลิงก์ธรรมดา (ทำงานได้โดยไม่ต้องมี JS, กดย้อนกลับได้) — href(page) สร้างลิงก์ของแต่ละหน้า
 * หน้า 1 ควรชี้ URL ไม่มี ?page เพื่อไม่ให้ซ้ำกับหน้าหลัก (กำหนดใน href)
 */
export function Pagination({
  page,
  totalPages,
  href,
  label = "แบ่งหน้า",
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-6 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${cell} bg-surface`}>
          ‹ ก่อนหน้า
        </Link>
      ) : null}
      {pageWindow(page, totalPages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} aria-hidden="true" className="text-muted px-1">
            …
          </span>
        ) : n === page ? (
          <span key={n} aria-current="page" className={`${cell} bg-accent text-accent-foreground`}>
            {n}
          </span>
        ) : (
          <Link key={n} href={href(n)} aria-label={`ไปหน้า ${n}`} className={`${cell} bg-surface`}>
            {n}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={`${cell} bg-surface`}>
          ถัดไป ›
        </Link>
      ) : null}
    </nav>
  );
}
