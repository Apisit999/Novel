import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isPaywallEnabled } from "@/features/access/paywall";
import { listAllTitles } from "@/features/catalog/catalog";
import { bangkokWeekday, parseWeekday, WEEKDAYS, weekdayLabel } from "@/features/catalog/schedule";
import { TitleCard, TitleGrid } from "@/features/catalog/title-card";

export const metadata: Metadata = {
  title: "ตารางอัปเดตรายวัน",
  description: "เรื่องที่อัปเดตตอนใหม่ในแต่ละวันของสัปดาห์",
  alternates: { canonical: "/schedule" },
};

async function Schedule({ props }: { props: PageProps<"/schedule"> }) {
  const query = await props.searchParams;
  const today = bangkokWeekday(new Date());
  const day = parseWeekday(query.day) ?? today;
  const [all, showPremium] = await Promise.all([listAllTitles(), isPaywallEnabled()]);
  // เรื่องที่จบแล้วไม่อยู่ในตาราง (ไม่มีตอนใหม่ให้รอ)
  const titles = all.filter((t) => t.updateDay === day && t.status !== "completed");

  return (
    <>
      <nav aria-label="เลือกวัน" className="mt-4 flex flex-wrap gap-2">
        {WEEKDAYS.map((d) => (
          <Link
            key={d.id}
            href={`/schedule?day=${d.id}`}
            aria-current={d.id === day ? "true" : undefined}
            className={`flex min-h-12 items-center rounded-full border px-5 font-bold no-underline ${
              d.id === day
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border bg-surface text-foreground"
            }`}
          >
            {d.label}
            {d.id === today && <span className="ml-2 text-sm font-normal">วันนี้</span>}
          </Link>
        ))}
      </nav>
      {titles.length === 0 ? (
        <p className="text-muted mt-6">ยังไม่มีเรื่องที่อัปเดตทุกวัน{weekdayLabel(day)}</p>
      ) : (
        <div className="mt-6">
          <TitleGrid>
            {titles.map((t) => (
              <TitleCard
                key={t.slug}
                title={t}
                showPremium={showPremium}
                meta={`ทุกวัน${weekdayLabel(day)}`}
              />
            ))}
          </TitleGrid>
        </div>
      )}
    </>
  );
}

export default function SchedulePage(props: PageProps<"/schedule">) {
  return (
    <section>
      <h1 className="text-2xl font-bold">ตารางอัปเดตรายวัน</h1>
      <p className="text-muted">เลือกวันเพื่อดูว่าเรื่องไหนมีตอนใหม่</p>
      <Suspense fallback={<p className="text-muted mt-4">กำลังโหลด…</p>}>
        <Schedule props={props} />
      </Suspense>
    </section>
  );
}
