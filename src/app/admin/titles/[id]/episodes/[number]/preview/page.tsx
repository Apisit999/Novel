import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/admin/guard";
import { Badge } from "@/features/admin/ui";
import { Markdown } from "@/features/reader/markdown";

const UUID = /^[0-9a-f-]{36}$/i;

export const metadata = { title: "ตัวอย่างตอน", robots: { index: false, follow: false } };

/**
 * ดูตอนนิยาย "ในรูปแบบที่ผู้อ่านเห็นจริง" (ตัวอักษร/ระยะบรรทัด/ธีมเดียวกับตัวอ่าน) รวมถึงตอนที่ยังเป็นฉบับร่าง
 * ไม่นับยอดอ่าน ไม่บันทึกความคืบหน้า — ใช้ตรวจตอนก่อนเผยแพร่ และเปิดไล่อ่านตอนก่อน/ถัดไปได้
 */
export default async function PreviewEpisodePage({
  params,
}: PageProps<"/admin/titles/[id]/episodes/[number]/preview">) {
  const [{ db }, { id, number }] = await Promise.all([requireAdmin(), params]);
  const n = Number(number);
  if (!UUID.test(id) || !Number.isInteger(n)) notFound();

  const { data: title } = await db
    .from("titles")
    .select("id, name, type")
    .eq("id", id)
    .maybeSingle();
  if (!title || title.type !== "novel") notFound();
  const { data: ep } = await db
    .from("episodes")
    .select("id, number, name, status")
    .eq("title_id", id)
    .eq("number", n)
    .maybeSingle();
  if (!ep) notFound();
  const [body, siblings] = await Promise.all([
    db
      .from("novel_bodies")
      .select("body_markdown, word_count")
      .eq("episode_id", ep.id)
      .maybeSingle(),
    db.from("episodes").select("number").eq("title_id", id).order("number", { ascending: true }),
  ]);
  const nums = (siblings.data ?? []).map((e) => e.number);
  const at = nums.indexOf(ep.number);
  const prev = at > 0 ? nums[at - 1] : undefined;
  const next = at >= 0 && at < nums.length - 1 ? nums[at + 1] : undefined;
  const text = body.data?.body_markdown ?? "";

  const nav = (
    <nav aria-label="ไปตอนอื่น" className="mx-auto flex max-w-[38rem] justify-between gap-3">
      {prev !== undefined ? (
        <Link
          href={`/admin/titles/${id}/episodes/${prev}/preview`}
          className="text-accent font-bold"
        >
          ← ตอนที่ {prev}
        </Link>
      ) : (
        <span />
      )}
      {next !== undefined ? (
        <Link
          href={`/admin/titles/${id}/episodes/${next}/preview`}
          className="text-accent font-bold"
        >
          ตอนที่ {next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <article>
      <div
        role="note"
        className="border-border bg-surface mx-auto mb-6 flex max-w-[38rem] flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
      >
        <Badge kind={ep.status} />
        <span>ตัวอย่างสำหรับแอดมิน — ผู้อ่านเห็นเมื่อเผยแพร่เท่านั้น</span>
        <Link
          href={`/admin/titles/${id}/episodes/${ep.number}`}
          className="text-accent ml-auto font-bold"
        >
          กลับไปแก้ไข
        </Link>
      </div>
      <p className="text-muted mx-auto max-w-[38rem] text-sm">{title.name}</p>
      <h1 className="mx-auto max-w-[38rem] text-2xl font-bold">{ep.name}</h1>
      <div
        lang="th"
        className="mx-auto mt-6 max-w-[38rem] space-y-[1.2em]"
        style={{ fontSize: "var(--read-size)", fontFamily: "var(--font-reading)", lineHeight: 2 }}
      >
        {text.trim() ? <Markdown source={text} /> : <p className="text-muted">ตอนนี้ยังไม่มีเนื้อหา</p>}
      </div>
      <p className="text-muted mx-auto mt-6 max-w-[38rem] text-sm">
        {text.length.toLocaleString("th-TH")} ตัวอักษร
        {body.data ? ` · ${body.data.word_count.toLocaleString("th-TH")} คำ` : ""}
      </p>
      <div className="mt-8">{nav}</div>
    </article>
  );
}
