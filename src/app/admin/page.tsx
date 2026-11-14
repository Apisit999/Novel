import Link from "next/link";
import { getContentType } from "@/content-types/registry";
import { requireAdmin } from "@/features/admin/guard";
import { Badge, ghostBtn } from "@/features/admin/ui";

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const [{ db }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data, error } = await db
    .from("titles")
    .select("id, name, slug, type, published, status, episodes(count)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`อ่านรายการเรื่องไม่สำเร็จ: ${error.message}`);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">เรื่องทั้งหมด</h1>
        <Link href="/admin/titles/new" className={ghostBtn}>
          + เรื่องใหม่
        </Link>
      </div>
      {query.deleted && (
        <p role="status" className="border-border bg-surface mt-4 rounded-xl border p-3">
          ลบเรื่องแล้ว
        </p>
      )}

      {data.length === 0 ? (
        <p className="text-muted mt-6">ยังไม่มีเรื่อง — กด “+ เรื่องใหม่” เพื่อเริ่มลงเรื่องแรก</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/titles/${t.id}`}
                className="border-border bg-surface flex min-h-16 flex-wrap items-center gap-3 rounded-2xl border p-4 no-underline"
              >
                <span className="text-foreground text-lg font-bold">{t.name}</span>
                <Badge>{getContentType(t.type)?.label ?? t.type}</Badge>
                <Badge kind={t.published ? "published" : "draft"}>
                  {t.published ? "เผยแพร่แล้ว" : "ยังไม่เผยแพร่"}
                </Badge>
                <span className="text-muted ml-auto text-sm">
                  {t.episodes[0]?.count ?? 0} ตอน · /{t.slug}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
