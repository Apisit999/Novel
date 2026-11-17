import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { Pagination } from "@/components/pagination";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { paginate, parsePage } from "@/lib/paginate";

export const metadata = { title: "ประวัติการใช้งานหลังบ้าน" };

const PAGE = 100;

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const [{ db }, query] = await Promise.all([requireAdmin(), searchParams]);
  const requested = parsePage(query.page);
  const read = (page: number) =>
    db
      .from("admin_audit_log")
      .select("id, at, admin_email, action, target, detail", { count: "exact" })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
  const first = await read(requested);
  const pg = paginate(first.count ?? 0, requested, PAGE);
  const result =
    !first.error && first.data.length === 0 && pg.page !== requested ? await read(pg.page) : first;
  const { data, error } = result;

  return (
    <section>
      <p className="text-muted text-sm">
        <Link href="/admin">← เรื่องทั้งหมด</Link>
      </p>
      <h1 className="mt-1 mb-2 text-2xl font-bold">ประวัติการใช้งานหลังบ้าน</h1>
      <p className="text-muted mb-6 max-w-3xl">
        บันทึกว่าใครทำอะไรกับอะไรเมื่อไหร่ (ใหม่สุดก่อน หน้าละ {PAGE} รายการ) แก้ไขหรือลบประวัติไม่ได้
        ใช้ตรวจย้อนหลังเมื่อสงสัยว่ามีคนเข้าผิดปกติ
      </p>
      {error ? (
        <p role="alert" className="text-accent font-bold">
          อ่านประวัติไม่ได้ — ตรวจว่ารัน migration `admin_audit_log` แล้ว
        </p>
      ) : !data?.length ? (
        <p className="text-muted">ยังไม่มีประวัติ</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="py-2 pr-4">เวลา (ไทย)</th>
                <th className="py-2 pr-4">แอดมิน</th>
                <th className="py-2 pr-4">การกระทำ</th>
                <th className="py-2 pr-4">เป้าหมาย</th>
                <th className="py-2">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-border border-b align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {isoToThaiLocal(r.at).replace("T", " ")}
                  </td>
                  <td className="py-2 pr-4">{r.admin_email ?? "—"}</td>
                  <td className="py-2 pr-4 font-bold">{r.action}</td>
                  <td className="py-2 pr-4 break-all">{r.target ?? "—"}</td>
                  <td className="py-2 break-all">{JSON.stringify(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={pg.page}
        totalPages={pg.totalPages}
        href={(n) => (n > 1 ? `/admin/audit?page=${n}` : "/admin/audit")}
      />
    </section>
  );
}
