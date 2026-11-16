"use client";

import { useActionState, useDeferredValue, useEffect, useRef, useState } from "react";
import { normalizeText } from "@/features/import/split-chapters";
import { Markdown } from "@/features/reader/markdown";
import { saveEpisode, type FormState } from "./actions";
import { countWords } from "./schemas";
import { submitKeepingValues } from "./submit";
import { Field, inputCls, primaryBtn } from "./ui";

export interface EpisodeFormValues {
  titleId: string;
  episodeId?: string;
  number: number;
  name: string;
  access: "inherit" | "free" | "premium";
  status: "draft" | "scheduled" | "published";
  /** "YYYY-MM-DDTHH:mm" เวลาไทย */
  publishAt: string;
  body: string;
  en: string;
  enMachine: boolean;
  zh: string;
  zhMachine: boolean;
}

const initial: FormState = {};

/** กล่องเขียนข้อความ Markdown + ปุ่มสลับดูตัวอย่างที่ผู้อ่านจะเห็นจริง */
function MarkdownBox({
  id,
  name,
  label,
  text,
  setText,
  lang,
  required,
}: {
  id: string;
  name: string;
  label: string;
  text: string;
  setText: (v: string) => void;
  lang: string;
  required?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  // นับคำ (ตัดคำภาษาไทยด้วย Intl.Segmenter) เลื่อนไปทำตอนว่าง ไม่หน่วงตอนพิมพ์ข้อความยาว ๆ
  const deferred = useDeferredValue(text);
  const words = deferred.trim() ? countWords(deferred) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        <button
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview((p) => !p)}
          className="border-border bg-surface min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold"
        >
          {preview ? "กลับไปแก้ไข" : "ดูตัวอย่าง"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setText(normalizeText(text, "auto"))}
          disabled={!text.trim() || preview}
          title="ตัดช่องว่างเกิน และคั่นย่อหน้าด้วยบรรทัดว่างให้ข้อความที่วางมา (หนึ่งบรรทัด = หนึ่งย่อหน้า)"
          className="border-border bg-surface min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold disabled:opacity-40"
        >
          จัดย่อหน้าอัตโนมัติ
        </button>
        <span className="text-muted text-sm" aria-live="polite">
          {text.length.toLocaleString("th-TH")} ตัวอักษร · {words.toLocaleString("th-TH")} คำ
        </span>
      </div>
      {/* ซ่อนช่องเขียนตอนพรีวิว (ไม่ถอดออก) เพื่อให้ค่ายังถูกส่งไปกับฟอร์ม */}
      <textarea
        id={id}
        name={name}
        lang={lang}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required={required}
        rows={16}
        className={`${inputCls} font-mono text-base leading-relaxed ${preview ? "hidden" : ""}`}
      />
      {preview && (
        <div
          lang={lang}
          className="border-border bg-surface space-y-[1.2em] rounded-xl border-2 p-5"
          style={{ fontFamily: "var(--font-reading)", lineHeight: 2 }}
          aria-label={`ตัวอย่าง ${label}`}
        >
          {text.trim() ? <Markdown source={text} /> : <p className="text-muted">ยังไม่มีเนื้อหา</p>}
        </div>
      )}
      <p className="text-muted text-sm">
        เว้นบรรทัดเพื่อขึ้นย่อหน้าใหม่ · **ตัวหนา** · *ตัวเอียง* · # หัวข้อ · --- เส้นคั่น
      </p>
    </div>
  );
}

export function EpisodeForm({ values }: { values: EpisodeFormValues }) {
  const [state, action, pending] = useActionState(saveEpisode, initial);
  const [status, setStatus] = useState(values.status);
  const editing = Boolean(values.episodeId);

  // ฉบับร่างอัตโนมัติ: เก็บเฉพาะเนื้อหา 3 ช่องไว้ในเบราว์เซอร์นี้ (ไม่ขึ้นเซิร์ฟเวอร์)
  const draftKey = `episode-draft:${values.titleId}:${values.episodeId ?? "new"}`;
  const [texts, setTexts] = useState({ body: values.body, en: values.en, zh: values.zh });
  const [draft, setDraft] = useState<typeof texts | null>(null);
  const touched = useRef(false);
  const wasPending = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as typeof texts;
      if (
        typeof d.body === "string" &&
        typeof d.en === "string" &&
        typeof d.zh === "string" &&
        (d.body !== values.body || d.en !== values.en || d.zh !== values.zh)
      ) {
        const t = setTimeout(() => setDraft(d), 0); // อ่านจาก localStorage ได้เฉพาะฝั่งเบราว์เซอร์
        return () => clearTimeout(t);
      }
    } catch {
      /* ฉบับร่างเสียหาย — ข้าม */
    }
  }, [draftKey, values.body, values.en, values.zh]);

  useEffect(() => {
    if (!touched.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(texts));
      } catch {
        /* พื้นที่เต็ม — ไม่เป็นไร */
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [texts, draftKey]);

  // บันทึกสำเร็จ (ส่งเสร็จและไม่มี error) → ล้างฉบับร่าง
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ไม่เป็นไร */
      }
    }
    wasPending.current = pending;
  }, [pending, state.error, draftKey]);

  const setText = (k: keyof typeof texts) => (v: string) => {
    touched.current = true;
    setTexts((t) => ({ ...t, [k]: v }));
  };

  return (
    <form onSubmit={submitKeepingValues(action)} className="flex max-w-3xl flex-col gap-5">
      {draft && (
        <div
          role="status"
          className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4"
        >
          <span className="font-bold">พบฉบับร่างที่ยังไม่ได้บันทึกในเบราว์เซอร์นี้</span>
          <button
            type="button"
            className="border-border min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold"
            onClick={() => {
              touched.current = true;
              setTexts(draft);
              setDraft(null);
            }}
          >
            กู้คืน
          </button>
          <button
            type="button"
            className="border-border min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold"
            onClick={() => {
              try {
                localStorage.removeItem(draftKey);
              } catch {
                /* ไม่เป็นไร */
              }
              setDraft(null);
            }}
          >
            ทิ้ง
          </button>
        </div>
      )}
      <input type="hidden" name="titleId" value={values.titleId} />
      {values.episodeId && <input type="hidden" name="episodeId" value={values.episodeId} />}

      <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
        <Field label="เลขตอน" htmlFor="number">
          <input
            id="number"
            name="number"
            type="number"
            min={1}
            step={1}
            defaultValue={values.number}
            required
            className={inputCls}
          />
        </Field>
        <Field label="ชื่อตอน" htmlFor="name">
          <input id="name" name="name" defaultValue={values.name} required className={inputCls} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="สถานะ" htmlFor="status">
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={inputCls}
          >
            <option value="draft">ฉบับร่าง (ผู้อ่านไม่เห็น)</option>
            <option value="scheduled">ตั้งเวลาเผยแพร่</option>
            <option value="published">เผยแพร่ทันที</option>
          </select>
        </Field>
        <Field label="สิทธิ์การอ่าน" htmlFor="access" hint="“ตามเรื่อง” = ใช้ตามที่ตั้งไว้ที่ตัวเรื่อง">
          <select id="access" name="access" defaultValue={values.access} className={inputCls}>
            <option value="inherit">ตามเรื่อง</option>
            <option value="free">ฟรี</option>
            <option value="premium">Premium</option>
          </select>
        </Field>
      </div>

      {status === "scheduled" && (
        <Field label="วันและเวลาเผยแพร่ (เวลาไทย)" htmlFor="publishAt">
          <input
            id="publishAt"
            name="publishAt"
            type="datetime-local"
            defaultValue={values.publishAt}
            required
            className={inputCls}
          />
        </Field>
      )}

      <MarkdownBox
        id="body"
        name="body"
        label="เนื้อหา (ภาษาไทย ต้นฉบับ)"
        text={texts.body}
        setText={setText("body")}
        lang="th"
      />

      <fieldset className="border-border flex flex-col gap-5 rounded-2xl border p-5">
        <legend className="px-2 font-bold">คำแปล (เว้นว่าง = ไม่มีคำแปลภาษานั้น)</legend>
        <MarkdownBox
          id="en"
          name="en"
          label="English"
          text={texts.en}
          setText={setText("en")}
          lang="en"
        />
        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            name="enMachine"
            defaultChecked={values.enMachine}
            className="h-6 w-6"
          />
          <span>เป็นการแปลอัตโนมัติ (แสดงป้าย “แปลอัตโนมัติ” ให้ผู้อ่าน)</span>
        </label>
        <MarkdownBox
          id="zh"
          name="zh"
          label="中文"
          text={texts.zh}
          setText={setText("zh")}
          lang="zh"
        />
        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            name="zhMachine"
            defaultChecked={values.zhMachine}
            className="h-6 w-6"
          />
          <span>เป็นการแปลอัตโนมัติ (แสดงป้าย “แปลอัตโนมัติ” ให้ผู้อ่าน)</span>
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-accent font-bold">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "เพิ่มตอน"}
        </button>
        <button
          type="submit"
          name="after"
          value="next"
          disabled={pending}
          className="border-border bg-surface min-h-12 cursor-pointer rounded-full border-2 px-8 font-bold disabled:opacity-60"
        >
          บันทึกแล้วเพิ่มตอนถัดไป
        </button>
      </div>
    </form>
  );
}
