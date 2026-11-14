"use client";

import { useEffect } from "react";
import { readLibrary, replaceLibrary, setRemote } from "./local-library";
import { pullLibrary, pushLibrary, recordProgressRemote, setFavoriteRemote } from "./sync-actions";
import { EMPTY_LIBRARY, type LibraryData } from "./types";

const MARK = "aandoo:synced-user"; // ผู้ใช้ที่ห้องสมุดในเครื่องนี้ถูกซิงก์ไว้แล้ว
const PROGRESS_DELAY_MS = 2500; // หน่วงการส่งความคืบหน้า ไม่ยิงทุกครั้งที่เลื่อน

/** ผลลัพธ์ที่เบราว์เซอร์ควรเก็บ: รายการโปรดตามบัญชี, ความคืบหน้าฝั่งไหนใหม่กว่าชนะ */
function merge(local: LibraryData, server: LibraryData): LibraryData {
  const progress = { ...server.progress };
  for (const [slug, p] of Object.entries(local.progress)) {
    if (!progress[slug] || progress[slug].updatedAt < p.updatedAt) progress[slug] = p;
  }
  return { favorites: server.favorites, progress };
}

/**
 * ซิงก์ห้องสมุดกับบัญชี (ไม่แสดงอะไร)
 * - ล็อกอิน: ครั้งแรกบนเครื่องนี้ → ส่งของในเครื่องขึ้นบัญชีก่อน แล้วดึงของบัญชีลงมาเป็นแคช;
 *   จากนั้นทุกการกดชอบ/อ่านจะถูกส่งขึ้นบัญชีตาม
 * - ออกจากระบบ: ล้างแคชในเครื่อง (ข้อมูลอยู่บนบัญชีแล้ว) เครื่องที่ใช้ร่วมกันจะไม่เห็นของคนก่อนหน้า
 */
export function LibrarySync({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) {
      setRemote(null);
      if (localStorage.getItem(MARK)) {
        replaceLibrary(EMPTY_LIBRARY);
        localStorage.removeItem(MARK);
      }
      return;
    }

    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let cancelled = false;

    setRemote({
      setFavorite: (slug, on) => void setFavoriteRemote(slug, on).catch(() => {}),
      recordProgress: (slug, number, percent) => {
        clearTimeout(timers.get(slug));
        timers.set(
          slug,
          setTimeout(
            () => void recordProgressRemote(slug, number, percent).catch(() => {}),
            PROGRESS_DELAY_MS,
          ),
        );
      },
    });

    (async () => {
      if (localStorage.getItem(MARK) !== userId) await pushLibrary(readLibrary());
      const server = await pullLibrary();
      if (cancelled || !server) return;
      replaceLibrary(merge(readLibrary(), server));
      localStorage.setItem(MARK, userId);
    })().catch(() => {});

    return () => {
      cancelled = true;
      setRemote(null);
      timers.forEach(clearTimeout);
    };
  }, [userId]);

  return null;
}
