"use client";

import { useMemo, useSyncExternalStore } from "react";
import { EMPTY_LIBRARY, type LibraryData } from "./types";

/**
 * ห้องสมุดในเครื่อง: เรื่องที่ชอบ + ตำแหน่งที่อ่านค้าง เก็บใน localStorage
 * - ผู้ใช้ที่ยังไม่ล็อกอิน: อยู่ในเครื่องนี้อย่างเดียว
 * - ล็อกอินแล้ว: LibrarySync ตั้ง "จุดเชื่อมไปเซิร์ฟเวอร์" (setRemote) ให้ทุกการเปลี่ยนแปลงถูกส่งขึ้นบัญชีด้วย
 *   และใช้ localStorage เป็นแคชให้หน้าเว็บอ่านได้ทันทีไม่ต้องรอเครือข่าย
 */
const KEY = "aandoo:library:v1";
const EVENT = "aandoo:library-change";

export type { LibraryData, ReadProgress } from "./types";

export interface RemoteHooks {
  setFavorite: (slug: string, on: boolean) => void;
  recordProgress: (slug: string, number: number, percent: number) => void;
}

let remote: RemoteHooks | null = null;
export function setRemote(hooks: RemoteHooks | null) {
  remote = hooks;
}

function parse(raw: string): LibraryData {
  if (!raw) return EMPTY_LIBRARY;
  try {
    const v = JSON.parse(raw) as Partial<LibraryData>;
    return {
      favorites: Array.isArray(v.favorites) ? v.favorites.filter((s) => typeof s === "string") : [],
      progress: v.progress && typeof v.progress === "object" ? v.progress : {},
    };
  } catch {
    return EMPTY_LIBRARY; // ข้อมูลเสีย → เริ่มใหม่ ไม่ให้หน้าพัง
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

/** อ่านค่าปัจจุบันครั้งเดียว (ไม่ reactive) — สำหรับตัวซิงก์ */
export function readLibrary(): LibraryData {
  return parse(readRaw());
}

/** แทนที่ทั้งก้อน (ตอนดึงจากบัญชี หรือเคลียร์ตอนออกจากระบบ) — ไม่ส่งขึ้นเซิร์ฟเวอร์ซ้ำ */
export function replaceLibrary(data: LibraryData) {
  write(data);
}

export function toggleFavorite(slug: string) {
  const data = parse(readRaw());
  const has = data.favorites.includes(slug);
  write({
    ...data,
    favorites: has ? data.favorites.filter((s) => s !== slug) : [slug, ...data.favorites],
  });
  remote?.setFavorite(slug, !has);
}

export function saveProgress(slug: string, number: number, percent: number) {
  const rounded = Math.max(0, Math.min(100, Math.round(percent)));
  const data = parse(readRaw());
  write({
    ...data,
    progress: { ...data.progress, [slug]: { number, percent: rounded, updatedAt: Date.now() } },
  });
  remote?.recordProgress(slug, number, rounded);
}
