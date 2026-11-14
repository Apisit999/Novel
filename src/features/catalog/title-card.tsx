import Link from "next/link";
import { getContentType } from "@/content-types/registry";
import { coverColor } from "./cover";
import type { TitleStatus, TitleSummary } from "./catalog";

export const STATUS_LABEL: Record<TitleStatus, string> = {
  ongoing: "กำลังอัปเดต",
  completed: "จบแล้ว",
  hiatus: "พักการอัปเดต",
};

/** การ์ดเรื่อง ปกใหญ่ 2:3 — ใช้ร่วมทุกหน้า (หน้าแรก, หมวด, ค้นหา) */
export function TitleCard({ title }: { title: TitleSummary }) {
  const label = getContentType(title.type)?.label ?? "";
  return (
    <Link href={`/title/${title.slug}`} className="flex flex-col gap-2 no-underline">
      <div
        className="relative aspect-[2/3] rounded-xl p-3"
        style={{ background: coverColor(title.slug) }}
      >
        <span className="bg-surface text-foreground rounded-full px-3 py-0.5 text-sm font-bold">
          {label}
        </span>
      </div>
      <span className="text-foreground text-lg leading-snug font-bold">{title.name}</span>
      <span className="text-muted text-sm">{STATUS_LABEL[title.status]}</span>
    </Link>
  );
}

/** ตารางปก: 2 คอลัมน์บนมือถือ → 3 → 4 → 5 ตามความกว้างจอ */
export function TitleGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {children}
    </div>
  );
}
