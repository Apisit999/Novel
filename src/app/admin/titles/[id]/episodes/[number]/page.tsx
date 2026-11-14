import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEpisode } from "@/features/admin/actions";
import { EpisodeForm } from "@/features/admin/episode-form";
import { requireAdmin } from "@/features/admin/guard";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { dangerBtn } from "@/features/admin/ui";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditEpisodePage({
  params,
}: PageProps<"/admin/titles/[id]/episodes/[number]">) {
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
    .select("id, number, name, access, status, publish_at")
    .eq("title_id", id)
    .eq("number", n)
    .maybeSingle();
  if (!ep) notFound();

  const [body, translations] = await Promise.all([
    db.from("novel_bodies").select("body_markdown").eq("episode_id", ep.id).maybeSingle(),
    db.from("novel_translations").select("lang, body_markdown, machine").eq("episode_id", ep.id),
  ]);
  const tr = (lang: string) => translations.data?.find((t) => t.lang === lang);

  return (
    <section className="flex flex-col gap-10">
      <div>
        <p className="text-muted text-sm">
          <Link href={`/admin/titles/${id}`}>← {title.name}</Link>
        </p>
        <h1 className="mt-1 mb-6 text-2xl font-bold">
          แก้ไขตอนที่ {ep.number}: {ep.name}
        </h1>
        <EpisodeForm
          values={{
            titleId: id,
            episodeId: ep.id,
            number: ep.number,
            name: ep.name,
            access: ep.access,
            status: ep.status,
            publishAt: isoToThaiLocal(ep.publish_at),
            body: body.data?.body_markdown ?? "",
            en: tr("en")?.body_markdown ?? "",
            enMachine: tr("en")?.machine ?? false,
            zh: tr("zh")?.body_markdown ?? "",
            zhMachine: tr("zh")?.machine ?? true,
          }}
        />
      </div>

      <details className="border-border rounded-2xl border p-5">
        <summary className="cursor-pointer font-bold">ลบตอนนี้</summary>
        <p className="text-muted mt-3">ลบเนื้อหาและคำแปลของตอนนี้ถาวร กู้คืนไม่ได้</p>
        <form action={deleteEpisode} className="mt-4">
          <input type="hidden" name="titleId" value={id} />
          <input type="hidden" name="id" value={ep.id} />
          <button type="submit" className={dangerBtn}>
            ยืนยันลบตอนที่ {ep.number}
          </button>
        </form>
      </details>
    </section>
  );
}
