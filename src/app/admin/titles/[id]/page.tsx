import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTitle } from "@/features/admin/actions";
import { EpisodeList } from "@/features/admin/episode-list";
import { requireAdmin } from "@/features/admin/guard";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { CoverUploader } from "@/features/admin/cover-uploader";
import { TitleForm } from "@/features/admin/title-form";
import { dangerBtn, ghostBtn } from "@/features/admin/ui";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditTitlePage({
  params,
  searchParams,
}: PageProps<"/admin/titles/[id]">) {
  const [{ db }, { id }, query] = await Promise.all([requireAdmin(), params, searchParams]);
  if (!UUID.test(id)) notFound();

  const { data: title } = await db
    .from("titles")
    .select("*, title_tags(tags(name))")
    .eq("id", id)
    .maybeSingle();
  if (!title) notFound();
  const { data: episodes } = await db
    .from("episodes")
    .select("id, number, name, status, access, publish_at")
    .eq("title_id", id)
    .order("number", { ascending: true });

  const tags = title.title_tags.flatMap((t) => (t.tags ? [t.tags.name] : [])).join(", ");

  return (
    <section className="flex flex-col gap-10">
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">แก้ไข: {title.name}</h1>
          {title.published && (
            <Link href={`/title/${title.slug}`} className={ghostBtn}>
              ดูหน้าเรื่องจริง →
            </Link>
          )}
        </div>
        {query.saved && (
          <p
            role="status"
            className="border-border bg-surface mb-6 rounded-xl border p-3 font-bold"
          >
            บันทึกแล้ว
          </p>
        )}
        <div className="mb-8">
          <h2 className="mb-3 text-xl font-bold">ปก</h2>
          <CoverUploader titleId={title.id} coverKey={title.cover_key} />
        </div>
        <TitleForm
          values={{
            id: title.id,
            type: title.type,
            slug: title.slug,
            name: title.name,
            synopsis: title.synopsis,
            author: title.author ?? "",
            status: title.status,
            rating: title.rating,
            updateDay: title.update_day === null ? "" : String(title.update_day),
            access: title.access,
            published: title.published,
            featured: title.featured,
            tags,
          }}
        />
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">ตอน ({episodes?.length ?? 0})</h2>
          <div className="flex flex-wrap gap-3">
            {(title.type === "novel" || title.type === "manga" || title.type === "video") && (
              <Link href={`/admin/titles/${id}/import`} className={ghostBtn}>
                นำเข้าหลายตอน
              </Link>
            )}
            {title.type === "novel" && (episodes?.length ?? 0) > 0 && (
              <>
                {/* ลิงก์ธรรมดา (ไม่ใช้ Link) เพราะเป็นไฟล์ดาวน์โหลด ไม่ใช่หน้า */}
                <a href={`/admin/titles/${id}/export?format=md`} className={ghostBtn}>
                  ส่งออก .md
                </a>
                <a href={`/admin/titles/${id}/export?format=txt`} className={ghostBtn}>
                  ส่งออก .txt
                </a>
                <Link href={`/admin/titles/${id}/replace`} className={ghostBtn}>
                  ค้นหา-แทนที่
                </Link>
              </>
            )}
            <Link href={`/admin/titles/${id}/episodes/new`} className={ghostBtn}>
              + เพิ่มตอน
            </Link>
          </div>
        </div>
        {!episodes?.length ? (
          <p className="text-muted">ยังไม่มีตอน — กด “+ เพิ่มตอน” เพื่อลงตอนแรก</p>
        ) : (
          <EpisodeList
            titleId={id}
            episodes={episodes.map((e) => ({
              id: e.id,
              number: e.number,
              name: e.name,
              status: e.status,
              access: e.access,
              publishAt: isoToThaiLocal(e.publish_at).replace("T", " "),
            }))}
          />
        )}
      </div>

      <details className="border-border rounded-2xl border p-5">
        <summary className="cursor-pointer font-bold">ลบเรื่องนี้</summary>
        <p className="text-muted mt-3">
          ลบแล้วตอน เนื้อหา คำแปล และรายการโปรด/ความคืบหน้าของผู้อ่านที่อ้างถึงเรื่องนี้จะหายทั้งหมด กู้คืนไม่ได้
        </p>
        <form action={deleteTitle} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={dangerBtn}>
            ยืนยันลบเรื่อง “{title.name}”
          </button>
        </form>
      </details>
    </section>
  );
}
