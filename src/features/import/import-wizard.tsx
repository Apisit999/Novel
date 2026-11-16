"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sortFilesNatural } from "@/features/admin/image-convert";
import { Field, inputCls, primaryBtn } from "@/features/admin/ui";
import { importChapterBatch, type ImportBatchResult } from "./import-actions";
import { baseName, readNovelFile } from "./read-file";
import { schedulePublishAt, validScheduleOptions } from "./schedule";
import {
  assignNumbers,
  duplicateNumbers,
  normalizeText,
  splitChapters,
  type DraftChapter,
  type SplitMethod,
} from "./split-chapters";

interface Row extends DraftChapter {
  key: string;
  include: boolean;
  source: string;
}

interface Props {
  titleId: string;
  titleName: string;
  /** เลขตอนที่มีอยู่แล้วในเรื่อง (ไว้เตือน/ข้าม/เขียนทับ) */
  existingNumbers: number[];
  nextNumber: number;
}

const BATCH_MAX_CHAPTERS = 30;
/** ขนาดเนื้อหารวมต่อชุด (ตัวอักษร) — ไทย 1 ตัวอักษร ≈ 3 ไบต์ จึงเว้นไว้ให้ต่ำกว่าเพดานของ server action */
const BATCH_MAX_CHARS = 150_000;

const th = (n: number) => n.toLocaleString("th-TH");
const sel = `${inputCls}`;

export function ImportWizard({ titleId, titleName, existingNumbers, nextNumber }: Props) {
  // ---- ขั้น 1: ต้นฉบับ
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [method, setMethod] = useState<SplitMethod>("headings");
  const [paragraphs, setParagraphs] = useState<"auto" | "every-line" | "keep">("auto");
  const [targetChars, setTargetChars] = useState(6000);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);

  // ---- ขั้น 2: ตัวอย่าง + ตัวเลือก
  const [rows, setRows] = useState<Row[]>([]);
  const [numbering, setNumbering] = useState<"from-headings" | "sequential">("from-headings");
  const [startNumber, setStartNumber] = useState(nextNumber);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [onConflict, setOnConflict] = useState<"skip" | "overwrite">("skip");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("draft");
  const [schedule, setSchedule] = useState({ startDate: "", time: "18:00", perDay: 1 });

  // ---- ขั้น 3: นำเข้า
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    created: number;
    overwritten: number;
    skipped: number[];
    error?: string;
  } | null>(null);

  const existing = useMemo(() => new Set(existingNumbers), [existingNumbers]);

  const included = useMemo(() => rows.filter((r) => r.include), [rows]);
  const numbered = useMemo(() => {
    const base = assignNumbers(included, numbering, startNumber);
    return base.map((c, i) => ({
      ...c,
      finalNumber: overrides[included[i].key] ?? c.finalNumber,
      key: included[i].key,
      source: included[i].source,
    }));
  }, [included, numbering, startNumber, overrides]);
  const dups = useMemo(() => duplicateNumbers(numbered), [numbered]);
  const numberOf = useMemo(() => new Map(numbered.map((c) => [c.key, c.finalNumber])), [numbered]);

  const scheduleOk = status !== "scheduled" || validScheduleOptions(schedule);
  const willConflict = numbered.filter((c) => existing.has(c.finalNumber)).length;
  const canImport =
    !running && numbered.length > 0 && dups.length === 0 && scheduleOk && summary === null;
  const totalChars = included.reduce((s, r) => s + r.body.length, 0);

  async function readAndSplit() {
    setReadError("");
    setNotes([]);
    setSummary(null);
    setOverrides({});
    setReading(true);
    try {
      const out: Row[] = [];
      const msgs: string[] = [];
      const sources: { text: string; fallback: string; label: string }[] = [];
      for (const f of sortFilesNatural(files)) {
        sources.push({ text: await readNovelFile(f), fallback: baseName(f.name), label: f.name });
      }
      if (pasted.trim()) sources.push({ text: pasted, fallback: "ตอนใหม่", label: "ข้อความที่วาง" });
      if (sources.length === 0) throw new Error("เลือกไฟล์หรือวางข้อความก่อน");

      for (const s of sources) {
        const text = normalizeText(s.text, paragraphs);
        const { chapters, preface } = splitChapters(text, {
          method,
          fallbackName: s.fallback,
          targetChars,
        });
        if (preface) {
          msgs.push(
            `${s.label}: มีข้อความก่อนหัวตอนแรก (${th(preface.length)} ตัวอักษร) ที่ไม่ได้นำเข้า เช่น “${preface.slice(0, 40).replace(/\s+/g, " ")}…”`,
          );
        }
        if (chapters.length === 0) msgs.push(`${s.label}: ไม่พบเนื้อหา`);
        for (const c of chapters) {
          out.push({
            ...c,
            key: `${out.length}`,
            include: c.body.length > 0, // ตอนว่างไม่ถูกเลือกให้อัตโนมัติ
            source: s.label,
          });
        }
      }
      if (out.length === 0) throw new Error("ไม่พบตอนที่นำเข้าได้");
      setRows(out);
      setNotes(msgs);
      // ถ้ามีเลขในหัวตอนอย่างน้อยครึ่งหนึ่ง ใช้เลขจากหัวตอน ไม่งั้นเรียงต่อจากตอนล่าสุด
      const withNumber = out.filter((r) => r.number !== null).length;
      setNumbering(withNumber >= out.length / 2 ? "from-headings" : "sequential");
      setStartNumber(nextNumber);
    } catch (e) {
      setRows([]);
      setReadError(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setReading(false);
    }
  }

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function runImport() {
    setRunning(true);
    setSummary(null);
    const items = numbered.map((c, i) => ({
      number: c.finalNumber,
      name: c.name,
      body: c.body,
      publishAt: status === "scheduled" ? schedulePublishAt(i, schedule) : null,
    }));
    // แบ่งเป็นชุดเล็กตามจำนวนและขนาดข้อความ (ส่งทีละชุดไปยังเซิร์ฟเวอร์)
    const batches: (typeof items)[] = [];
    let cur: typeof items = [];
    let chars = 0;
    for (const it of items) {
      if (
        cur.length >= BATCH_MAX_CHAPTERS ||
        (cur.length > 0 && chars + it.body.length > BATCH_MAX_CHARS)
      ) {
        batches.push(cur);
        cur = [];
        chars = 0;
      }
      cur.push(it);
      chars += it.body.length;
    }
    if (cur.length) batches.push(cur);

    setProgress({ done: 0, total: items.length });
    const total: { created: number; overwritten: number; skipped: number[]; error?: string } = {
      created: 0,
      overwritten: 0,
      skipped: [],
    };
    let done = 0;
    for (const chapters of batches) {
      let res: ImportBatchResult;
      try {
        res = await importChapterBatch({ titleId, status, onConflict, chapters });
      } catch {
        res = { created: 0, overwritten: 0, skipped: [], error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
      }
      total.created += res.created;
      total.overwritten += res.overwritten;
      total.skipped.push(...res.skipped);
      if (res.error) {
        total.error = `${res.error} (หยุดที่ตอน ${chapters[0].number}–${chapters[chapters.length - 1].number}) — แก้แล้วนำเข้าซ้ำได้ ตอนที่บันทึกไปแล้วจะถูกข้าม`;
        break;
      }
      done += chapters.length;
      setProgress({ done, total: items.length });
    }
    setSummary(total);
    setRunning(false);
  }

  const reset = () => {
    setRows([]);
    setSummary(null);
    setNotes([]);
    setOverrides({});
  };

  return (
    <div className="flex flex-col gap-10">
      {/* ---------------------------------------------------------- ขั้น 1 */}
      <section aria-labelledby="step1" className="flex max-w-3xl flex-col gap-5">
        <h2 id="step1" className="text-xl font-bold">
          1) เลือกไฟล์หรือวางข้อความ
        </h2>
        <Field
          label="ไฟล์นิยาย (.docx / .txt / .md)"
          htmlFor="import-files"
          hint="เลือกได้หลายไฟล์ (เรียงตามชื่อไฟล์) — ไฟล์เดียวทั้งเรื่องหรือไฟล์ละตอนก็ได้"
        >
          <input
            id="import-files"
            type="file"
            multiple
            accept=".docx,.txt,.md,.markdown,text/plain"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="min-h-12"
          />
        </Field>
        <Field
          label="หรือวางข้อความที่คัดลอกมา"
          htmlFor="import-paste"
          hint="คัดลอกจากเว็บ/แอป/Google Docs แล้ววางได้เลย ทั้งเรื่องหรือหลายตอนในครั้งเดียว"
        >
          <textarea
            id="import-paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            className={`${inputCls} font-mono`}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="วิธีแบ่งตอน" htmlFor="import-method">
            <select
              id="import-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as SplitMethod)}
              className={sel}
            >
              <option value="headings">ตามหัวตอน เช่น “ตอนที่ 1”, “บทที่ 2”, “Chapter 3” (แนะนำ)</option>
              <option value="separator">ตามเส้นคั่น (*** หรือ === บรรทัดเดียว)</option>
              <option value="size">ตามความยาว (ตัดที่ขอบย่อหน้า)</option>
            </select>
          </Field>
          <Field label="การจัดย่อหน้า" htmlFor="import-paragraphs">
            <select
              id="import-paragraphs"
              value={paragraphs}
              onChange={(e) => setParagraphs(e.target.value as typeof paragraphs)}
              className={sel}
            >
              <option value="auto">อัตโนมัติ (แนะนำ)</option>
              <option value="every-line">ทุกบรรทัดเป็นย่อหน้าใหม่</option>
              <option value="keep">คงตามต้นฉบับ</option>
            </select>
          </Field>
        </div>
        {method === "size" && (
          <Field label="ความยาวต่อตอน (ตัวอักษร โดยประมาณ)" htmlFor="import-size">
            <input
              id="import-size"
              type="number"
              min={500}
              step={500}
              value={targetChars}
              onChange={(e) => setTargetChars(Number(e.target.value) || 6000)}
              className={inputCls}
            />
          </Field>
        )}

        {readError && (
          <p role="alert" className="text-accent font-bold">
            {readError}
          </p>
        )}
        <button
          type="button"
          onClick={readAndSplit}
          disabled={reading || running}
          className={`${primaryBtn} self-start`}
        >
          {reading ? "กำลังอ่านและแบ่งตอน…" : "อ่านและแบ่งตอน"}
        </button>
      </section>

      {/* ---------------------------------------------------------- ขั้น 2 */}
      {rows.length > 0 && (
        <section aria-labelledby="step2" className="flex flex-col gap-5">
          <h2 id="step2" className="text-xl font-bold">
            2) ตรวจตัวอย่างก่อนบันทึก
          </h2>
          <p role="status" className="font-bold">
            พบ {th(rows.length)} ตอน · เลือกนำเข้า {th(included.length)} ตอน · รวม {th(totalChars)}{" "}
            ตัวอักษร
          </p>
          {notes.length > 0 && (
            <ul className="border-border bg-surface list-disc rounded-xl border p-4 pl-8 text-sm">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}

          <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
            <Field label="การกำหนดเลขตอน" htmlFor="import-numbering">
              <select
                id="import-numbering"
                value={numbering}
                onChange={(e) => {
                  setNumbering(e.target.value as typeof numbering);
                  setOverrides({});
                }}
                className={sel}
              >
                <option value="from-headings">ใช้เลขจากหัวตอน</option>
                <option value="sequential">เรียงต่อจากเลขเริ่มต้น (ไม่สนหัวตอน)</option>
              </select>
            </Field>
            <Field
              label="เลขเริ่มต้น"
              htmlFor="import-start"
              hint={`ตอนล่าสุดของเรื่องคือ ${nextNumber - 1} — ตอนที่ไม่มีเลขในหัวตอนจะเรียงต่อจากเลขนี้`}
            >
              <input
                id="import-start"
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => {
                  setStartNumber(Math.max(1, Number(e.target.value) || 1));
                  setOverrides({});
                }}
                className={inputCls}
              />
            </Field>
            <Field label="ถ้าเลขตอนซ้ำกับที่มีอยู่แล้ว" htmlFor="import-conflict">
              <select
                id="import-conflict"
                value={onConflict}
                onChange={(e) => setOnConflict(e.target.value as typeof onConflict)}
                className={sel}
              >
                <option value="skip">ข้ามตอนนั้น (ปลอดภัย)</option>
                <option value="overwrite">เขียนทับชื่อและเนื้อหา</option>
              </select>
            </Field>
            <Field label="สถานะตอนที่นำเข้า" htmlFor="import-status">
              <select
                id="import-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className={sel}
              >
                <option value="draft">ฉบับร่าง (ผู้อ่านยังไม่เห็น — แนะนำ ตรวจก่อนค่อยเผยแพร่)</option>
                <option value="published">เผยแพร่ทันที</option>
                <option value="scheduled">ตั้งเวลาเผยแพร่ทยอยลง</option>
              </select>
            </Field>
          </div>

          {status === "scheduled" && (
            <div className="border-border grid max-w-3xl gap-5 rounded-2xl border p-5 sm:grid-cols-3">
              <Field label="วันที่ลงตอนแรก" htmlFor="import-sched-date">
                <input
                  id="import-sched-date"
                  type="date"
                  value={schedule.startDate}
                  onChange={(e) => setSchedule((s) => ({ ...s, startDate: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="เวลา (เวลาไทย)" htmlFor="import-sched-time">
                <input
                  id="import-sched-time"
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule((s) => ({ ...s, time: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="ลงวันละกี่ตอน" htmlFor="import-sched-per">
                <input
                  id="import-sched-per"
                  type="number"
                  min={1}
                  max={100}
                  value={schedule.perDay}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, perDay: Number(e.target.value) || 1 }))
                  }
                  className={inputCls}
                />
              </Field>
              {!scheduleOk && (
                <p role="alert" className="text-accent font-bold sm:col-span-3">
                  กรอกวันที่ เวลา และจำนวนตอนต่อวันให้ถูกต้อง
                </p>
              )}
              {scheduleOk && numbered.length > 0 && (
                <p className="text-muted text-sm sm:col-span-3">
                  ตอนแรกลง {schedulePublishAt(0, schedule).replace("T", " เวลา ")} · ตอนสุดท้ายลง{" "}
                  {schedulePublishAt(numbered.length - 1, schedule).replace("T", " เวลา ")}
                </p>
              )}
            </div>
          )}

          {dups.length > 0 && (
            <p role="alert" className="text-accent font-bold">
              เลขตอนซ้ำกันในรายการ: {dups.join(", ")} — แก้เลขหรือเอาติ๊กออกก่อนนำเข้า
            </p>
          )}
          {willConflict > 0 && (
            <p role="status" className="border-border bg-surface rounded-xl border p-3">
              {th(willConflict)} ตอนมีเลขตรงกับที่มีอยู่แล้วในเรื่อง →{" "}
              {onConflict === "skip" ? "จะถูกข้าม" : "จะถูกเขียนทับชื่อและเนื้อหา"}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="border-border min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold"
              onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: r.body.length > 0 })))}
            >
              เลือกทั้งหมด
            </button>
            <button
              type="button"
              className="border-border min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold"
              onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}
            >
              ไม่เลือกเลย
            </button>
            <button
              type="button"
              className="border-border min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold"
              onClick={() =>
                setRows((rs) =>
                  rs.map((r) => ({ ...r, include: r.include && r.warnings.length === 0 })),
                )
              }
            >
              เอาตอนที่มีคำเตือนออก
            </button>
          </div>

          <ol className="flex flex-col gap-2" aria-label="รายการตอนที่แบ่งได้">
            {rows.map((r, i) => {
              const n = numberOf.get(r.key);
              const exists = n !== undefined && existing.has(n);
              return (
                <li key={r.key} className="border-border bg-surface rounded-2xl border p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => update(r.key, { include: e.target.checked })}
                      aria-label={`นำเข้าตอนลำดับที่ ${i + 1}`}
                      className="h-6 w-6"
                    />
                    <label className="flex items-center gap-2">
                      <span className="text-muted text-sm">เลข</span>
                      <input
                        type="number"
                        min={1}
                        value={n ?? ""}
                        disabled={!r.include}
                        onChange={(e) =>
                          setOverrides((o) => ({
                            ...o,
                            [r.key]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        aria-label={`เลขตอนของลำดับที่ ${i + 1}`}
                        className={`${inputCls} w-24`}
                      />
                    </label>
                    <input
                      value={r.name}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                      aria-label={`ชื่อตอนลำดับที่ ${i + 1}`}
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <span className="text-muted text-sm">{th(r.body.length)} ตัวอักษร</span>
                  </div>
                  {(r.warnings.length > 0 || exists) && (
                    <ul className="text-accent mt-2 list-disc pl-8 text-sm font-bold">
                      {exists && (
                        <li>
                          มีตอนเลข {n} อยู่แล้ว ({onConflict === "skip" ? "จะข้าม" : "จะเขียนทับ"})
                        </li>
                      )}
                      {r.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <details className="mt-2">
                    <summary className="text-muted cursor-pointer text-sm">
                      ดูเนื้อหาย่อ · จาก {r.source}
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-wrap" lang="th">
                      {r.body.slice(0, 500)}
                      {r.body.length > 500 ? " …" : ""}
                    </p>
                  </details>
                </li>
              );
            })}
          </ol>

          {/* ---------------------------------------------------------- ขั้น 3 */}
          <div className="border-border flex flex-col gap-4 rounded-2xl border-2 p-5">
            <h2 className="text-xl font-bold">3) นำเข้าเข้า “{titleName}”</h2>
            <button
              type="button"
              onClick={runImport}
              disabled={!canImport}
              className={`${primaryBtn} self-start`}
            >
              {running ? "กำลังนำเข้า…" : `นำเข้า ${th(numbered.length)} ตอน`}
            </button>
            {running && (
              <div>
                <progress
                  value={progress.done}
                  max={progress.total}
                  aria-label="ความคืบหน้าการนำเข้า"
                  className="w-full"
                />
                <p role="status" className="text-muted mt-1 text-sm">
                  นำเข้าแล้ว {th(progress.done)} / {th(progress.total)} ตอน — อย่าปิดหน้านี้
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- ผลลัพธ์ */}
      {summary && (
        <section
          aria-label="ผลการนำเข้า"
          className="border-border bg-surface rounded-2xl border-2 p-5"
        >
          <h2 className="text-xl font-bold">{summary.error ? "นำเข้าไม่ครบ" : "นำเข้าเสร็จแล้ว"}</h2>
          <ul className="mt-3 list-disc pl-6">
            <li>สร้างตอนใหม่ {th(summary.created)} ตอน</li>
            {summary.overwritten > 0 && <li>เขียนทับ {th(summary.overwritten)} ตอน</li>}
            {summary.skipped.length > 0 && (
              <li>
                ข้าม {th(summary.skipped.length)} ตอนที่มีอยู่แล้ว (เลข{" "}
                {summary.skipped.slice(0, 20).join(", ")}
                {summary.skipped.length > 20 ? " …" : ""})
              </li>
            )}
          </ul>
          {summary.error && (
            <p role="alert" className="text-accent mt-3 font-bold">
              {summary.error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/admin/titles/${titleId}`}
              className={primaryBtn + " flex items-center no-underline"}
            >
              ไปที่หน้าเรื่อง
            </Link>
            <button
              type="button"
              onClick={reset}
              className="border-border min-h-12 cursor-pointer rounded-full border px-6 font-bold"
            >
              นำเข้าเพิ่ม
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
