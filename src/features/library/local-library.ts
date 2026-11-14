"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * ห้องสมุดในเครื่อง: เรื่องที่ชอบ + ตำแหน่งที่อ่านค้าง เก็บใน localStorage
 * (ผู้ใช้ที่ยังไม่ล็อกอิน) — เฟส 2 เมื่อมีบัญชี จะย้ายขึ้นเซิร์ฟเวอร์ตอนล็อกอิน
 */
const KEY = "aandoo:library:v1";
const EVENT = "aandoo:library-change";

export interface ReadProgress {
  number: number;
  /** 0–100 ของตอนนั้น */
  percent: number;
  updatedAt: number;
}

export interface LibraryData {
  favorites: string[];
  progress: Record<string, ReadProgress>;
}

const EMPTY: LibraryData = { favorites: [], progress: {} };

function parse(raw: string): LibraryData {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<LibraryData>;
    return {
      favorites: Array.isArray(v.favorites) ? v.favorites.filter((s) => typeof s === "string") : [],
      progress: v.progress && typeof v.progress === "object" ? v.progress : {},
    };
  } catch {
    return EMPTY; // ข้อมูลเสีย → เริ่มใหม่ ไม่ให้หน้าพัง
  }
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function write(next: LibraryData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return; // โหมดส่วนตัว/พื้นที่เต็ม — ข้ามไป ไม่ให้หน้าพัง
  }
  window.dispatchEvent(new Event(EVENT));
}

/** อ่านค่าล่าสุดแบบ reactive (ฝั่งเซิร์ฟเวอร์/ก่อน hydrate = ว่าง เพื่อให้ HTML ตรงกัน) */
export function useLibrary(): LibraryData {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return useMemo(() => parse(raw), [raw]);
}

export function toggleFavorite(slug: string) {
  const data = parse(readRaw());
  const has = data.favorites.includes(slug);
  write({
    ...data,
    favorites: has ? data.favorites.filter((s) => s !== slug) : [slug, ...data.favorites],
  });
}

export function saveProgress(slug: string, number: number, percent: number) {
  const data = parse(readRaw());
  write({
    ...data,
    progress: {
      ...data.progress,
      [slug]: {
        number,
        percent: Math.max(0, Math.min(100, Math.round(percent))),
        updatedAt: Date.now(),
      },
    },
  });
}
