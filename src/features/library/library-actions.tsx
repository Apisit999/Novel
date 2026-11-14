"use client";

import Link from "next/link";
import { toggleFavorite, useLibrary } from "./local-library";

const pill = "flex min-h-12 items-center rounded-full px-6 font-bold no-underline";

export function FavoriteButton({ slug }: { slug: string }) {
  const { favorites } = useLibrary();
  const on = favorites.includes(slug);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggleFavorite(slug)}
      className={`${pill} cursor-pointer border-2 ${
        on ? "bg-accent text-accent-foreground border-accent" : "border-accent text-accent"
      }`}
    >
      {on ? "อยู่ในเรื่องที่ชอบ ✓" : "เพิ่มในเรื่องที่ชอบ"}
    </button>
  );
}

/** ปุ่มเริ่มอ่าน / อ่านต่อ — ขึ้นอยู่กับว่าเคยอ่านเรื่องนี้ค้างไว้ไหม */
export function ReadButton({ slug, firstNumber }: { slug: string; firstNumber: number }) {
  const { progress } = useLibrary();
  const saved = progress[slug];
  return saved ? (
    <Link
      href={`/read/${slug}/${saved.number}`}
      className={`${pill} bg-accent text-accent-foreground`}
    >
      อ่านต่อ ตอนที่ {saved.number}
    </Link>
  ) : (
    <Link
      href={`/read/${slug}/${firstNumber}`}
      className={`${pill} bg-accent text-accent-foreground`}
    >
      เริ่มอ่าน ตอนที่ {firstNumber}
    </Link>
  );
}
