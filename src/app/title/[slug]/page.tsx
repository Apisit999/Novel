import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentType } from "@/content-types/registry";
import { getTitle, listEpisodes } from "@/features/catalog/catalog";

export default async function TitlePage({ params }: PageProps<"/title/[slug]">) {
  const { slug } = await params;
  const title = await getTitle(slug);
  if (!title) notFound();
  const def = getContentType(title.type);
  const episodes = await listEpisodes(slug);

  return (
    <section>
      <h1 className="text-2xl font-bold">{title.name}</h1>
      <p className="mt-2">{title.synopsis}</p>
      {title.tags.length > 0 && <p className="text-muted mt-2 text-sm">{title.tags.join(" · ")}</p>}
      <h2 className="mt-6 text-xl font-semibold">สารบัญ</h2>
      {episodes.length === 0 ? (
        <p className="text-muted mt-2">ยังไม่มี{def?.episodeNoun}</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {episodes.map((e) => (
            <li key={e.number}>
              <Link href={`/read/${slug}/${e.number}`} className="text-accent">
                {e.name}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
