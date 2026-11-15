"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CONTENT_TYPES } from "@/content-types/registry";
import type { TitleSummary, TitleType } from "@/features/catalog/catalog";
import { coverColor } from "@/features/catalog/cover";
import { coverUrl } from "@/features/catalog/cover-url";
import { TYPE_STYLE } from "@/features/catalog/type-style";

type Tab = "all" | TitleType;

/** 10 อันดับยอดฮิต — ตารางปก 5 ช่อง เลขอันดับเป็นป้ายสีประจำประเภทที่มุมปก */
export function TopTen({
  lists,
  heading = "10 อันดับยอดฮิต",
}: {
  lists: Record<Tab, TitleSummary[]>;
  heading?: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "ทั้งหมด" },
    ...CONTENT_TYPES.map((t) => ({ id: t.id as Tab, label: t.label })),
  ];
  const items = lists[tab].slice(0, 10);

  return (
    <section id="zone-top" aria-labelledby="h-top" className="flex scroll-mt-4 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="h-top" className="text-3xl font-bold sm:text-4xl">
            {heading}
          </h2>
          <p className="text-muted">นับจากยอดเข้าชมจริง</p>
        </div>
        <div
          role="group"
          aria-label="แสดงอันดับของ"
          className="border-border bg-surface flex gap-1 rounded-full border p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-11 cursor-pointer rounded-full px-4 font-bold ${
                tab === t.id ? "bg-accent text-accent-foreground" : "text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted">ยังไม่มีเรื่องในหมวดนี้</p>
      ) : (
        <ol className="grid grid-cols-2 gap-x-4 gap-y-8 min-[560px]:grid-cols-3 lg:grid-cols-5">
          {items.map((t, n) => {
            const style = TYPE_STYLE[t.type];
            const image = coverUrl(t.coverKey);
            return (
              <li key={t.slug}>
                <Link href={`/title/${t.slug}`} className="flex flex-col gap-3 no-underline">
                  <span
                    className="relative block aspect-[2/3] rounded-xl"
                    style={{ background: coverColor(t.slug) }}
                  >
                    {image && (
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 220px, 45vw"
                        className="rounded-xl object-cover"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-3 -left-2 flex h-12 min-w-12 items-center justify-center rounded-xl px-2 text-2xl font-bold"
                      style={{ background: style.accent, color: style.fg }}
                    >
                      {n + 1}
                    </span>
                  </span>
                  <span className="text-foreground mt-1 text-lg leading-snug font-bold">
                    <span className="sr-only">อันดับ {n + 1} </span>
                    {t.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
