import { CONTENT_TYPES } from "@/content-types/registry";
import { KIND_LABEL, type SectionKind } from "@/features/home/sections/config";
import { Field, inputCls } from "./ui";

type Cfg = Record<string, unknown>;

const text = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const numStr = (v: unknown) => (typeof v === "number" ? String(v) : "");
const list = (v: unknown) => (Array.isArray(v) ? v.join("\n") : "");

/** ช่องกรอกเฉพาะชนิดของส่วน — ใช้ร่วมกันทั้งฟอร์มเพิ่มและฟอร์มแก้ไข (ชื่อช่องตรงกับ rawConfigFromForm) */
export function SectionFields({
  kind,
  config = {},
  idPrefix,
}: {
  kind: SectionKind;
  config?: Cfg;
  idPrefix: string;
}) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const limit = (min: number, max: number, hint: string) => (
    <Field label="จำนวนที่แสดง" htmlFor={id("limit")} hint={`${hint} (เว้นว่าง = ค่าเริ่มต้น)`}>
      <input
        id={id("limit")}
        name="limit"
        type="number"
        min={min}
        max={max}
        defaultValue={numStr(config.limit)}
        className={inputCls}
      />
    </Field>
  );

  switch (kind) {
    case "spotlight":
      return (
        <>
          <Field
            label="วิธีเลือกเรื่อง"
            htmlFor={id("mode")}
            hint="อัตโนมัติ = เรื่องที่ติ๊ก “เรื่องเด่น” แล้วเติมด้วยเรื่องอัปเดตล่าสุด · เลือกเอง = ตามรายการด้านล่าง"
          >
            <select
              id={id("mode")}
              name="mode"
              defaultValue={text(config.mode, "auto")}
              className={inputCls}
            >
              <option value="auto">อัตโนมัติ</option>
              <option value="manual">เลือกเอง</option>
            </select>
          </Field>
          <Field label="slug เรื่อง (เมื่อเลือกเอง)" htmlFor={id("slugs")} hint="บรรทัดละ 1 เรื่อง">
            <textarea
              id={id("slugs")}
              name="slugs"
              rows={3}
              defaultValue={list(config.slugs)}
              className={inputCls}
            />
          </Field>
          {limit(1, 6, "1–6 เรื่อง")}
        </>
      );
    case "top_ten":
      return (
        <>
          <Field label="วิธีเลือกเรื่อง" htmlFor={id("source")} hint="อัตโนมัติ = เรียงจากยอดเข้าชมช่วงนี้">
            <select
              id={id("source")}
              name="source"
              defaultValue={text(config.source, "auto")}
              className={inputCls}
            >
              <option value="auto">อัตโนมัติ (ตามยอดเข้าชม)</option>
              <option value="manual">เลือกเอง</option>
            </select>
          </Field>
          <Field
            label="slug เรื่อง (เมื่อเลือกเอง)"
            htmlFor={id("slugs")}
            hint="บรรทัดละ 1 เรื่อง เรียงตามอันดับ"
          >
            <textarea
              id={id("slugs")}
              name="slugs"
              rows={3}
              defaultValue={list(config.slugs)}
              className={inputCls}
            />
          </Field>
        </>
      );
    case "type_zone":
      return (
        <>
          <Field label="ประเภท" htmlFor={id("type")}>
            <select
              id={id("type")}
              name="type"
              defaultValue={text(config.type, "novel")}
              className={inputCls}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          {limit(3, 12, "3–12 เรื่อง")}
        </>
      );
    case "latest":
      return limit(4, 24, "4–24 เรื่อง");
    case "tag_chips":
      return limit(3, 16, "3–16 หมวด");
    case "collection":
      return (
        <>
          <Field label="slug ของชุดคัดสรร" htmlFor={id("cs")} hint="สร้างชุดได้ที่หน้า “ชุดคัดสรร”">
            <input
              id={id("cs")}
              name="collectionSlug"
              defaultValue={text(config.slug)}
              className={inputCls}
            />
          </Field>
          {limit(3, 12, "3–12 เรื่อง")}
        </>
      );
    case "banner":
      return (
        <>
          <Field label="ข้อความประกาศ" htmlFor={id("text")}>
            <input
              id={id("text")}
              name="text"
              defaultValue={text(config.text)}
              maxLength={200}
              className={inputCls}
            />
          </Field>
          <Field label="ข้อความบนปุ่ม (ว่าง = ไม่มีปุ่ม)" htmlFor={id("label")}>
            <input
              id={id("label")}
              name="label"
              defaultValue={text(config.label)}
              maxLength={40}
              className={inputCls}
            />
          </Field>
          <Field label="ลิงก์ปลายทาง" htmlFor={id("href")} hint="ขึ้นต้นด้วย / (หน้าในเว็บ) หรือ https://">
            <input
              id={id("href")}
              name="href"
              defaultValue={text(config.href)}
              className={inputCls}
            />
          </Field>
        </>
      );
  }
}

export { KIND_LABEL };
