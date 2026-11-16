import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEpisode } from "@/features/admin/actions";
import { EpisodeForm } from "@/features/admin/episode-form";
import { requireAdmin } from "@/features/admin/guard";
import { MangaEpisodeForm } from "@/features/admin/manga-episode-form";
import { PagesManager } from "@/features/admin/pages-manager";
import { isoToThaiLocal } from "@/features/admin/schemas";
import { dangerBtn } from "@/features/admin/ui";
import { VideoManager } from "@/features/admin/video-manager";
import { signedReadUrls, VIDEO_BUCKET } from "@/server/storage";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditEpisodePage({
  params,
  searchParams,
}: PageProps<"/admin/titles/[id]/episodes/[number]">) {
  const [{ db }, { id, number }, query] = await Promise.all([requireAdmin(), params, searchParams]);
  const n = Number(number);
  if (!UUID.test(id) || !Number.isInteger(n)) notFound();

  const { data: title } = await db
    .from("titles")
    .select("id, name, type")
    .eq("id", id)
    .maybeSingle();
  if (!title) notFound();
  const { data: ep } = await db
    .from("episodes")
    .select("id, number, name, access, status, publish_at")
    .eq("title_id", id)
    .eq("number", n)
    .maybeSingle();
  if (!ep) notFound();

  const common = {
    titleId: id,
    episodeId: ep.id,
    number: ep.number,
    name: ep.name,
    access: ep.access,
    status: ep.status,
    publishAt: isoToThaiLocal(ep.publish_at),
  };

  let form: React.ReactNode;
  let extra: React.ReactNode = null;
  if (title.type === "video") {
    const asset = await db
      .from("video_assets")
      .select("stream_uid")
      .eq("episode_id", ep.id)
      .maybeSingle();
    const key = asset.data?.stream_uid;
    const playUrl = key ? (await signedReadUrls(db, [key], VIDEO_BUCKET)).get(key) : undefined;
    form = <MangaEpisodeForm values={common} kind="video" />;
    extra = <VideoManager episodeId={ep.id} playUrl={playUrl} />;
  } else if (title.type === "manga") {
    const pages = await db
      .from("manga_pages")
      .select("page_no, image_key")
      .eq("episode_id", ep.id)
      .order("page_no", { ascending: true });
    const urls = await signedReadUrls(
      db,
      (pages.data ?? []).map((p) => p.image_key),
    );
    form = <MangaEpisodeForm values={common} />;
    extra = (
      <PagesManager
        episodeId={ep.id}
        pages={(pages.data ?? []).flatMap((p) => {
          const url = urls.get(p.image_key);
          return url ? [{ pageNo: p.page_no, url }] : [];
        })}
      />
    );
  } else {
    const [body, translations] = await Promise.all([
      db.from("novel_bodies").select("body_markdown").eq("episode_id", ep.id).maybeSingle(),
      db.from("novel_translations").select("lang, body_markdown, machine").eq("episode_id", ep.id),
    ]);
    const tr = (lang: string) => translations.data?.find((t) => t.lang === lang);
    form = (
      <EpisodeForm
        values={{
          ...common,
          body: body.data?.body_markdown ?? "",
          en: tr("en")?.body_markdown ?? "",
          enMachine: tr("en")?.machine ?? false,
          zh: tr("zh")?.body_markdown ?? "",
          zhMachine: tr("zh")?.machine ?? true,
        }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-10">
      <div>
        <p className="text-muted text-sm">
          <Link href={`/admin/titles/${id}`}>← {title.name}</Link>
        </p>
        <h1 className="mt-1 mb-6 text-2xl font-bold">
          แก้ไขตอนที่ {ep.number}: {ep.name}
        </h1>
        {query.saved && (
          <p
            role="status"
            className="border-border bg-surface mb-6 rounded-xl border p-3 font-bold"
          >
            บันทึกแล้ว
          </p>
        )}
        {form}
      </div>

      {extra}

      <details className="border-border rounded-2xl border p-5">
        <summary className="cursor-pointer font-bold">ลบตอนนี้</summary>
        <p className="text-muted mt-3">
          ลบ
          {title.type === "manga"
            ? "รูปทุกหน้า"
            : title.type === "video"
              ? "ไฟล์วิดีโอ"
              : "เนื้อหาและคำแปล"}
          ของตอนนี้ถาวร กู้คืนไม่ได้
        </p>
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
