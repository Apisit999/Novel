"use client";

import { useEffect } from "react";
import { readLibrary, replaceLibrary, setRemote } from "./local-library";
import { pullLibrary, pushLibrary, recordProgressRemote, setFavoriteRemote } from "./sync-actions";
import { EMPTY_LIBRARY, type LibraryData } from "./types";

// เครื่องหมายในเครื่อง 2 อัน (แยกหน้าที่กัน):
// OWNER  = ผู้ใช้ที่ข้อมูลห้องสมุดในเครื่องนี้ "เป็นของ" — ตั้งทันทีที่ล็อกอิน ใช้ตัดสินว่าต้องล้างตอนออกจากระบบ
//          (ต้องไม่รอซิงก์เสร็จ ไม่งั้นออกเร็ว ๆ แล้วข้อมูลค้างในเครื่องที่ใช้ร่วมกัน)
// SYNCED = ผู้ใช้ที่ซิงก์ขึ้น/ลงสำเร็จแล้ว — ใช้ตัดสินว่าต้องส่งของในเครื่องขึ้นบัญชีอีกไหม
const OWNER = "aandoo:library-owner";
const SYNCED = "aandoo:synced-user";
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
      if (localStorage.getItem(OWNER)) {
        replaceLibrary(EMPTY_LIBRARY);
        localStorage.removeItem(OWNER);
        localStorage.removeItem(SYNCED);
      }
      return;
    }

    // ข้อมูลในเครื่องเป็นของคนอื่น (สลับบัญชีโดยไม่ได้ออกจากระบบ) → ห้ามรวมเข้าบัญชีนี้ ล้างทิ้ง
    const owner = localStorage.getItem(OWNER);
    if (owner && owner !== userId) {
      replaceLibrary(EMPTY_LIBRARY);
      localStorage.removeItem(SYNCED);
    }
    localStorage.setItem(OWNER, userId);

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
      if (localStorage.getItem(SYNCED) !== userId) await pushLibrary(readLibrary());
      const server = await pullLibrary();
      if (cancelled || !server) return;
      replaceLibrary(merge(readLibrary(), server));
      localStorage.setItem(SYNCED, userId);
    })().catch(() => {});

    return () => {
      cancelled = true;
      setRemote(null);
      timers.forEach(clearTimeout);
    };
  }, [userId]);

  return null;
}
