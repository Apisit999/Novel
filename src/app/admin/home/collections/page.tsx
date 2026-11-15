import Link from "next/link";
import {
  deleteCollection,
  saveCollection,
  saveCollectionItems,
} from "@/features/admin/home-actions";
import { requireAdmin } from "@/features/admin/guard";
import { listTitleOptions } from "@/features/admin/title-options";
import { TitlePicker } from "@/features/admin/title-picker";
import { dangerBtn, Field, ghostBtn, inputCls, primaryBtn } from "@/features/admin/ui";

export default async function CollectionsPage({
  searchParams,
}: PageProps<"/admin/home/collections">) {
  const [{ db }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data, error } = await db
    .from("collections")
    .select("id, slug, title, description, published, collection_items(position, titles(slug))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`อ่านชุดคัดสรรไม่สำเร็จ: ${error.message}`);
  const collections = data ?? [];
  const titles = await listTitleOptions(db);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ชุดคัดสรร</h1>
        <Link href="/admin/home" className={ghostBtn}>
          ← จัดหน้าแรก
        </Link>
      </div>
      <p className="text-muted max-w-2xl">
        รวมเรื่องเป็นชุดตามธีม เช่น “อ่านจบในคืนเดียว” แล้วไปเพิ่มส่วน “ชุดคัดสรร” ที่หน้าจัดหน้าแรกโดยใช้ slug ของชุด
      </p>

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

      <form
        action={saveCollection}
        className="border-border flex max-w-xl flex-col gap-4 rounded-2xl border p-5"
      >
        <h2 className="text-xl font-bold">สร้างชุดใหม่</h2>
        <Field label="ชื่อชุด" htmlFor="c-title">
          <input id="c-title" name="title" required maxLength={120} className={inputCls} />
        </Field>
        <Field label="slug" htmlFor="c-slug" hint="a-z 0-9 และขีดกลาง เช่น night-reads">
          <input id="c-slug" name="slug" required autoCapitalize="none" className={inputCls} />
        </Field>
        <Field label="คำอธิบายสั้น ๆ" htmlFor="c-desc">
          <input id="c-desc" name="description" maxLength={500} className={inputCls} />
        </Field>
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" name="published" defaultChecked className="h-6 w-6" />
          <span>แสดงชุดนี้ (ปิด = ซ่อนจากผู้อ่าน)</span>
        </label>
        <button type="submit" className={`${primaryBtn} self-start`}>
          สร้างชุด
        </button>
      </form>

      <ul className="flex flex-col gap-4">
        {collections.map((c) => {
          const slugs = [...c.collection_items]
            .sort((a, b) => a.position - b.position)
            .map((i) => i.titles?.slug)
            .filter(Boolean);
          return (
            <li key={c.id} className="border-border bg-surface rounded-2xl border p-5">
              <h2 className="text-lg font-bold">
                {c.title} <span className="text-muted font-normal">/{c.slug}</span>
                {!c.published && <span className="text-muted font-normal"> · ซ่อนอยู่</span>}
              </h2>
              <details className="mt-3">
                <summary className="cursor-pointer font-bold">
                  แก้ไขชุดนี้ ({slugs.length} เรื่อง)
                </summary>
                <form action={saveCollectionItems} className="mt-4 flex max-w-xl flex-col gap-3">
                  <input type="hidden" name="id" value={c.id} />
                  <Field
                    label="เรื่องในชุด"
                    htmlFor={`items-${c.id}`}
                    hint="เรียงตามที่จะแสดง (สูงสุด 60 เรื่อง)"
                  >
                    <TitlePicker
                      name="slugs"
                      label={`เรื่องในชุด ${c.title}`}
                      options={titles}
                      initial={slugs as string[]}
                      max={60}
                    />
                  </Field>
                  <button type="submit" className={`${primaryBtn} self-start`}>
                    บันทึกรายการเรื่อง
                  </button>
                </form>
                <form action={saveCollection} className="mt-6 flex max-w-xl flex-col gap-3">
                  <input type="hidden" name="id" value={c.id} />
                  <Field label="ชื่อชุด" htmlFor={`t-${c.id}`}>
                    <input
                      id={`t-${c.id}`}
                      name="title"
                      defaultValue={c.title}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="slug" htmlFor={`s-${c.id}`}>
                    <input
                      id={`s-${c.id}`}
                      name="slug"
                      defaultValue={c.slug}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="คำอธิบาย" htmlFor={`d-${c.id}`}>
                    <input
                      id={`d-${c.id}`}
                      name="description"
                      defaultValue={c.description}
                      className={inputCls}
                    />
                  </Field>
                  <label className="flex min-h-12 items-center gap-3">
                    <input
                      type="checkbox"
                      name="published"
                      defaultChecked={c.published}
                      className="h-6 w-6"
                    />
                    <span>แสดงชุดนี้</span>
                  </label>
                  <button type="submit" className={`${primaryBtn} self-start`}>
                    บันทึกชื่อ/คำอธิบาย
                  </button>
                </form>
                <form action={deleteCollection} className="mt-4">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={dangerBtn}>
                    ลบชุดนี้
                  </button>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
