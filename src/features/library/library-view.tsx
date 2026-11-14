"use client";

import Link from "next/link";
import type { TitleSummary } from "@/features/catalog/catalog";
import { TitleCard, TitleGrid } from "@/features/catalog/title-card";
import { useLibrary } from "./local-library";

/** แถว "อ่านต่อ" — เรียงจากอ่านล่าสุด (ว่างถ้ายังไม่เคยอ่าน จึงไม่แสดงอะไร) */
export function ContinueStrip({ titles }: { titles: TitleSummary[] }) {
  const { progress } = useLibrary();
  const items = titles
    .filter((t) => progress[t.slug])
    .sort((a, b) => progress[b.slug].updatedAt - progress[a.slug].updatedAt)
    .slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="sec-continue" className="flex flex-col gap-4">
      <h2
        id="sec-continue"
        className="border-border border-b-2 pb-2 text-2xl font-bold sm:text-3xl"
      >
        อ่านต่อ
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t) => (
          <Link
            key={t.slug}
            href={`/read/${t.slug}/${progress[t.slug].number}`}
            className="border-border bg-surface flex min-h-16 flex-col justify-center rounded-2xl border p-4 no-underline"
          >
            <span className="text-foreground font-bold">{t.name}</span>
            <span className="text-muted text-sm">
              ตอนที่ {progress[t.slug].number} · อ่านแล้ว {progress[t.slug].percent}%
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function LibraryView({ titles }: { titles: TitleSummary[] }) {
  const { favorites } = useLibrary();
  const favs = favorites
    .map((slug) => titles.find((t) => t.slug === slug))
    .filter((t): t is TitleSummary => !!t);

  return (
    <div className="flex flex-col gap-10">
      <ContinueStrip titles={titles} />
      <section aria-labelledby="sec-fav" className="flex flex-col gap-4">
        <h2 id="sec-fav" className="border-border border-b-2 pb-2 text-2xl font-bold sm:text-3xl">
          เรื่องที่ชอบ
        </h2>
        {favs.length === 0 ? (
          <p className="text-muted">ยังไม่มีเรื่องที่ชอบ — กด “เพิ่มในเรื่องที่ชอบ” ในหน้าเรื่องเพื่อเก็บไว้ที่นี่</p>
        ) : (
          <TitleGrid>
            {favs.map((t) => (
              <TitleCard key={t.slug} title={t} />
            ))}
          </TitleGrid>
        )}
      </section>
      <p className="text-muted text-sm">รายการนี้เก็บในเครื่องนี้เท่านั้น — เมื่อมีระบบบัญชี จะซิงก์ข้ามเครื่องให้</p>
    </div>
  );
}
