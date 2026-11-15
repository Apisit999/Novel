import Link from "next/link";
import {
  addSection,
  createDefaultSections,
  deleteSection,
  moveSection,
  saveSection,
  toggleSection,
} from "@/features/admin/home-actions";
import { KIND_LABEL, SectionFields } from "@/features/admin/home-ui";
import { requireAdmin } from "@/features/admin/guard";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { Badge, dangerBtn, Field, ghostBtn, inputCls, primaryBtn } from "@/features/admin/ui";
import { SECTION_KINDS, type SectionKind } from "@/features/home/sections/config";

const iconBtn =
  "border-border bg-surface min-h-10 min-w-10 cursor-pointer rounded-full border font-bold disabled:cursor-default disabled:opacity-30";

/** ส่วนนี้ยังไม่ถึงเวลา/หมดเวลาแล้ว ณ ตอนนี้หรือไม่ (ใช้แสดงป้ายเตือนแอดมิน) */
function outsideWindow(startsAt: string | null, endsAt: string | null): boolean {
  const now = Date.now();
  return Boolean((startsAt && Date.parse(startsAt) > now) || (endsAt && Date.parse(endsAt) <= now));
}

export default async function AdminHomeLayout({ searchParams }: PageProps<"/admin/home">) {
  const [{ db }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data, error } = await db
    .from("home_sections")
    .select("id, kind, title, position, enabled, config, starts_at, ends_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`อ่านส่วนของหน้าแรกไม่สำเร็จ: ${error.message}`);
  const sections = data ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">จัดหน้าแรก</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/home/promotions" className={ghostBtn}>
            โปรโมทเรื่อง
          </Link>
          <Link href="/admin/home/collections" className={ghostBtn}>
            ชุดคัดสรร
          </Link>
          <Link href="/" className={ghostBtn}>
            ดูหน้าแรก
          </Link>
        </div>
      </div>

      {query.saved && (
        <p role="status" className="border-border bg-surface rounded-xl border p-3 font-bold">
          บันทึกแล้ว
        </p>
      )}
      {typeof query.error === "string" && (
        <p role="alert" className="text-accent font-bold">
          {query.error}
        </p>
      )}

      {sections.length === 0 ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-5">
          <p>
            ยังไม่มีส่วนที่ตั้งไว้ — ตอนนี้หน้าแรกใช้ผังเริ่มต้นอัตโนมัติ (เรื่องเด่น → 10 อันดับ → โซนนิยาย/มังงะ/วิดีโอ →
            อัปเดตล่าสุด → หมวด) กดปุ่มนี้เพื่อสร้างผังเริ่มต้นไว้แก้ไขต่อ
          </p>
          <form action={createDefaultSections}>
            <button type="submit" className={primaryBtn}>
              สร้างผังเริ่มต้น
            </button>
          </form>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {sections.map((s, idx) => {
            const kind = s.kind as SectionKind;
            const scheduled = outsideWindow(s.starts_at, s.ends_at);
            return (
              <li key={s.id} className="border-border bg-surface rounded-2xl border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 font-bold">
                    {s.title || KIND_LABEL[kind] || s.kind}
                    {s.title && (
                      <span className="text-muted font-normal"> · {KIND_LABEL[kind]}</span>
                    )}
                  </span>
                  {!s.enabled && <Badge>ปิดอยู่</Badge>}
                  {s.enabled && scheduled && <Badge>นอกช่วงเวลา</Badge>}
                  <div className="flex gap-2">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveSection}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button
                          type="submit"
                          className={iconBtn}
                          disabled={dir === "up" ? idx === 0 : idx === sections.length - 1}
                          aria-label={`เลื่อน ${s.title || KIND_LABEL[kind]} ${dir === "up" ? "ขึ้น" : "ลง"}`}
                        >
                          {dir === "up" ? "↑" : "↓"}
                        </button>
                      </form>
                    ))}
                  </div>
                  <form action={toggleSection}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className={ghostBtn + " cursor-pointer"}>
                      {s.enabled ? "ปิด" : "เปิด"}
                    </button>
                  </form>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer font-bold">แก้ไขการตั้งค่า</summary>
                  <form action={saveSection} className="mt-4 flex max-w-xl flex-col gap-4">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="kind" value={kind} />
                    <Field label="หัวข้อ (ว่าง = ใช้ชื่อเริ่มต้น)" htmlFor={`t-${s.id}`}>
                      <input
                        id={`t-${s.id}`}
                        name="title"
                        defaultValue={s.title}
                        maxLength={120}
                        className={inputCls}
                      />
                    </Field>
                    <SectionFields
                      kind={kind}
                      config={(s.config ?? {}) as Record<string, unknown>}
                      idPrefix={`f-${s.id}`}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="แสดงตั้งแต่ (เวลาไทย)"
                        htmlFor={`s-${s.id}`}
                        hint="เว้นว่าง = แสดงทันที"
                      >
                        <input
                          id={`s-${s.id}`}
                          name="startsAt"
                          type="datetime-local"
                          defaultValue={isoToThaiLocal(s.starts_at)}
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label="แสดงถึง (เวลาไทย)"
                        htmlFor={`e-${s.id}`}
                        hint="เว้นว่าง = ไม่มีวันหมด"
                      >
                        <input
                          id={`e-${s.id}`}
                          name="endsAt"
                          type="datetime-local"
                          defaultValue={isoToThaiLocal(s.ends_at)}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    <button type="submit" className={`${primaryBtn} self-start`}>
                      บันทึกการตั้งค่า
                    </button>
                  </form>
                  <form action={deleteSection} className="mt-4">
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className={dangerBtn}>
                      ลบส่วนนี้
                    </button>
                  </form>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">เพิ่มส่วนใหม่</h2>
        {SECTION_KINDS.map((kind) => (
          <details key={kind} className="border-border rounded-2xl border p-4">
            <summary className="cursor-pointer font-bold">+ {KIND_LABEL[kind]}</summary>
            <form action={addSection} className="mt-4 flex max-w-xl flex-col gap-4">
              <input type="hidden" name="kind" value={kind} />
              <Field label="หัวข้อ (ว่าง = ใช้ชื่อเริ่มต้น)" htmlFor={`add-${kind}-title`}>
                <input id={`add-${kind}-title`} name="title" maxLength={120} className={inputCls} />
              </Field>
              <SectionFields kind={kind} idPrefix={`add-${kind}`} />
              <button type="submit" className={`${primaryBtn} self-start`}>
                เพิ่มส่วนนี้
              </button>
            </form>
          </details>
        ))}
      </div>
    </section>
  );
}
