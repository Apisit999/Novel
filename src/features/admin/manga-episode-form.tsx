"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./actions";
import { saveMangaEpisode } from "./manga-actions";
import { submitKeepingValues } from "./submit";
import { Field, inputCls, primaryBtn } from "./ui";

export interface MangaEpisodeValues {
  titleId: string;
  episodeId?: string;
  number: number;
  name: string;
  access: "inherit" | "free" | "premium";
  status: "draft" | "scheduled" | "published";
  /** "YYYY-MM-DDTHH:mm" เวลาไทย */
  publishAt: string;
}

const initial: FormState = {};

export function MangaEpisodeForm({
  values,
  kind = "manga",
}: {
  values: MangaEpisodeValues;
  kind?: "manga" | "video";
}) {
  const [state, action, pending] = useActionState(saveMangaEpisode, initial);
  const [status, setStatus] = useState(values.status);
  const editing = Boolean(values.episodeId);

  return (
    <form onSubmit={submitKeepingValues(action)} className="flex max-w-2xl flex-col gap-5">
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

      {state.error && (
        <p role="alert" className="text-accent font-bold">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryBtn} self-start`}>
        {pending
          ? "กำลังบันทึก…"
          : editing
            ? "บันทึกการแก้ไข"
            : kind === "video"
              ? "สร้างตอน แล้วไปอัปโหลดวิดีโอ"
              : "สร้างตอน แล้วไปอัปโหลดหน้า"}
      </button>
    </form>
  );
}
