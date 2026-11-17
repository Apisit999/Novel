import Link from "next/link";
import { getContentType } from "@/content-types/registry";
import { requireAdmin } from "@/features/admin/guard";
import { Badge, ghostBtn } from "@/features/admin/ui";
import { Pagination } from "@/components/pagination";
import { paginate, parsePage } from "@/lib/paginate";

const PER_PAGE = 30;

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const [{ db }, query] = await Promise.all([requireAdmin(), searchParams]);
  // ค้นหา/กรอง: ตัดอักขระที่เป็นไวยากรณ์ของตัวกรอง PostgREST (, ( ) % *) ออกจากคำค้น กันตัวกรองเพี้ยน
  const q = (typeof query.q === "string" ? query.q : "")
    .replace(/[,()%*\\]/g, " ")
    .trim()
    .slice(0, 100);
  const type =
    typeof query.type === "string" && ["novel", "manga", "video"].includes(query.type)
      ? query.type
      : "";
  const fetchPage = (page: number) => {
    let req = db
      .from("titles")
      .select("id, name, slug, type, published, status, episodes(count)", { count: "exact" })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }) // ลำดับคงที่เมื่อเวลาเท่ากัน ไม่งั้นแบ่งหน้าแล้วรายการซ้ำ/ตกหล่น
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    if (q) req = req.or(`name.ilike.%${q}%,slug.ilike.%${q}%,author.ilike.%${q}%`);
    if (type) req = req.eq("type", type as "novel" | "manga" | "video");
    return req;
  };
  const requested = parsePage(query.page);
  const first = await fetchPage(requested);
  if (first.error) throw new Error(`อ่านรายการเรื่องไม่สำเร็จ: ${first.error.message}`);
  const pg = paginate(first.count ?? 0, requested, PER_PAGE);
  let rows = first.data ?? [];
  if (rows.length === 0 && pg.page !== requested) {
    // ขอหน้าเกินช่วง → ดึงหน้าสุดท้ายแทน
    const last = await fetchPage(pg.page);
    if (last.error) throw new Error(`อ่านรายการเรื่องไม่สำเร็จ: ${last.error.message}`);
    rows = last.data ?? [];
  }
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (type) p.set("type", type);
    if (n > 1) p.set("page", String(n));
    return `/admin${p.size ? `?${p}` : ""}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">เรื่องทั้งหมด</h1>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/export" className={ghostBtn}>
            สำรองนิยายทั้งหมด (.zip)
          </a>
          <Link href="/admin/audit" className={ghostBtn}>
            ประวัติการใช้งาน
          </Link>
          <Link href="/admin/restore" className={ghostBtn}>
            กู้คืนจากไฟล์สำรอง
          </Link>
          <Link href="/admin/titles/new" className={ghostBtn}>
            + เรื่องใหม่
          </Link>
        </div>
      </div>
      {query.deleted && (
        <p role="status" className="border-border bg-surface mt-4 rounded-xl border p-3">
          ลบเรื่องแล้ว
        </p>
      )}

      <form
        action="/admin"
        method="get"
        role="search"
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อเรื่อง / slug / ผู้แต่ง"
          aria-label="ค้นหาเรื่อง"
          className="border-border bg-surface text-foreground min-h-12 w-full max-w-sm rounded-xl border-2 px-4 py-2"
        />
        <select
          name="type"
          defaultValue={type}
          aria-label="ประเภท"
          className="border-border bg-surface text-foreground min-h-12 rounded-xl border-2 px-4"
        >
          <option value="">ทุกประเภท</option>
          <option value="novel">นิยาย</option>
          <option value="manga">มังงะ</option>
          <option value="video">วิดีโอ</option>
        </select>
        <button type="submit" className={ghostBtn}>
          ค้นหา
        </button>
        {(q || type) && (
          <Link href="/admin" className="text-accent font-bold">
            ล้างการค้นหา
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="text-muted mt-6">
          {q || type ? "ไม่พบเรื่องที่ตรงเงื่อนไข" : "ยังไม่มีเรื่อง — กด “+ เรื่องใหม่” เพื่อเริ่มลงเรื่องแรก"}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((t) => (
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
      <Pagination page={pg.page} totalPages={pg.totalPages} href={pageHref} />
    </section>
  );
}
