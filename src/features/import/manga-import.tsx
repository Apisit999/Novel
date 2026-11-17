"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import { convertForUpload } from "@/features/admin/image-convert";
import {
  createImportEpisode,
  registerPages,
  requestPageUploads,
} from "@/features/admin/manga-actions";
import { inputCls, primaryBtn } from "@/features/admin/ui";
import { groupChapterFolders, type ChapterGroup } from "./group-chapter-folders";

const BATCH = 10;

export function MangaImport({
  titleId,
  existingNumbers,
  nextNumber,
}: {
  titleId: string;
  existingNumbers: number[];
  nextNumber: number;
}) {
  const [groups, setGroups] = useState<ChapterGroup[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const existing = useMemo(() => new Set(existingNumbers), [existingNumbers]);

  function pick(list: FileList | null) {
    if (!list) return;
    const items = [...list].map((file) => ({
      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      file,
    }));
    setGroups(groupChapterFolders(items, nextNumber));
    setLog([]);
    setError("");
  }

  function setNumber(i: number, n: number) {
    setGroups((g) => g.map((c, j) => (j === i ? { ...c, number: n } : c)));
  }

  const numbers = groups.map((g) => g.number);
  const invalid = numbers.length !== new Set(numbers).size || numbers.some((n) => !(n >= 1));

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
      for (const g of groups) {
        const { episodeId, existed } = await createImportEpisode({
          titleId,
          number: g.number,
          name: g.name,
          status,
        });
        if (existed) {
          say(`ตอน ${g.number}: ข้าม (มีอยู่แล้ว)`);
          continue;
        }
        for (let i = 0; i < g.files.length; i += BATCH) {
          const group = g.files.slice(i, i + BATCH);
          const converted = [];
          for (const f of group) converted.push(await convertForUpload(f));
          const targets = await requestPageUploads(
            episodeId,
            converted.map((c) => c.ext),
          );
          const reg: { key: string; width: number; height: number }[] = [];
          for (let j = 0; j < converted.length; j++) {
            const { error: e } = await storage
              .from("manga")
              .uploadToSignedUrl(targets[j].key, targets[j].token, converted[j].blob, {
                contentType: converted[j].blob.type || undefined,
              });
            if (e) throw new Error(`ตอน ${g.number}: อัปโหลดไม่สำเร็จ (${e.message})`);
            reg.push({ key: targets[j].key, width: converted[j].width, height: converted[j].height });
          }
          await registerPages(episodeId, reg);
          setProgress(`ตอน ${g.number}: ${Math.min(i + BATCH, g.files.length)}/${g.files.length} หน้า`);
        }
        setProgress("");
        say(`ตอน ${g.number}: เสร็จ ${g.files.length} หน้า`);
      }
      say("นำเข้าเสร็จทั้งหมด");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ") +
          " — ตอนที่ค้างครึ่งทางให้ลบแล้วนำเข้าใหม่ ตอนที่เลขซ้ำจะถูกข้ามเอง",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-2xl border p-5">
        <label htmlFor="mf" className="font-bold">
          เลือกโฟลเดอร์เรื่อง (ข้างในมีโฟลเดอร์ย่อยตอนละโฟลเดอร์ เช่น “ตอน 1”, “ตอน 2”)
        </label>
        <input
          id="mf"
          type="file"
          multiple
          disabled={busy}
          // @ts-expect-error webkitdirectory ไม่อยู่ใน type ของ React แต่เบราว์เซอร์หลักรองรับ
          webkitdirectory=""
          onChange={(e) => pick(e.target.files)}
          className="min-h-12"
        />
      </div>

      {groups.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {groups.map((g, i) => (
              <li
                key={g.folder}
                className="border-border flex flex-wrap items-center gap-3 rounded-xl border p-3"
              >
                <input
                  type="number"
                  min={1}
                  value={Number.isFinite(g.number) ? g.number : ""}
                  disabled={busy}
                  aria-label={`เลขตอนของ ${g.folder}`}
                  onChange={(e) => setNumber(i, parseInt(e.target.value, 10))}
                  className={`${inputCls} w-24`}
                />
                <span className="font-bold">{g.name}</span>
                <span className="text-muted text-sm">{g.files.length} หน้า</span>
                {existing.has(g.number) && (
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
              เลขตอนซ้ำกันหรือไม่ถูกต้อง — แก้ก่อนเริ่ม
            </p>
          )}
          <button
            type="button"
            className={primaryBtn}
            disabled={busy || invalid}
            onClick={() => void run()}
          >
            {busy ? "กำลังนำเข้า…" : `นำเข้า ${groups.length} ตอน`}
          </button>
        </>
      )}
      {progress && <p role="status" className="font-bold">{progress}</p>}
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
