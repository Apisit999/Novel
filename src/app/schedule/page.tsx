import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isPaywallEnabled } from "@/features/access/paywall";
import { listAllTitles, listRecentSlugs } from "@/features/catalog/catalog";
import { bangkokWeekday, parseWeekday, WEEKDAYS, weekdayLabel } from "@/features/catalog/schedule";
import { Pagination } from "@/components/pagination";
import { paginate, parsePage } from "@/lib/paginate";
import { TitleCard, TitleGrid } from "@/features/catalog/title-card";

const PER_PAGE = 24;

export const metadata: Metadata = {
  title: "ตารางอัปเดตรายวัน",
  description: "เรื่องที่อัปเดตตอนใหม่ในแต่ละวันของสัปดาห์",
  alternates: { canonical: "/schedule" },
};

async function Schedule({ props }: { props: PageProps<"/schedule"> }) {
  const query = await props.searchParams;
  const today = bangkokWeekday(new Date());
  const done = query.day === "done"; // แท็บ "จบแล้ว" (เหมือนแท็บจบแล้วของ WEBTOON)
  const day = parseWeekday(query.day) ?? today;
  const [all, showPremium, recentList] = await Promise.all([
    listAllTitles(),
    isPaywallEnabled(),
    listRecentSlugs(),
  ]);
  const recent = new Set(recentList);
  // เรื่องที่จบแล้วไม่อยู่ในตาราง (ไม่มีตอนใหม่ให้รอ)
  const matched = done
    ? all.filter((t) => t.status === "completed").sort((a, b) => a.name.localeCompare(b.name, "th"))
    : all.filter((t) => t.updateDay === day && t.status !== "completed");
  const pg = paginate(matched.length, parsePage(query.page), PER_PAGE);
  const titles = matched.slice(pg.start, pg.end);

  return (
    <>
      <nav aria-label="เลือกวัน" className="mt-4 flex flex-wrap gap-2">
        {WEEKDAYS.map((d) => (
          <Link
            key={d.id}
            href={`/schedule?day=${d.id}`}
            aria-current={!done && d.id === day ? "true" : undefined}
            className={`flex min-h-12 items-center rounded-full border px-5 font-bold no-underline ${
              !done && d.id === day
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border bg-surface text-foreground"
            }`}
          >
            {d.label}
            {d.id === today && <span className="ml-2 text-sm font-normal">วันนี้</span>}
          </Link>
        ))}
        <Link
          href="/schedule?day=done"
          aria-current={done ? "true" : undefined}
          className={`flex min-h-12 items-center rounded-full border px-5 font-bold no-underline ${
            done
              ? "bg-accent text-accent-foreground border-accent"
              : "border-border bg-surface text-foreground"
          }`}
        >
          จบแล้ว
        </Link>
      </nav>
      {titles.length === 0 ? (
        <p className="text-muted mt-6">
          {done ? "ยังไม่มีเรื่องที่จบแล้ว" : `ยังไม่มีเรื่องที่อัปเดตทุกวัน${weekdayLabel(day)}`}
        </p>
      ) : (
        <div className="mt-6">
          <TitleGrid>
            {titles.map((t) => (
              <TitleCard
                key={t.slug}
                title={t}
                showPremium={showPremium}
                recent={recent.has(t.slug)}
                meta={done ? "จบแล้ว" : `ทุกวัน${weekdayLabel(day)}`}
              />
            ))}
          </TitleGrid>
          <Pagination
            page={pg.page}
            totalPages={pg.totalPages}
            href={(n) => {
              const base = done ? "/schedule?day=done" : `/schedule?day=${day}`;
              return n > 1 ? `${base}&page=${n}` : base;
            }}
          />
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
