"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { convertForUpload, sortFilesNatural } from "./image-convert";
import { deletePage, movePage, registerPages, requestPageUploads } from "./manga-actions";
import { dangerBtn, ghostBtn } from "./ui";

export interface ManagedPage {
  pageNo: number;
  url: string;
}

const BATCH = 10; // อัปโหลดทีละกลุ่ม (ไม่ให้เปิดการเชื่อมต่อพร้อมกันมากเกินไป)

export function PagesManager({ episodeId, pages }: { episodeId: string; pages: ManagedPage[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const files = sortFilesNatural([...fileList]);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const storage = createClient(url, key, { auth: { persistSession: false } }).storage;

      let done = 0;
      for (let i = 0; i < files.length; i += BATCH) {
        const group = files.slice(i, i + BATCH);
        setStatus(`กำลังเตรียมรูป ${done + 1}–${done + group.length} จาก ${files.length}…`);
        const converted = [];
        for (const f of group) converted.push(await convertForUpload(f));

        const targets = await requestPageUploads(
          episodeId,
          converted.map((c) => c.ext),
        );
        setStatus(`กำลังอัปโหลด ${done + 1}–${done + group.length} จาก ${files.length}…`);
        const registered: { key: string; width: number; height: number }[] = [];
        for (let j = 0; j < converted.length; j++) {
          const { error: upErr } = await storage
            .from("manga")
            .uploadToSignedUrl(targets[j].key, targets[j].token, converted[j].blob, {
              contentType: converted[j].blob.type || undefined,
            });
          if (upErr) throw new Error(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);
          registered.push({
            key: targets[j].key,
            width: converted[j].width,
            height: converted[j].height,
          });
        }
        await registerPages(episodeId, registered);
        done += group.length;
      }
      setStatus(`อัปโหลดเสร็จ ${files.length} หน้า`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      setStatus("");
      router.refresh(); // หน้าที่อัปโหลดสำเร็จไปแล้วบางส่วนยังต้องแสดง
    } finally {
      setUploading(false);
    }
  }

  const act = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError("");
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      }
    });

  return (
    <section aria-labelledby="pages-h" className="flex flex-col gap-4">
      <h2 id="pages-h" className="text-xl font-bold">
        หน้าของตอน ({pages.length})
      </h2>

      <div className="border-border flex flex-col gap-3 rounded-2xl border p-5">
        <label htmlFor="page-files" className="font-bold">
          เพิ่มหน้า (เลือกได้หลายไฟล์ เรียงตามชื่อไฟล์)
        </label>
        <input
          id="page-files"
          type="file"
          multiple
          accept="image/webp,image/jpeg,image/png"
          disabled={uploading}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = ""; // เลือกไฟล์ชุดเดิมซ้ำได้
          }}
          className="min-h-12"
        />
        <p className="text-muted text-sm">
          ระบบย่อให้กว้างไม่เกิน 1600px และแปลงเป็น WebP ให้ในเบราว์เซอร์ก่อนอัปโหลด · ไฟล์ละไม่เกิน 10 MB
        </p>
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

      {pages.length === 0 ? (
        <p className="text-muted">ยังไม่มีหน้า — เลือกไฟล์รูปด้านบนเพื่อเริ่มอัปโหลด</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="รายการหน้า">
          {pages.map((p, i) => (
            <li
              key={p.pageNo}
              className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-2xl border p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`ตัวอย่างหน้า ${p.pageNo}`}
                className="h-24 w-16 rounded-lg object-cover"
              />
              <span className="min-w-16 font-bold">หน้า {p.pageNo}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  className={ghostBtn}
                  disabled={busy || i === 0}
                  aria-label={`เลื่อนหน้า ${p.pageNo} ขึ้น`}
                  onClick={() => act(() => movePage(episodeId, p.pageNo, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={ghostBtn}
                  disabled={busy || i === pages.length - 1}
                  aria-label={`เลื่อนหน้า ${p.pageNo} ลง`}
                  onClick={() => act(() => movePage(episodeId, p.pageNo, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={dangerBtn}
                  disabled={busy}
                  aria-label={`ลบหน้า ${p.pageNo}`}
                  onClick={() => {
                    if (window.confirm(`ลบหน้า ${p.pageNo} ถาวร?`)) {
                      act(() => deletePage(episodeId, p.pageNo));
                    }
                  }}
                >
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
