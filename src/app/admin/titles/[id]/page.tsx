import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTitle } from "@/features/admin/actions";
import { requireAdmin } from "@/features/admin/guard";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { TitleForm } from "@/features/admin/title-form";
import { Badge, dangerBtn, ghostBtn } from "@/features/admin/ui";

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
        <TitleForm
          values={{
            id: title.id,
            type: title.type,
            slug: title.slug,
            name: title.name,
            synopsis: title.synopsis,
            status: title.status,
            rating: title.rating,
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
          {title.type !== "video" && (
            <Link href={`/admin/titles/${id}/episodes/new`} className={ghostBtn}>
              + เพิ่มตอน
            </Link>
          )}
        </div>
        {title.type === "video" ? (
          <p className="text-muted">การลงตอนของวิดีโอจะมาในเฟส 5</p>
        ) : !episodes?.length ? (
          <p className="text-muted">ยังไม่มีตอน — กด “+ เพิ่มตอน” เพื่อลงตอนแรก</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {episodes.map((e) => (
              <li
                key={e.id}
                className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-2xl border p-4"
              >
                <Link
                  href={`/admin/titles/${id}/episodes/${e.number}`}
                  className="text-foreground min-w-0 flex-1 font-bold no-underline"
                >
                  {e.number}. {e.name}
                </Link>
                <Badge kind={e.status} />
                {e.status === "scheduled" && (
                  <span className="text-muted text-sm">
                    {isoToThaiLocal(e.publish_at).replace("T", " ")} น.
                  </span>
                )}
                {e.access !== "inherit" && (
                  <Badge>{e.access === "premium" ? "Premium" : "ฟรี"}</Badge>
                )}
              </li>
            ))}
          </ul>
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
