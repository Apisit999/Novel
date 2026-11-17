"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import { createImportEpisode } from "@/features/admin/manga-actions";
import { inputCls, primaryBtn } from "@/features/admin/ui";
import { registerVideo, requestVideoUpload } from "@/features/admin/video-actions";
import { planVideoFiles, type VideoPlan } from "./plan-video-files";

const MAX_BYTES = 50 * 1024 * 1024; // เพดานของแพ็กเกจฟรี (เหมือนตัวอัปโหลดทีละตอน)

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

export function VideoImport({
  titleId,
  existingNumbers,
  nextNumber,
}: {
  titleId: string;
  existingNumbers: number[];
  nextNumber: number;
}) {
  const [plans, setPlans] = useState<VideoPlan[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const existing = useMemo(() => new Set(existingNumbers), [existingNumbers]);

  const numbers = plans.map((p) => p.number);
  const invalid =
    numbers.length !== new Set(numbers).size ||
    numbers.some((n) => !(n >= 1)) ||
    plans.some((p) => p.problem);

  async function run() {
    setBusy(true);
    setError("");
    setLog([]);
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    ).storage;
    const say = (m: string) => setLog((l) => [...l, m]);
    try {
      for (const p of plans) {
        const { episodeId, existed } = await createImportEpisode({
          titleId,
          number: p.number,
          name: p.name,
          status,
        });
        if (existed) {
          say(`ตอน ${p.number}: ข้าม (มีอยู่แล้ว)`);
          continue;
        }
        setProgress(`ตอน ${p.number}: กำลังอัปโหลด ${p.file.name}…`);
        const [duration, target] = await Promise.all([
          readDuration(p.file),
          requestVideoUpload(episodeId, p.ext),
        ]);
        const { error: e } = await storage
          .from("video")
          .uploadToSignedUrl(target.key, target.token, p.file, { contentType: p.file.type });
        if (e) throw new Error(`ตอน ${p.number}: อัปโหลดไม่สำเร็จ (${e.message})`);
        await registerVideo(episodeId, target.key, duration);
        say(`ตอน ${p.number}: เสร็จ`);
      }
      say("นำเข้าเสร็จทั้งหมด");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ") +
          " — ตอนที่ค้างครึ่งทางให้เปิดตอนนั้นแล้วอัปโหลดไฟล์ใหม่ ตอนที่เลขซ้ำจะถูกข้ามเอง",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-2xl border p-5">
        <label htmlFor="vf" className="font-bold">
          เลือกไฟล์วิดีโอหลายไฟล์ (ตอนละไฟล์ เลขตอนดึงจากชื่อไฟล์ เช่น “ep01.mp4”)
        </label>
        <input
          id="vf"
          type="file"
          multiple
          accept="video/mp4,video/webm"
          disabled={busy}
          onChange={(e) => {
            setPlans(planVideoFiles([...(e.target.files ?? [])], nextNumber, MAX_BYTES));
            setLog([]);
            setError("");
          }}
          className="min-h-12"
        />
        <p className="text-muted text-sm">MP4 (H.264/AAC) หรือ WebM · ไฟล์ละไม่เกิน 50 MB</p>
      </div>

      {plans.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {plans.map((p, i) => (
              <li
                key={p.file.name + i}
                className="border-border flex flex-wrap items-center gap-3 rounded-xl border p-3"
              >
                <input
                  type="number"
                  min={1}
                  value={Number.isFinite(p.number) ? p.number : ""}
                  disabled={busy}
                  aria-label={`เลขตอนของ ${p.file.name}`}
                  onChange={(e) =>
                    setPlans((ps) =>
                      ps.map((x, j) =>
                        j === i ? { ...x, number: parseInt(e.target.value, 10) } : x,
                      ),
                    )
                  }
                  className={`${inputCls} w-24`}
                />
                <span className="font-bold">{p.file.name}</span>
                <span className="text-muted text-sm">{(p.file.size / 1048576).toFixed(1)} MB</span>
                {p.problem && <span className="text-accent text-sm font-bold">{p.problem}</span>}
                {existing.has(p.number) && (
                  <span className="text-accent text-sm font-bold">เลขนี้มีอยู่แล้ว — จะถูกข้าม</span>
                )}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-3">
            สถานะ
            <select
              value={status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value as "draft" | "published")}
              className={inputCls}
            >
              <option value="draft">ฉบับร่าง</option>
              <option value="published">เผยแพร่ทันที</option>
            </select>
          </label>
          {invalid && (
            <p role="alert" className="text-accent font-bold">
              เลขตอนซ้ำ/ไม่ถูกต้อง หรือมีไฟล์ที่ใช้ไม่ได้ — แก้ก่อนเริ่ม
            </p>
          )}
          <button
            type="button"
            className={primaryBtn}
            disabled={busy || invalid}
            onClick={() => void run()}
          >
            {busy ? "กำลังนำเข้า…" : `นำเข้า ${plans.length} ตอน`}
          </button>
        </>
      )}
      {progress && (
        <p role="status" className="font-bold">
          {progress}
        </p>
      )}
      {log.length > 0 && (
        <ul className="text-sm">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-accent font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
