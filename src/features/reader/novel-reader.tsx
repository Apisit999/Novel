"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type ReaderLang = "th" | "en" | "zh";

export interface ReaderBody {
  text: string;
  machine: boolean;
}

interface Props {
  titleName: string;
  titleHref: string;
  episodeName: string;
  bodies: Partial<Record<ReaderLang, ReaderBody>>;
  prevHref?: string;
  nextHref?: string;
}

const LANG_LABEL: Record<ReaderLang, string> = { th: "ไทย (ต้นฉบับ)", en: "English", zh: "中文" };
const MIN_SIZE = 1;
const MAX_SIZE = 2;

function setSize(delta: number) {
  const root = document.documentElement;
  const current = parseFloat(getComputedStyle(root).getPropertyValue("--read-size")) || 1.2;
  const next = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round((current + delta) * 100) / 100));
  root.style.setProperty("--read-size", `${next}rem`);
  localStorage.setItem("size", String(next));
}

function toggleFont() {
  const root = document.documentElement;
  const next = root.dataset.font === "sans" ? "serif" : "sans";
  root.dataset.font = next;
  localStorage.setItem("font", next);
}

const btn =
  "border-border bg-surface text-foreground hover:border-accent min-h-12 min-w-12 cursor-pointer rounded-full border px-4 font-bold";

/** ตัวอ่านนิยาย: ขนาด/ฟอนต์/ภาษา, แถบความคืบหน้า, ซ่อนเครื่องมือเมื่อเลื่อนลง, ลูกศรเปลี่ยนตอน */
export function NovelReader({
  titleName,
  titleHref,
  episodeName,
  bodies,
  prevHref,
  nextHref,
}: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<ReaderLang>("th");
  const [progress, setProgress] = useState(0);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("lang") as ReaderLang | null;
    if (saved && bodies[saved]) setLang(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, [bodies]);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((y / max) * 100)) : 100);
      // เลื่อนลง = ซ่อน, เลื่อนขึ้น = แสดง
      if (Math.abs(y - lastY.current) > 8) {
        setToolbarVisible(y < lastY.current || y < 80);
        lastY.current = y;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft" && prevHref) router.push(prevHref);
      if (e.key === "ArrowRight" && nextHref) router.push(nextHref);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [router, prevHref, nextHref]);

  const body = bodies[lang] ?? bodies.th!;
  const langs = (Object.keys(LANG_LABEL) as ReaderLang[]).filter((l) => bodies[l]);

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
        className={`border-border bg-surface sticky top-0 z-40 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b px-4 py-2 transition-transform sm:-mx-6 sm:px-6 ${
          toolbarVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="ภาษา">
          {langs.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={l === lang}
              onClick={() => {
                setLang(l);
                localStorage.setItem("lang", l);
              }}
              className={`${btn} ${l === lang ? "bg-accent text-accent-foreground border-accent" : ""}`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setSize(-0.1)}
            aria-label="ลดขนาดตัวอักษร"
            className={btn}
          >
            ก−
          </button>
          <button
            type="button"
            onClick={() => setSize(0.1)}
            aria-label="เพิ่มขนาดตัวอักษร"
            className={btn}
          >
            ก+
          </button>
          <button
            type="button"
            onClick={toggleFont}
            aria-label="สลับแบบตัวอักษร มีหัว/ไม่มีหัว"
            className={btn}
          >
            ฟอนต์
          </button>
        </div>
      </div>

      <p className="text-muted text-sm">
        <Link href={titleHref}>{titleName}</Link>
      </p>
      <h1 className="text-2xl font-bold">{episodeName}</h1>

      {body.machine && (
        <p className="bg-surface border-border mt-3 inline-block rounded-full border px-4 py-1 text-sm">
          แปลอัตโนมัติ — ยังไม่ผ่านการตรวจโดยคนแปล
        </p>
      )}

      <div
        lang={lang}
        className="mx-auto mt-6 max-w-[38rem] space-y-[1.2em]"
        style={{
          fontSize: "var(--read-size)",
          fontFamily: "var(--font-reading)",
          lineHeight: 2,
        }}
      >
        {body.text.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <nav aria-label="เปลี่ยนตอน" className="mx-auto mt-10 flex max-w-[38rem] justify-between gap-3">
        {prevHref ? (
          <Link href={prevHref} className={`${btn} flex items-center no-underline`}>
            ← ก่อนหน้า
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Link href={nextHref} className={`${btn} flex items-center no-underline`}>
            ถัดไป →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
