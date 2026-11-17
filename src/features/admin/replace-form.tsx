"use client";

import { useState } from "react";
import { applyReplace, previewReplace, type ReplacePreview } from "./replace-actions";
import { ghostBtn, inputCls, primaryBtn } from "./ui";

export function ReplaceForm({ titleId }: { titleId: string }) {
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReplacePreview | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const input = { titleId, find, replacement, matchCase };

  async function doPreview() {
    setBusy(true);
    setDone("");
    setError("");
    setPreview(null);
    try {
      const r = await previewReplace(input);
      if (r.error) setError(r.error);
      else setPreview(r);
    } finally {
      setBusy(false);
    }
  }

  async function doApply() {
    if (!preview) return;
    if (!window.confirm(`แทนที่ ${preview.matches} จุดใน ${preview.episodes} ตอน? ย้อนกลับไม่ได้`))
      return;
    setBusy(true);
    setError("");
    try {
      const r = await applyReplace(input);
      if (r.error) setError(r.error);
      else setDone(`แทนที่แล้ว ${r.matches} จุดใน ${r.episodes} ตอน`);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1 font-bold">
        คำที่ต้องการค้นหา
        <input
          className={inputCls}
          value={find}
          maxLength={200}
          onChange={(e) => {
            setFind(e.target.value);
            setPreview(null);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 font-bold">
        แทนที่ด้วย (เว้นว่าง = ลบคำนั้นทิ้ง)
        <input
          className={inputCls}
          value={replacement}
          maxLength={200}
          onChange={(e) => {
            setReplacement(e.target.value);
            setPreview(null);
          }}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={matchCase}
          onChange={(e) => {
            setMatchCase(e.target.checked);
            setPreview(null);
          }}
        />
        ตัวพิมพ์เล็ก/ใหญ่ต้องตรงกัน (ภาษาอังกฤษ)
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          className={ghostBtn}
          disabled={busy || !find}
          onClick={() => void doPreview()}
        >
          ดูตัวอย่างก่อน
        </button>
        {preview && preview.matches > 0 && (
          <button
            type="button"
            className={primaryBtn}
            disabled={busy}
            onClick={() => void doApply()}
          >
            แทนที่ทั้งหมด
          </button>
        )}
      </div>
      {preview && (
        <div role="status" className="border-border rounded-2xl border p-4">
          {preview.matches === 0 ? (
            <p className="font-bold">ไม่พบคำนี้ในเนื้อหา</p>
          ) : (
            <>
              <p className="font-bold">
                พบ {preview.matches} จุด ใน {preview.episodes} ตอน
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {preview.samples.map((s) => (
                  <li key={s.number}>
                    <span className="font-bold">ตอน {s.number}:</span> {s.snippet}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {done && (
        <p role="status" className="font-bold">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="text-accent font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
