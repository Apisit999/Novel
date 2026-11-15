"use client";

import { useState } from "react";
import type { TitleOption } from "./title-options";

const TYPE_LABEL = { novel: "นิยาย", manga: "มังงะ", video: "วิดีโอ" } as const;
const small =
  "border-border bg-surface min-h-10 min-w-10 cursor-pointer rounded-full border px-3 font-bold disabled:cursor-default disabled:opacity-30";

/**
 * เลือกเรื่องเป็นรายการที่เรียงลำดับได้ (เพิ่มจากรายชื่อ, ↑ ↓ เรียง, ✕ เอาออก)
 * ส่งค่าไปกับฟอร์มเป็น slug บรรทัดละหนึ่งเรื่อง ใน input ซ่อนชื่อ `name`
 */
export function TitlePicker({
  name,
  options,
  initial = [],
  max = 24,
  label,
}: {
  name: string;
  options: TitleOption[];
  initial?: string[];
  max?: number;
  label: string;
}) {
  const bySlug = new Map(options.map((o) => [o.slug, o]));
  const [slugs, setSlugs] = useState(() => initial.filter((s) => bySlug.has(s)));
  const [pick, setPick] = useState("");
  const available = options.filter((o) => !slugs.includes(o.slug));

  const move = (i: number, d: -1 | 1) =>
    setSlugs((cur) => {
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <input type="hidden" name={name} value={slugs.join("\n")} />
      {slugs.length === 0 ? (
        <p className="text-muted text-sm">ยังไม่ได้เลือกเรื่อง</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {slugs.map((s, i) => {
            const o = bySlug.get(s)!;
            return (
              <li
                key={s}
                className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-xl border p-2 pl-4"
              >
                <span className="min-w-0 flex-1">
                  {i + 1}. {o.name}{" "}
                  <span className="text-muted text-sm">
                    {TYPE_LABEL[o.type]}
                    {!o.published && " · ยังไม่เผยแพร่"}
                  </span>
                </span>
                <button
                  type="button"
                  className={small}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`เลื่อน ${o.name} ขึ้น`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={small}
                  disabled={i === slugs.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`เลื่อน ${o.name} ลง`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={small}
                  onClick={() => setSlugs((cur) => cur.filter((x) => x !== s))}
                  aria-label={`เอา ${o.name} ออก`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {slugs.length < max && (
        <div className="flex flex-wrap gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label={`เลือกเรื่องที่จะเพิ่มใน${label}`}
            className="border-border bg-surface text-foreground min-h-12 min-w-0 flex-1 rounded-xl border-2 px-4"
          >
            <option value="">— เลือกเรื่อง —</option>
            {available.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name} ({TYPE_LABEL[o.type]}){o.published ? "" : " · ยังไม่เผยแพร่"}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pick}
            onClick={() => {
              setSlugs((cur) => [...cur, pick]);
              setPick("");
            }}
            className="bg-accent text-accent-foreground min-h-12 cursor-pointer rounded-full px-6 font-bold disabled:opacity-50"
          >
            เพิ่ม
          </button>
        </div>
      )}
    </div>
  );
}
