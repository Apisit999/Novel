"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgress } from "@/features/library/local-library";

export interface ReaderPage {
  pageNo: number;
  url: string;
  width: number | null;
  height: number | null;
}

interface Props {
  slug: string;
  number: number;
  titleName: string;
  titleHref: string;
  episodeName: string;
  pages: ReaderPage[];
  prevHref?: string;
  nextHref?: string;
}

type Mode = "scroll" | "page";
const MODE_KEY = "aandoo:manga-mode";

const btn =
  "border-border bg-surface text-foreground hover:border-accent min-h-12 min-w-12 cursor-pointer rounded-full border px-4 font-bold";

/**
 * ตัวอ่านมังงะ
 * - เลื่อนลง (webtoon): ค่าเริ่มต้น เหมาะกับมือถือ รูปโหลดแบบ lazy และจองพื้นที่ตามสัดส่วนรูปจึงไม่เด้ง
 * - พลิกหน้า: ทีละหน้า แตะ/กดลูกศรเพื่อเปลี่ยนหน้า โหลดหน้าถัดไป 2 หน้าไว้ล่วงหน้า
 */
export function MangaReader({
  slug,
  number,
  titleName,
  titleHref,
  episodeName,
  pages,
  prevHref,
  nextHref,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("scroll");
  const [index, setIndex] = useState(0); // หน้าปัจจุบัน (โหมดพลิกหน้า)
  const [progress, setProgress] = useState(0);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const lastY = useRef(0);
  const total = pages.length;

  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "page" || saved === "scroll") setMode(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const chooseMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
    window.scrollTo({ top: 0 });
  };

  // โหมดพลิกหน้า: โหลดหน้าถัดไปไว้ล่วงหน้า (ให้พลิกแล้วขึ้นทันที)
  useEffect(() => {
    if (mode !== "page") return;
    for (const p of pages.slice(index + 1, index + 3)) new Image().src = p.url;
  }, [mode, index, pages]);

  // ความคืบหน้า: เลื่อนลง = ตามการเลื่อน, พลิกหน้า = หน้าที่อยู่ / ทั้งหมด
  useEffect(() => {
    if (mode === "page") {
      setProgress(total ? Math.round(((index + 1) / total) * 100) : 0); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    function onScroll() {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((y / max) * 100)) : 100);
      if (Math.abs(y - lastY.current) > 8) {
        setToolbarVisible(y < lastY.current || y < 80);
        lastY.current = y;
      }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode, index, total]);

  // กลับไปตำแหน่งที่อ่านค้าง (เลื่อนลงเท่านั้น ครั้งเดียว) — รูปจองพื้นที่ไว้แล้วจึงเลื่อนไปถูกที่
  useEffect(() => {
    if (mode !== "scroll") return;
    try {
      const raw = localStorage.getItem("aandoo:library:v1");
      const saved = raw ? JSON.parse(raw)?.progress?.[slug] : null;
      if (saved?.number === number && saved.percent > 5 && saved.percent < 100) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: (max * saved.percent) / 100 });
      }
    } catch {
      /* เริ่มต้นตอนปกติ */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => saveProgress(slug, number, progress), 600);
    return () => clearTimeout(t);
  }, [slug, number, progress]);

  const go = useCallback(
    (delta: 1 | -1) => {
      if (mode === "page") {
        const target = index + delta;
        if (target >= 0 && target < total) {
          setIndex(target);
          window.scrollTo({ top: 0 });
          return;
        }
      }
      const href = delta === 1 ? nextHref : prevHref; // สุดหน้า → ไปตอนถัดไป/ก่อนหน้า
      if (href) router.push(href);
    },
    [mode, index, total, nextHref, prevHref, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (total === 0) {
    return (
      <article>
        <p className="text-muted text-sm">
          <Link href={titleHref}>{titleName}</Link>
        </p>
        <h1 className="text-2xl font-bold">{episodeName}</h1>
        <p className="text-muted mt-4">ตอนนี้ยังไม่มีรูป</p>
      </article>
    );
  }

  const ratio = (p: ReaderPage) => (p.width && p.height ? `${p.width} / ${p.height}` : "2 / 3");

  return (
    <article>
      <div
        role="progressbar"
        aria-label="ความคืบหน้าการอ่าน"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="bg-border fixed inset-x-0 top-0 z-50 h-1.5"
      >
        <div className="bg-accent h-full transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div
        role="toolbar"
        aria-label="ตั้งค่าการอ่าน"
        className={`border-border bg-surface sticky top-0 z-40 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b px-4 py-2 transition-transform sm:-mx-6 sm:px-6 ${
          toolbarVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex gap-2" role="group" aria-label="โหมดการอ่าน">
          {(
            [
              ["scroll", "เลื่อนลง"],
              ["page", "พลิกหน้า"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => chooseMode(m)}
              className={`${btn} ${mode === m ? "bg-accent text-accent-foreground border-accent" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "page" && (
          <span className="text-muted ml-auto" aria-live="polite">
            หน้า {index + 1} / {total}
          </span>
        )}
      </div>

      <p className="text-muted text-sm">
        <Link href={titleHref}>{titleName}</Link>
      </p>
      <h1 className="mb-4 text-2xl font-bold">{episodeName}</h1>

      {mode === "scroll" ? (
        <div className="mx-auto flex max-w-[860px] flex-col">
          {pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.pageNo}
              src={p.url}
              alt={`หน้า ${p.pageNo}`}
              width={p.width ?? undefined}
              height={p.height ?? undefined}
              loading={i < 2 ? "eager" : "lazy"}
              decoding="async"
              className="bg-surface block h-auto w-full"
              style={{ aspectRatio: ratio(p) }}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-[860px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={pages[index].pageNo}
            src={pages[index].url}
            alt={`หน้า ${pages[index].pageNo}`}
            width={pages[index].width ?? undefined}
            height={pages[index].height ?? undefined}
            decoding="async"
            className="bg-surface mx-auto block h-auto max-h-[calc(100dvh-8rem)] w-auto max-w-full object-contain"
            style={{ aspectRatio: ratio(pages[index]) }}
          />
          <div className="mt-4 flex justify-between gap-3">
            <button type="button" onClick={() => go(-1)} className={btn} aria-label="หน้าก่อนหน้า">
              ← ก่อนหน้า
            </button>
            <button type="button" onClick={() => go(1)} className={btn} aria-label="หน้าถัดไป">
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      <nav aria-label="เปลี่ยนตอน" className="mx-auto mt-10 flex max-w-[860px] justify-between gap-3">
        {prevHref ? (
          <Link href={prevHref} className={`${btn} flex items-center no-underline`}>
            ← ตอนก่อนหน้า
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Link href={nextHref} className={`${btn} flex items-center no-underline`}>
            ตอนถัดไป →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
