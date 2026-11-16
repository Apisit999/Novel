"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { moveEpisode } from "./actions";
import { bulkUpdateEpisodes, type BulkOp } from "./bulk-actions";
import { Badge, dangerBtn, inputCls } from "./ui";

export interface EpisodeRow {
  id: string;
  number: number;
  name: string;
  status: "draft" | "scheduled" | "published";
  access: "inherit" | "free" | "premium";
  /** "YYYY-MM-DD HH:mm" เวลาไทย (ว่างถ้าไม่ได้ตั้งเวลา) */
  publishAt: string;
}

const PAGE_SIZE = 50;
const STATUS_FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "draft", label: "ฉบับร่าง" },
  { id: "scheduled", label: "ตั้งเวลา" },
  { id: "published", label: "เผยแพร่แล้ว" },
] as const;

const chip = "border-border min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold";
const th = (n: number) => n.toLocaleString("th-TH");

/**
 * รายการตอนของเรื่อง รองรับหลายร้อยตอน: ค้นหา/กรองสถานะ/แบ่งหน้า, เลือกหลายตอน (รวมเลือกตามช่วงเลขตอน)
 * แล้วเผยแพร่ ซ่อน ตั้งเวลาทยอยลง เปลี่ยนสิทธิ์ หรือลบพร้อมกัน
 */
export function EpisodeList({ titleId, episodes }: { titleId: string; episodes: EpisodeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [range, setRange] = useState({ from: "", to: "" });
  const [panel, setPanel] = useState<"" | "schedule" | "access">("");
  const [schedule, setSchedule] = useState({ startDate: "", time: "18:00", perDay: 1 });
  const [access, setAccess] = useState<"inherit" | "free" | "premium">("free");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return episodes.filter(
      (e) =>
        (filter === "all" || e.status === filter) &&
        (!q || e.name.toLowerCase().includes(q) || String(e.number) === q),
    );
  }, [episodes, filter, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const filtering = filter !== "all" || query.trim() !== "";

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function selectRange() {
    const from = Number(range.from);
    const to = Number(range.to || range.from);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      setMessage({ ok: false, text: "ช่วงเลขตอนไม่ถูกต้อง" });
      return;
    }
    const ids = episodes.filter((e) => e.number >= from && e.number <= to).map((e) => e.id);
    setSelected((s) => new Set([...s, ...ids]));
    setMessage({ ok: true, text: `เลือกตอน ${from}–${to} เพิ่ม ${th(ids.length)} ตอน` });
  }

  function run(op: BulkOp, label: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      const res = await bulkUpdateEpisodes({ titleId, ids, op });
      if (res.error) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: `${label} ${th(res.done)} ตอนแล้ว` });
      setSelected(new Set());
      setPanel("");
      router.refresh();
    });
  }

  const n = selected.size;
  const scheduleReady = schedule.startDate !== "" && /^\d{2}:\d{2}$/.test(schedule.time);

  return (
    <div className="flex flex-col gap-4">
      {/* ค้นหา + กรอง */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="ค้นหาชื่อตอนหรือเลขตอน"
          aria-label="ค้นหาตอน"
          className={`${inputCls} max-w-xs`}
        />
        <div role="group" aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(0);
              }}
              className={`${chip} ${filter === f.id ? "bg-accent text-accent-foreground border-accent" : "bg-surface"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* เลือก */}
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          className={`${chip} bg-surface`}
          onClick={() => setSelected(new Set(filtered.map((e) => e.id)))}
        >
          เลือกทั้งหมดที่แสดง ({th(filtered.length)})
        </button>
        <button
          type="button"
          className={`${chip} bg-surface`}
          onClick={() => setSelected(new Set())}
        >
          ล้างที่เลือก
        </button>
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-sm">
            <span className="text-muted">เลือกตอนที่</span>
            <input
              type="number"
              min={1}
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              aria-label="เลือกจากเลขตอน"
              className={`${inputCls} w-24`}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-muted">ถึง</span>
            <input
              type="number"
              min={1}
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              aria-label="เลือกถึงเลขตอน"
              className={`${inputCls} w-24`}
            />
          </label>
          <button type="button" className={`${chip} bg-surface`} onClick={selectRange}>
            เลือกช่วงนี้
          </button>
        </div>
      </div>

      {/* แถบคำสั่งหลายตอน */}
      {n > 0 && (
        <div
          role="region"
          aria-label="จัดการตอนที่เลือก"
          className="border-accent bg-surface sticky top-2 z-10 flex flex-col gap-3 rounded-2xl border-2 p-4"
        >
          <p className="font-bold" role="status">
            เลือกแล้ว {th(n)} ตอน
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className={`${chip} bg-accent text-accent-foreground border-accent`}
              onClick={() => run({ kind: "status", status: "published" }, "เผยแพร่")}
            >
              เผยแพร่ทันที
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${chip} bg-surface`}
              onClick={() => run({ kind: "status", status: "draft" }, "เปลี่ยนเป็นฉบับร่าง")}
            >
              ซ่อน (ฉบับร่าง)
            </button>
            <button
              type="button"
              aria-expanded={panel === "schedule"}
              className={`${chip} ${panel === "schedule" ? "border-accent" : ""} bg-surface`}
              onClick={() => setPanel(panel === "schedule" ? "" : "schedule")}
            >
              ตั้งเวลาทยอยลง…
            </button>
            <button
              type="button"
              aria-expanded={panel === "access"}
              className={`${chip} ${panel === "access" ? "border-accent" : ""} bg-surface`}
              onClick={() => setPanel(panel === "access" ? "" : "access")}
            >
              เปลี่ยนสิทธิ์การอ่าน…
            </button>
            <button
              type="button"
              disabled={pending}
              className={dangerBtn}
              onClick={() => {
                if (window.confirm(`ลบ ${th(n)} ตอนที่เลือกถาวร? กู้คืนไม่ได้`))
                  run({ kind: "delete" }, "ลบ");
              }}
            >
              ลบที่เลือก
            </button>
          </div>

          {panel === "schedule" && (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="flex flex-col text-sm">
                <span className="font-bold">วันที่ลงตอนแรก</span>
                <input
                  type="date"
                  value={schedule.startDate}
                  onChange={(e) => setSchedule((s) => ({ ...s, startDate: e.target.value }))}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-bold">เวลา (เวลาไทย)</span>
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule((s) => ({ ...s, time: e.target.value }))}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="font-bold">ลงวันละกี่ตอน</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={schedule.perDay}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, perDay: Number(e.target.value) || 1 }))
                  }
                  className={inputCls}
                />
              </label>
              <button
                type="button"
                disabled={pending || !scheduleReady}
                className={`${chip} bg-accent text-accent-foreground border-accent self-end`}
                onClick={() => run({ kind: "schedule", ...schedule }, "ตั้งเวลาเผยแพร่")}
              >
                ตั้งเวลา {th(n)} ตอน
              </button>
              <p className="text-muted text-sm sm:col-span-4">เรียงตามเลขตอนจากน้อยไปมาก</p>
            </div>
          )}
          {panel === "access" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-sm">
                <span className="font-bold">สิทธิ์การอ่าน</span>
                <select
                  value={access}
                  onChange={(e) => setAccess(e.target.value as typeof access)}
                  className={inputCls}
                >
                  <option value="inherit">ตามเรื่อง</option>
                  <option value="free">ฟรี</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <button
                type="button"
                disabled={pending}
                className={`${chip} bg-accent text-accent-foreground border-accent`}
                onClick={() => run({ kind: "access", access }, "เปลี่ยนสิทธิ์")}
              >
                ใช้กับ {th(n)} ตอน
              </button>
            </div>
          )}
        </div>
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-xl border p-3 font-bold ${message.ok ? "border-border bg-surface" : "border-accent text-accent"}`}
        >
          {message.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted">ไม่พบตอนที่ตรงเงื่อนไข</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="รายการตอน">
          {visible.map((e) => (
            <li
              key={e.id}
              className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-2xl border p-3"
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
                aria-label={`เลือกตอน ${e.number}`}
                className="h-6 w-6 shrink-0"
              />
              <Link
                href={`/admin/titles/${titleId}/episodes/${e.number}`}
                className="text-foreground min-w-0 flex-1 font-bold no-underline"
              >
                {e.number}. {e.name}
              </Link>
              {!filtering && (
                <div className="flex gap-2">
                  {(["up", "down"] as const).map((dir) => {
                    const idx = episodes.indexOf(e);
                    const disabled = dir === "up" ? idx === 0 : idx === episodes.length - 1;
                    return (
                      <form key={dir} action={moveEpisode}>
                        <input type="hidden" name="titleId" value={titleId} />
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button
                          type="submit"
                          disabled={disabled}
                          aria-label={`เลื่อนตอน ${e.number} ${dir === "up" ? "ขึ้น" : "ลง"}`}
                          className="border-border bg-surface min-h-10 min-w-10 cursor-pointer rounded-full border font-bold disabled:cursor-default disabled:opacity-30"
                        >
                          {dir === "up" ? "↑" : "↓"}
                        </button>
                      </form>
                    );
                  })}
                </div>
              )}
              <Badge kind={e.status} />
              {e.status === "scheduled" && e.publishAt && (
                <span className="text-muted text-sm">{e.publishAt} น.</span>
              )}
              {e.access !== "inherit" && <Badge>{e.access === "premium" ? "Premium" : "ฟรี"}</Badge>}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="เปลี่ยนหน้ารายการตอน" className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className={`${chip} bg-surface disabled:opacity-40`}
          >
            ← ก่อนหน้า
          </button>
          <span aria-live="polite">
            หน้า {safePage + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage(safePage + 1)}
            className={`${chip} bg-surface disabled:opacity-40`}
          >
            ถัดไป →
          </button>
        </nav>
      )}
    </div>
  );
}
