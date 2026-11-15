import Link from "next/link";
import { addPin, deletePin } from "@/features/admin/home-actions";
import { requireAdmin } from "@/features/admin/guard";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { Badge, dangerBtn, Field, ghostBtn, inputCls, primaryBtn } from "@/features/admin/ui";

const PLACEMENT_LABEL: Record<string, string> = {
  spotlight: "ขึ้นแบนเนอร์เรื่องเด่นก่อน",
  top_ten_boost: "ดันขึ้นอันดับต้นของ 10 อันดับ",
  hidden: "ซ่อนจากหน้าแรก",
};

/** สถานะของการปัก ณ ตอนนี้ (ฟังก์ชันนอกคอมโพเนนต์ เพราะอ่านเวลาปัจจุบัน) */
function pinState(
  startsAt: string | null,
  endsAt: string | null,
): "active" | "upcoming" | "expired" {
  const now = Date.now();
  if (startsAt && Date.parse(startsAt) > now) return "upcoming";
  if (endsAt && Date.parse(endsAt) <= now) return "expired";
  return "active";
}
const STATE_LABEL = { active: "ใช้งานอยู่", upcoming: "รอถึงเวลา", expired: "หมดเวลาแล้ว" };

export default async function PromotionsPage({
  searchParams,
}: PageProps<"/admin/home/promotions">) {
  const [{ db }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data, error } = await db
    .from("home_pins")
    .select("id, placement, position, starts_at, ends_at, note, titles(name, slug)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`อ่านรายการปักไม่สำเร็จ: ${error.message}`);
  const pins = data ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">โปรโมทเรื่อง</h1>
        <Link href="/admin/home" className={ghostBtn}>
          ← จัดหน้าแรก
        </Link>
      </div>
      <p className="text-muted max-w-2xl">
        ปักเรื่องให้ขึ้นแบนเนอร์ ดันขึ้นอันดับต้น หรือซ่อนจากหน้าแรก โดยตั้งช่วงเวลาได้ (หมดเวลาแล้วกลับเป็นปกติเอง
        ไม่ต้องมาลบ) เรื่องที่ซ่อนยังเปิดอ่านได้ตามปกติ
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
        action={addPin}
        className="border-border flex max-w-xl flex-col gap-4 rounded-2xl border p-5"
      >
        <h2 className="text-xl font-bold">ปักเรื่องใหม่</h2>
        <Field label="slug ของเรื่อง" htmlFor="pin-slug" hint="ดู slug ได้ในหน้าแก้ไขเรื่อง">
          <input id="pin-slug" name="slug" required autoCapitalize="none" className={inputCls} />
        </Field>
        <Field label="ทำอะไร" htmlFor="pin-placement">
          <select id="pin-placement" name="placement" className={inputCls}>
            {Object.entries(PLACEMENT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ลำดับ" htmlFor="pin-position" hint="เลขน้อยขึ้นก่อน (เมื่อปักหลายเรื่อง)">
          <input
            id="pin-position"
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={0}
            className={inputCls}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="เริ่ม (เวลาไทย)" htmlFor="pin-start" hint="เว้นว่าง = ทันที">
            <input id="pin-start" name="startsAt" type="datetime-local" className={inputCls} />
          </Field>
          <Field label="สิ้นสุด (เวลาไทย)" htmlFor="pin-end" hint="เว้นว่าง = ไม่มีวันหมด">
            <input id="pin-end" name="endsAt" type="datetime-local" className={inputCls} />
          </Field>
        </div>
        <Field label="บันทึกช่วยจำ" htmlFor="pin-note">
          <input id="pin-note" name="note" maxLength={300} className={inputCls} />
        </Field>
        <button type="submit" className={`${primaryBtn} self-start`}>
          ปักเรื่องนี้
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">รายการที่ปักไว้ ({pins.length})</h2>
        {pins.length === 0 && <p className="text-muted">ยังไม่มี</p>}
        <ul className="flex flex-col gap-3">
          {pins.map((p) => {
            const state = pinState(p.starts_at, p.ends_at);
            return (
              <li
                key={p.id}
                className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-2xl border p-4"
              >
                <span className="min-w-0 flex-1">
                  <strong>{p.titles?.name ?? "(เรื่องถูกลบ)"}</strong>
                  <span className="text-muted block text-sm">
                    {PLACEMENT_LABEL[p.placement]} · ลำดับ {p.position}
                    {p.starts_at && ` · เริ่ม ${isoToThaiLocal(p.starts_at).replace("T", " ")}`}
                    {p.ends_at && ` · ถึง ${isoToThaiLocal(p.ends_at).replace("T", " ")}`}
                    {p.note && ` · ${p.note}`}
                  </span>
                </span>
                <Badge kind={state === "active" ? "published" : undefined}>
                  {STATE_LABEL[state]}
                </Badge>
                <form action={deletePin}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className={dangerBtn}>
                    ยกเลิกการปัก
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
