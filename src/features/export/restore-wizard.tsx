"use client";

import JSZip from "jszip";
import { useState } from "react";
import { primaryBtn } from "@/features/admin/ui";
import { parseBackup, type RestorableNovel } from "./parse-backup";
import { restoreChapterBatch, restoreTitle } from "./restore-actions";

const MAX_BATCH_CHARS = 150_000;
const MAX_BATCH = 20;

interface Found {
  dir: string;
  novel?: RestorableNovel;
  error?: string;
}

export function RestoreWizard() {
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setLog([]);
    setFound([]);
    try {
      const zip = await JSZip.loadAsync(file);
      const dirs = new Set<string>();
      zip.forEach((path) => {
        const m = /^([^/]+)\/novel\.md$/.exec(path);
        if (m) dirs.add(m[1]);
      });
      if (dirs.size === 0) return setError("ไม่พบไฟล์สำรองนิยายในไฟล์ .zip นี้");
      const out: Found[] = [];
      for (const dir of [...dirs].sort()) {
        try {
          const md = await zip.file(`${dir}/novel.md`)!.async("string");
          const info = await zip.file(`${dir}/info.json`)?.async("string");
          if (!info) throw new Error("ไม่มี info.json");
          const translations: Record<string, string> = {};
          for (const f of zip.file(
            new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/translations/[^/]+\\.md$`),
          )) {
            const lang = f.name.split("/").pop()!.replace(/\.md$/, "");
            translations[lang] = await f.async("string");
          }
          out.push({ dir, novel: parseBackup(md, info, translations) });
        } catch (e) {
          out.push({ dir, error: e instanceof Error ? e.message : "อ่านไม่ได้" });
        }
      }
      setFound(out);
    } catch {
      setError("เปิดไฟล์ .zip ไม่ได้");
    }
  }

  async function run() {
    setBusy(true);
    setError("");
    setLog([]);
    const say = (m: string) => setLog((l) => [...l, m]);
    try {
      for (const f of found) {
        if (!f.novel) continue;
        const { title, chapters } = f.novel;
        const t = await restoreTitle(title);
        if (!t.titleId) throw new Error(`${title.slug}: ${t.error ?? "สร้างเรื่องไม่สำเร็จ"}`);
        let created = 0;
        let skipped = 0;
        let batch: typeof chapters = [];
        let chars = 0;
        const flush = async () => {
          if (!batch.length) return;
          const r = await restoreChapterBatch({ titleId: t.titleId, chapters: batch });
          created += r.created;
          skipped += r.skipped.length;
          if (r.error) throw new Error(`${title.slug}: ${r.error}`);
          batch = [];
          chars = 0;
        };
        for (const c of chapters) {
          const size = c.body.length + c.translations.reduce((n, x) => n + x.body.length, 0);
          if (batch.length >= MAX_BATCH || (batch.length && chars + size > MAX_BATCH_CHARS)) {
            await flush();
          }
          batch.push(c);
          chars += size;
        }
        await flush();
        say(
          `${title.name}: ${t.created ? "สร้างเรื่องใหม่" : "เรื่องมีอยู่แล้ว"} · กู้ ${created} ตอน` +
            (skipped ? ` · ข้าม ${skipped} ตอนที่มีอยู่แล้ว` : ""),
        );
      }
      say("กู้คืนเสร็จทั้งหมด");
    } catch (e) {
      setError(e instanceof Error ? e.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const ok = found.filter((f) => f.novel);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-2xl border p-5">
        <label htmlFor="rz" className="font-bold">
          เลือกไฟล์สำรอง (.zip จากปุ่ม “สำรองทั้งระบบ”)
        </label>
        <input
          id="rz"
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => void pick(e.target.files?.[0])}
          className="min-h-12"
        />
      </div>
      {found.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {found.map((f) => (
              <li key={f.dir} className="border-border rounded-xl border p-3">
                {f.novel ? (
                  <>
                    <span className="font-bold">{f.novel.title.name}</span>{" "}
                    <span className="text-muted text-sm">
                      ({f.novel.title.slug}) · {f.novel.chapters.length} ตอน
                    </span>
                    {f.novel.missingBodies.length > 0 && (
                      <p className="text-accent text-sm font-bold">
                        ไม่พบเนื้อหาของตอน {f.novel.missingBodies.join(", ")} ในไฟล์ — จะไม่ถูกกู้
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-accent font-bold">
                    {f.dir}: อ่านไม่ได้ ({f.error})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-muted text-sm">
            เรื่องที่ยังไม่มีในระบบจะถูกสร้างใหม่; เรื่องที่มีอยู่แล้วจะเติมเฉพาะตอนที่ขาด (ตอนที่เลขซ้ำถูกข้าม ไม่เขียนทับ)
          </p>
          <button
            type="button"
            className={primaryBtn}
            disabled={busy || ok.length === 0}
            onClick={() => void run()}
          >
            {busy ? "กำลังกู้คืน…" : `กู้คืน ${ok.length} เรื่อง`}
          </button>
        </>
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
