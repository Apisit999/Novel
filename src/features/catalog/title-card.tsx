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
export function TitleCard({
  title,
  showPremium = false,
}: {
  title: TitleSummary;
  /** แสดงป้าย premium เฉพาะเมื่อเปิด paywall (ช่วงเปิดฟรีทุกอย่างเปิดอ่านได้ ไม่ควรมีป้ายหลอก) */
  showPremium?: boolean;
}) {
  const label = getContentType(title.type)?.label ?? "";
  return (
    <Link href={`/title/${title.slug}`} className="flex flex-col gap-2 no-underline">
      <div
        className="relative flex aspect-[2/3] flex-col items-start justify-between rounded-xl p-3"
        style={{ background: coverColor(title.slug) }}
      >
        <span className="bg-surface text-foreground rounded-full px-3 py-0.5 text-sm font-bold">
          {label}
        </span>
        {showPremium && title.access === "premium" && (
          <span className="bg-accent text-accent-foreground rounded-full px-3 py-0.5 text-sm font-bold">
            Premium
          </span>
        )}
      </div>
      <span className="text-foreground text-lg leading-snug font-bold">{title.name}</span>
      <span className="text-muted text-sm">{STATUS_LABEL[title.status]}</span>
    </Link>
  );
}

/**
 * แถวปกเลื่อนแนวนอน (สไตล์ Netflix) — เลื่อนด้วยนิ้ว/ล้อเมาส์ และโฟกัสด้วยคีย์บอร์ดได้
 * แต่ละการ์ดกว้างคงที่ ให้เห็นปกถัดไปโผล่ครึ่งใบเป็นเครื่องหมายว่าเลื่อนต่อได้
 */
export function TitleRow({
  titles,
  showPremium = false,
}: {
  titles: TitleSummary[];
  showPremium?: boolean;
}) {
  return (
    <ul className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      {titles.map((t) => (
        <li key={t.slug} className="w-36 shrink-0 snap-start sm:w-44">
          <TitleCard title={t} showPremium={showPremium} />
        </li>
      ))}
    </ul>
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
