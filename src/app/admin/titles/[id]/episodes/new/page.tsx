import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeForm } from "@/features/admin/episode-form";
import { requireAdmin } from "@/features/admin/guard";
import { MangaEpisodeForm } from "@/features/admin/manga-episode-form";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function NewEpisodePage({
  params,
  searchParams,
}: PageProps<"/admin/titles/[id]/episodes/new">) {
  const [{ db }, { id }, query] = await Promise.all([requireAdmin(), params, searchParams]);
  // ค่าที่ถือมาจาก "บันทึกแล้วไปตอนถัดไป" (ตรวจค่าให้อยู่ในชุดที่อนุญาตเท่านั้น)
  const carryStatus =
    query.status === "published" || query.status === "draft" ? query.status : "draft";
  const carryAccess =
    query.access === "free" || query.access === "premium" || query.access === "inherit"
      ? query.access
      : "inherit";
  if (!UUID.test(id)) notFound();

  const { data: title } = await db
    .from("titles")
    .select("id, name, type")
    .eq("id", id)
    .maybeSingle();
  if (!title) notFound();
  const { data: last } = await db
    .from("episodes")
    .select("number")
    .eq("title_id", id)
    .order("number", { ascending: false })
    .limit(1);
  const next = (last?.[0]?.number ?? 0) + 1;

  return (
    <section>
      <p className="text-muted text-sm">
        <Link href={`/admin/titles/${id}`}>← {title.name}</Link>
      </p>
      <h1 className="mt-1 mb-6 text-2xl font-bold">เพิ่มตอนใหม่</h1>
      {query.saved && (
        <p role="status" className="border-border bg-surface mb-6 rounded-xl border p-3 font-bold">
          บันทึกตอนก่อนหน้าแล้ว — เพิ่มตอนถัดไปได้เลย
        </p>
      )}
      {title.type === "manga" || title.type === "video" ? (
        <MangaEpisodeForm
          kind={title.type}
          values={{
            titleId: id,
            number: next,
            name: `ตอนที่ ${next}`,
            access: carryAccess,
            status: carryStatus,
            publishAt: "",
          }}
        />
      ) : (
        <EpisodeForm
          values={{
            titleId: id,
            number: next,
            name: `ตอนที่ ${next}`,
            access: carryAccess,
            status: carryStatus,
            publishAt: "",
            body: "",
            en: "",
            enMachine: false,
            zh: "",
            zhMachine: true,
          }}
        />
      )}
    </section>
  );
}
