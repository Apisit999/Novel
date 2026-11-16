"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteVideo, registerVideo, requestVideoUpload } from "./video-actions";
import { dangerBtn } from "./ui";

const MAX_BYTES = 50 * 1024 * 1024;

/** อ่านความยาววิดีโอ (วินาที) จากไฟล์ในเบราว์เซอร์ — อ่านไม่ได้ = null */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      done(Number.isFinite(v.duration) ? Math.max(1, Math.round(v.duration)) : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}

export function VideoManager({ episodeId, playUrl }: { episodeId: string; playUrl?: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    const ext = file.type === "video/webm" ? "webm" : file.type === "video/mp4" ? "mp4" : null;
    if (!ext) return setError("รองรับเฉพาะไฟล์ MP4 หรือ WebM");
    if (file.size > MAX_BYTES) return setError("ไฟล์ใหญ่เกิน 50 MB");
    setUploading(true);
    try {
      setStatus("กำลังอัปโหลด… (อย่าปิดหน้านี้)");
      const [duration, target] = await Promise.all([
        readDuration(file),
        requestVideoUpload(episodeId, ext),
      ]);
      const storage = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      ).storage;
      const { error: upErr } = await storage
        .from("video")
        .uploadToSignedUrl(target.key, target.token, file, { contentType: file.type });
      if (upErr) throw new Error(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);
      await registerVideo(episodeId, target.key, duration);
      setStatus("อัปโหลดเสร็จแล้ว");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      setStatus("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-labelledby="video-h" className="flex flex-col gap-4">
      <h2 id="video-h" className="text-xl font-bold">
        ไฟล์วิดีโอ
      </h2>
      <div className="border-border flex flex-col gap-3 rounded-2xl border p-5">
        <label htmlFor="video-file" className="font-bold">
          {playUrl ? "เปลี่ยนไฟล์วิดีโอ" : "เลือกไฟล์วิดีโอ"}
        </label>
        <input
          id="video-file"
          type="file"
          accept="video/mp4,video/webm"
          disabled={uploading}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="min-h-12"
        />
        <p className="text-muted text-sm">MP4 (H.264/AAC) หรือ WebM · ไฟล์ไม่เกิน 50 MB</p>
        {status && (
          <p role="status" className="font-bold">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-accent font-bold">
            {error}
          </p>
        )}
      </div>
      {playUrl ? (
        <div className="flex flex-col gap-3">
          <video
            src={playUrl}
            controls
            preload="metadata"
            className="max-w-2xl rounded-xl bg-black"
          />
          <button
            type="button"
            disabled={busy}
            className={`${dangerBtn} self-start`}
            onClick={() =>
              startTransition(async () => {
                setError("");
                try {
                  await deleteVideo(episodeId);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
                }
              })
            }
          >
            ลบไฟล์วิดีโอ
          </button>
        </div>
      ) : (
        <p className="text-muted">ยังไม่มีไฟล์วิดีโอ — ผู้ดูจะเห็นว่า “ยังไม่พร้อมให้ดู”</p>
      )}
    </section>
  );
}
