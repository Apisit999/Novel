"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { LikeButton } from "@/features/likes/like-button";
import { saveProgress } from "@/features/library/local-library";

interface Props {
  slug: string;
  number: number;
  titleName: string;
  titleHref: string;
  episodeName: string;
  /** ลิงก์ไฟล์ที่หมดอายุ — undefined = ตอนนี้ยังไม่มีไฟล์ */
  url?: string;
  prevHref?: string;
  nextHref?: string;
}

const btn =
  "border-border bg-surface text-foreground hover:border-accent min-h-12 min-w-12 cursor-pointer rounded-full border px-4 font-bold";

/**
 * ตัวเล่นวิดีโอ: ปุ่มควบคุมของเบราว์เซอร์ (เต็มจอ/ความเร็ว/เสียง) + ดูต่อจากจุดเดิม
 * + บันทึกความคืบหน้า (เป็น % เหมือนนิยาย/มังงะ) + จบตอนแล้วไปตอนถัดไป (ยกเลิกได้) + ปุ่มลูกศรเปลี่ยนตอน
 */
export function VideoPlayer({
  slug,
  number,
  titleName,
  titleHref,
  episodeName,
  url,
  prevHref,
  nextHref,
}: Props) {
  const router = useRouter();
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  // ดูต่อจากจุดเดิมของตอนนี้ (ครั้งเดียวเมื่อรู้ความยาววิดีโอ)
  function onLoadedMetadata() {
    const v = ref.current;
    if (!v || !Number.isFinite(v.duration)) return;
    try {
      const raw = localStorage.getItem("aandoo:library:v1");
      const saved = raw ? JSON.parse(raw)?.progress?.[slug] : null;
      if (saved?.number === number && saved.percent > 2 && saved.percent < 97) {
        v.currentTime = (v.duration * saved.percent) / 100;
      }
    } catch {
      /* ไม่มีข้อมูล → เริ่มจากต้น */
    }
  }

  function report(force = false) {
    const v = ref.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const now = Date.now();
    if (!force && now - lastSaved.current < 5000) return; // บันทึกไม่ถี่เกินไป
    lastSaved.current = now;
    saveProgress(slug, number, Math.min(100, Math.round((v.currentTime / v.duration) * 100)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft" && e.shiftKey && prevHref) router.push(prevHref);
      if (e.key === "ArrowRight" && e.shiftKey && nextHref) router.push(nextHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref]);

  return (
    <article>
      <p className="text-muted text-sm">
        <Link href={titleHref}>{titleName}</Link>
      </p>
      <h1 className="mb-4 text-2xl font-bold">{episodeName}</h1>

      {url ? (
        <video
          ref={ref}
          src={url}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={() => report()}
          onPause={() => report(true)}
          onEnded={() => {
            saveProgress(slug, number, 100);
            if (nextHref) router.push(nextHref);
          }}
          className="mx-auto aspect-video w-full max-w-[960px] rounded-xl bg-black"
        />
      ) : (
        <p className="bg-surface border-border mx-auto max-w-[960px] rounded-xl border p-8 text-center">
          ตอนนี้ยังไม่พร้อมให้ดู — กลับมาใหม่เร็ว ๆ นี้
        </p>
      )}

      <div className="mx-auto mt-6 flex max-w-[960px] justify-center">
        <LikeButton slug={slug} number={number} />
      </div>

      <nav aria-label="เปลี่ยนตอน" className="mx-auto mt-6 flex max-w-[960px] justify-between gap-3">
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
