"use client";

import { useActionState } from "react";
import { WEEKDAYS } from "@/features/catalog/schedule";
import { saveTitle, type FormState } from "./actions";
import { submitKeepingValues } from "./submit";
import { Field, inputCls, primaryBtn } from "./ui";

export interface TitleFormValues {
  id?: string;
  type: "novel" | "manga" | "video";
  slug: string;
  name: string;
  synopsis: string;
  author: string;
  status: "ongoing" | "completed" | "hiatus";
  rating: "all" | "13" | "18";
  /** "" = ไม่ระบุ, "0"–"6" = อาทิตย์–เสาร์ */
  updateDay: string;
  access: "free" | "premium";
  published: boolean;
  featured: boolean;
  tags: string;
}

const initial: FormState = {};

export function TitleForm({ values }: { values: TitleFormValues }) {
  const [state, action, pending] = useActionState(saveTitle, initial);
  const editing = Boolean(values.id);

  return (
    <form onSubmit={submitKeepingValues(action)} className="flex max-w-2xl flex-col gap-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Field label="ประเภท" htmlFor="type" hint={editing ? "เปลี่ยนประเภทหลังสร้างไม่ได้" : undefined}>
        {editing ? (
          <>
            <input type="hidden" name="type" value={values.type} />
            <input id="type" value={labelOf(values.type)} readOnly className={inputCls} />
          </>
        ) : (
          <select id="type" name="type" defaultValue={values.type} className={inputCls}>
            <option value="novel">นิยาย</option>
            <option value="manga">มังงะ (ตัวอ่านมาในเฟส 4)</option>
            <option value="video">วิดีโอ (ตัวเล่นมาในเฟส 5)</option>
          </select>
        )}
      </Field>

      <Field label="ชื่อเรื่อง" htmlFor="name">
        <input id="name" name="name" defaultValue={values.name} required className={inputCls} />
      </Field>

      <Field
        label="slug (ใช้ใน URL)"
        htmlFor="slug"
        hint="ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลาง เช่น moonlit-garden — เปลี่ยนแล้วลิงก์เดิมจะใช้ไม่ได้"
      >
        <input
          id="slug"
          name="slug"
          defaultValue={values.slug}
          required
          autoCapitalize="none"
          spellCheck={false}
          className={inputCls}
        />
      </Field>

      <Field
        label="ผู้แต่ง/ผู้สร้าง"
        htmlFor="author"
        hint="ว่างได้ — เรื่องที่ใช้ชื่อเดียวกันจะรวมอยู่ในหน้าผู้สร้างเดียวกัน"
      >
        <input
          id="author"
          name="author"
          defaultValue={values.author}
          maxLength={100}
          className={inputCls}
        />
      </Field>

      <Field label="เรื่องย่อ" htmlFor="synopsis">
        <textarea
          id="synopsis"
          name="synopsis"
          defaultValue={values.synopsis}
          rows={5}
          className={inputCls}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="สถานะ" htmlFor="status">
          <select id="status" name="status" defaultValue={values.status} className={inputCls}>
            <option value="ongoing">กำลังอัปเดต</option>
            <option value="completed">จบแล้ว</option>
            <option value="hiatus">พักการอัปเดต</option>
          </select>
        </Field>
        <Field label="เรตอายุ" htmlFor="rating">
          <select id="rating" name="rating" defaultValue={values.rating} className={inputCls}>
            <option value="all">ทุกวัย</option>
            <option value="13">13+</option>
            <option value="18">18+</option>
          </select>
        </Field>
        <Field label="สิทธิ์การอ่าน" htmlFor="access">
          <select id="access" name="access" defaultValue={values.access} className={inputCls}>
            <option value="free">ฟรี</option>
            <option value="premium">Premium</option>
          </select>
        </Field>
      </div>

      <Field
        label="วันอัปเดตประจำสัปดาห์"
        htmlFor="updateDay"
        hint="ใช้ทำตารางรายวันและบอกผู้อ่านว่า “อัปเดตทุกวัน…” เรื่องที่จบแล้วจะไม่ขึ้นในตาราง"
      >
        <select
          id="updateDay"
          name="updateDay"
          defaultValue={values.updateDay}
          className={inputCls}
        >
          <option value="">ไม่ระบุ</option>
          {WEEKDAYS.map((d) => (
            <option key={d.id} value={d.id}>
              ทุกวัน{d.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="แท็ก" htmlFor="tags" hint="คั่นด้วยจุลภาค เช่น แฟนตาซี, โรแมนติก — แท็กใหม่ถูกสร้างให้เอง">
        <input id="tags" name="tags" defaultValue={values.tags} className={inputCls} />
      </Field>

      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked={values.published}
          className="h-6 w-6"
        />
        <span>
          <strong>เผยแพร่เรื่องนี้</strong>
          <span className="text-muted block text-sm">ไม่ติ๊ก = ผู้อ่านมองไม่เห็นเรื่องนี้ (เห็นเฉพาะแอดมิน)</span>
        </span>
      </label>

      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={values.featured}
          className="h-6 w-6"
        />
        <span>
          <strong>เรื่องเด่น</strong>
          <span className="text-muted block text-sm">
            แสดงเป็นแบนเนอร์หน้าแรก (ติ๊กหลายเรื่องได้ หน้าแรกจะแสดงเรื่องที่อัปเดตล่าสุดก่อน)
          </span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-accent font-bold">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryBtn} self-start`}>
        {pending ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "สร้างเรื่อง"}
      </button>
    </form>
  );
}

const labelOf = (t: string) => (t === "novel" ? "นิยาย" : t === "manga" ? "มังงะ" : "วิดีโอ");
