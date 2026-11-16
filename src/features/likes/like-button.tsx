"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getLikeState, setEpisodeLike, type LikeState } from "./like-actions";

/**
 * ปุ่มถูกใจรายตอน — โหลดสถานะหลังหน้าเปิด (ไม่ทำให้หน้าอ่านต้องรอ และไม่แคชข้ามผู้ใช้)
 * ยังไม่ล็อกอินกดแล้วพาไปหน้าล็อกอิน แล้วกลับมาที่ตอนเดิม
 */
export function LikeButton({ slug, number }: { slug: string; number: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<LikeState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getLikeState(slug, number).then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [slug, number]);

  function toggle() {
    if (!state) return;
    if (!state.signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    // อัปเดตทันทีให้รู้สึกเร็ว แล้วใช้ค่าจริงจากเซิร์ฟเวอร์ทับ
    const next = !state.liked;
    setState({ ...state, liked: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
    startTransition(async () => setState(await setEpisodeLike(slug, number, next)));
  }

  const liked = state?.liked ?? false;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!state || pending}
      aria-pressed={liked}
      aria-label={liked ? "ยกเลิกถูกใจตอนนี้" : "ถูกใจตอนนี้"}
      className={`flex min-h-12 min-w-12 cursor-pointer items-center gap-2 rounded-full border px-5 font-bold ${
        liked
          ? "bg-accent text-accent-foreground border-accent"
          : "border-border bg-surface text-foreground hover:border-accent"
      }`}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      <span>ถูกใจ{state ? ` ${state.count}` : ""}</span>
    </button>
  );
}
