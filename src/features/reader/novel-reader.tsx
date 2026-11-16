"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveProgress } from "@/features/library/local-library";
import { ThemeToggle } from "@/components/theme-toggle";
import { Markdown } from "./markdown";

export type ReaderLang = "th" | "en" | "zh";

export interface ReaderBody {
  text: string;
  machine: boolean;
}

interface Props {
  slug: string;
  number: number;
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
const LEADINGS = [1.7, 2, 2.3] as const;
/** ความเร็วเลื่อนอัตโนมัติ (พิกเซลต่อวินาที): ช้า / กลาง / เร็ว */
const SCROLL_SPEEDS = [25, 45, 80] as const;
const SCROLL_LABEL = ["ช้า", "กลาง", "เร็ว"] as const;

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
  slug,
  number,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leading, setLeading] = useState<number>(2);
  const [autoSpeed, setAutoSpeed] = useState<number | null>(null); // index ใน SCROLL_SPEEDS, null = ปิด
  const lastY = useRef(0);

  useEffect(() => {
    const v = Number(localStorage.getItem("leading"));
    if ((LEADINGS as readonly number[]).includes(v)) setLeading(v); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // เลื่อนอัตโนมัติ: เลื่อนด้วย rAF ตามเวลาจริง (ไม่ผูกกับอัตราเฟรม) หยุดเมื่อถึงท้ายหน้า
  // หรือผู้ใช้แตะ/เลื่อนล้อ/กดแป้นเอง
  useEffect(() => {
    if (autoSpeed === null) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const stop = () => setAutoSpeed(null);
    const tick = (now: number) => {
      carry += (SCROLL_SPEEDS[autoSpeed] * (now - last)) / 1000;
      last = now;
      const whole = Math.floor(carry); // scrollBy รับเศษพิกเซลไม่ได้ในบางเบราว์เซอร์ → สะสมจนเต็มพิกเซลก่อน
      if (whole > 0) {
        carry -= whole;
        window.scrollBy(0, whole);
      }
      const atEnd =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atEnd) stop();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [autoSpeed]);

  function resetSettings() {
    const root = document.documentElement;
    for (const k of ["size", "font", "leading", "theme"]) localStorage.removeItem(k);
    root.style.removeProperty("--read-size");
    delete root.dataset.font;
    root.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setLeading(2);
    setAutoSpeed(null);
  }

  function cycleLeading() {
    const i = (LEADINGS as readonly number[]).indexOf(leading);
    const next = LEADINGS[(i + 1) % LEADINGS.length];
    setLeading(next);
    localStorage.setItem("leading", String(next));
  }

  useEffect(() => {
    const saved = localStorage.getItem("lang") as ReaderLang | null;
    if (saved && bodies[saved]) setLang(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, [bodies]);

  // กลับไปตำแหน่งที่อ่านค้างของตอนนี้ (ครั้งเดียวตอนเปิดหน้า)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("aandoo:library:v1");
      const saved = raw ? JSON.parse(raw)?.progress?.[slug] : null;
      if (saved?.number === number && saved.percent > 5 && saved.percent < 100) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: (max * saved.percent) / 100 });
      }
    } catch {
      /* ไม่มีข้อมูล/อ่านไม่ได้ → เริ่มต้นตอนปกติ */
    }
  }, [slug, number]);

  // บันทึกตำแหน่งอ่าน (หน่วง 600ms เพื่อไม่เขียนทุกพิกเซล)
  useEffect(() => {
    const t = setTimeout(() => saveProgress(slug, number, progress), 600);
    return () => clearTimeout(t);
  }, [slug, number, progress]);

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

  // ปัดซ้าย = ตอนถัดไป, ปัดขวา = ตอนก่อนหน้า (เฉพาะปัดแนวนอนชัดเจน ไม่ชนกับการเลื่อนอ่าน)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (window.getSelection()?.toString()) return; // กำลังเลือกข้อความ
    if (dx < 0 && nextHref) router.push(nextHref);
    if (dx > 0 && prevHref) router.push(prevHref);
  }
  // แตะที่ข้อความ (ไม่ใช่ลิงก์/ปุ่ม) = สลับแสดง/ซ่อนแถบเครื่องมือ
  function onTapBody(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (window.getSelection()?.toString()) return;
    setToolbarVisible((v) => !v);
  }

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
            aria-expanded={settingsOpen}
            aria-controls="reader-settings"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`${btn} ${settingsOpen ? "bg-accent text-accent-foreground border-accent" : ""}`}
          >
            ตั้งค่า
          </button>
        </div>
        {settingsOpen && (
          <div
            id="reader-settings"
            role="group"
            aria-label="ตั้งค่าเพิ่มเติม"
            className="flex w-full flex-wrap gap-2 pt-1"
          >
            <button
              type="button"
              onClick={toggleFont}
              aria-label="สลับแบบตัวอักษร มีหัว/ไม่มีหัว"
              className={btn}
            >
              ฟอนต์
            </button>
            <button
              type="button"
              onClick={cycleLeading}
              aria-label={`ระยะห่างบรรทัด ปัจจุบัน ${leading} กดเพื่อเปลี่ยน`}
              className={btn}
            >
              ↕ {leading}
            </button>
            <ThemeToggle />
            <button
              type="button"
              aria-pressed={autoSpeed !== null}
              onClick={() =>
                setAutoSpeed((v) => (v === null ? 0 : v + 1 < SCROLL_SPEEDS.length ? v + 1 : null))
              }
              aria-label="เลื่อนอัตโนมัติ กดเพื่อเปิด เปลี่ยนความเร็ว หรือปิด"
              className={`${btn} ${autoSpeed !== null ? "bg-accent text-accent-foreground border-accent" : ""}`}
            >
              {autoSpeed === null ? "เลื่อนอัตโนมัติ" : `เลื่อน: ${SCROLL_LABEL[autoSpeed]}`}
            </button>
            <button type="button" onClick={resetSettings} className={btn}>
              คืนค่า
            </button>
          </div>
        )}
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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onTapBody}
        className="mx-auto mt-6 max-w-[38rem] space-y-[1.2em]"
        style={{
          fontSize: "var(--read-size)",
          fontFamily: "var(--font-reading)",
          lineHeight: leading,
        }}
      >
        <Markdown source={body.text} />
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
