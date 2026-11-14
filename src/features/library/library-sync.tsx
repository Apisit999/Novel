"use client";

import { useEffect } from "react";
import { discardPending, readLibrary, replaceLibrary, setRemote } from "./local-library";
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
      void setRemote(null);
      discardPending(); // ไม่ได้ล็อกอิน: การกดที่ค้างคิวไม่มีที่ให้ส่ง
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
    // การกดชอบ/เลิกชอบที่เกิดระหว่างซิงก์: ข้อมูลที่ดึงลงมาอาจเก่ากว่าการกดนั้น จึงต้องนำมาทับกลับหลังดึงเสร็จ
    const touched = new Map<string, boolean>();
    let syncing = true;

    const flushed = setRemote({
      setFavorite: (slug, on) => {
        if (syncing) touched.set(slug, on);
        return setFavoriteRemote(slug, on).catch(() => {});
      },
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
      await flushed; // ส่งการกดที่เกิดก่อนซิงก์พร้อมให้เสร็จก่อน ไม่งั้นข้อมูลที่ดึงมาจะไม่มีการกดนั้น
      if (localStorage.getItem(SYNCED) !== userId) await pushLibrary(readLibrary());
      const server = await pullLibrary();
      syncing = false;
      if (cancelled || !server) return;
      for (const [slug, on] of touched) {
        const rest = server.favorites.filter((f) => f !== slug);
        server.favorites = on ? [slug, ...rest] : rest;
      }
      replaceLibrary(merge(readLibrary(), server));
      localStorage.setItem(SYNCED, userId);
    })().catch(() => {});

    return () => {
      cancelled = true;
      void setRemote(null);
      timers.forEach(clearTimeout);
    };
  }, [userId]);

  return null;
}
