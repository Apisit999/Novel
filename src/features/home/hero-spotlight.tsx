"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getContentType } from "@/content-types/registry";
import type { TitleSummary } from "@/features/catalog/catalog";
import { coverColor } from "@/features/catalog/cover";
import { coverUrl } from "@/features/catalog/cover-url";
import { TYPE_STYLE } from "@/features/catalog/type-style";
import { FavoriteButton } from "@/features/library/library-actions";

const nav =
  "border-border bg-surface text-foreground flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 text-2xl";

/** เรื่องเด่นหลายเรื่อง — เปลี่ยนด้วยปุ่ม ‹ › เท่านั้น (ไม่สลับเอง เพื่อให้อ่านทันทุกวัย) */
export function HeroSpotlight({ titles }: { titles: TitleSummary[] }) {
  const [i, setI] = useState(0);
  if (titles.length === 0) return null;
  const at = i % titles.length;
  const t = titles[at];
  const def = getContentType(t.type);
  const style = TYPE_STYLE[t.type];
  const image = coverUrl(t.coverKey);
  const go = (n: number) => setI((at + n + titles.length) % titles.length);

  return (
    <section aria-label="เรื่องเด่น" className="flex flex-col gap-4">
      <div
        className="border-border flex flex-col-reverse items-center gap-8 rounded-3xl border p-6 sm:flex-row sm:gap-12 sm:p-10"
        style={{ background: style.tint, borderTop: `6px solid ${style.accent}` }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4 text-center sm:text-left">
          <span
            className="self-center rounded-full px-4 py-0.5 text-base font-bold sm:self-start"
            style={{ background: style.accent, color: style.fg }}
          >
            {def?.label}
          </span>
          <h2 className="text-3xl leading-tight font-bold sm:text-5xl">{t.name}</h2>
          <p className="text-muted max-w-xl text-lg sm:line-clamp-4">{t.synopsis}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Link
              href={`/title/${t.slug}`}
              className="flex min-h-14 items-center rounded-full px-8 text-lg font-bold no-underline"
              style={{ background: style.accent, color: style.fg }}
            >
              เริ่ม{def?.verb}
            </Link>
            <FavoriteButton slug={t.slug} />
          </div>
        </div>
        <div
          className="relative aspect-[2/3] w-44 shrink-0 rounded-2xl shadow-lg sm:w-64"
          style={{ background: coverColor(t.slug) }}
        >
          {image && (
            <Image
              src={image}
              alt={`ปก ${t.name}`}
              fill
              priority
              sizes="(min-width: 640px) 256px, 176px"
              className="rounded-2xl object-cover"
            />
          )}
        </div>
      </div>

      {titles.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" aria-label="เรื่องเด่นก่อนหน้า" onClick={() => go(-1)} className={nav}>
            ‹
          </button>
          <span className="flex items-center gap-2" role="group" aria-label="เลือกเรื่องเด่น">
            {titles.map((x, n) => (
              <button
                key={x.slug}
                type="button"
                aria-label={`แสดง ${x.name}`}
                aria-current={n === at}
                onClick={() => setI(n)}
                className="h-3 cursor-pointer rounded-full border-0 p-0"
                style={{
                  width: n === at ? 36 : 12,
                  background: n === at ? "var(--accent)" : "var(--border)",
                }}
              />
            ))}
          </span>
          <button type="button" aria-label="เรื่องเด่นถัดไป" onClick={() => go(1)} className={nav}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}
