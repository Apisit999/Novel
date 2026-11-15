"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { coverUrl } from "@/features/catalog/cover-url";
import { convertForUpload } from "./image-convert";
import { requestCoverUpload, setTitleCover } from "./manga-actions";
import { ghostBtn } from "./ui";

const COVER_WIDTH = 800; // ปกแสดงไม่เกินราว 450px (retina ~900) — 800 พอและไฟล์เล็ก

/** อัปโหลด/เปลี่ยน/ลบปก — ย่อ + แปลง WebP ในเบราว์เซอร์ แล้วส่งตรงไป Storage */
export function CoverUploader({ titleId, coverKey }: { titleId: string; coverKey: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = coverUrl(coverKey);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const img = await convertForUpload(file, COVER_WIDTH);
      const target = await requestCoverUpload(titleId, img.ext);
      const storage = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      ).storage;
      const { error: upErr } = await storage
        .from("covers")
        .uploadToSignedUrl(target.key, target.token, img.blob, {
          contentType: img.blob.type || undefined,
        });
      if (upErr) throw new Error(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);
      await setTitleCover(titleId, target.key);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดปกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError("");
    setBusy(true);
    try {
      await setTitleCover(titleId, null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบปกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-wrap items-start gap-5">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- พรีวิวหลังบ้าน ไม่ต้องผ่านตัวย่อรูป
        <img src={current} alt="ปกปัจจุบัน" className="aspect-[2/3] w-32 rounded-xl object-cover" />
      ) : (
        <div className="bg-surface text-muted flex aspect-[2/3] w-32 items-center justify-center rounded-xl text-center text-sm">
          ยังไม่มีปก
        </div>
      )}
      <div className="flex flex-col gap-3">
        <label className={`${ghostBtn} cursor-pointer ${busy ? "opacity-50" : ""}`}>
          {busy ? "กำลังอัปโหลด…" : current ? "เปลี่ยนปก" : "อัปโหลดปก"}
          <input
            type="file"
            accept="image/webp,image/jpeg,image/png"
            disabled={busy}
            className="sr-only"
            aria-label="เลือกไฟล์ปก"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {current && (
          <button type="button" disabled={busy} onClick={() => void remove()} className={ghostBtn}>
            ลบปก
          </button>
        )}
        <p className="text-muted text-sm">แนะนำสัดส่วน 2:3 (แนวตั้ง) · JPG/PNG/WebP</p>
        {error && (
          <p role="alert" className="text-accent font-bold">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
