import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentType } from "@/content-types/registry";
import { getTitle, listEpisodes } from "@/features/catalog/catalog";
import { coverColor } from "@/features/catalog/cover";
import { coverUrl } from "@/features/catalog/cover-url";
import { serializeJsonLd, titleJsonLd } from "@/features/catalog/json-ld";
import { publicEnv } from "@/lib/env";
import { STATUS_LABEL } from "@/features/catalog/title-card";
import { FavoriteButton, ReadButton } from "@/features/library/library-actions";

export async function generateMetadata({ params }: PageProps<"/title/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const title = await getTitle(slug);
  if (!title) return {};
  const url = `/title/${slug}`;
  return {
    title: title.name,
    description: title.synopsis,
    alternates: { canonical: url },
    openGraph: {
      type: "book",
      title: title.name,
      description: title.synopsis,
      url,
      ...(coverUrl(title.coverKey) && { images: [{ url: coverUrl(title.coverKey)! }] }),
    },
  };
}

export default async function TitlePage({ params }: PageProps<"/title/[slug]">) {
  const { slug } = await params;
  const title = await getTitle(slug);
  if (!title) notFound();
  const def = getContentType(title.type);
  const episodes = await listEpisodes(slug);
  const image = coverUrl(title.coverKey);

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(titleJsonLd(title, publicEnv.NEXT_PUBLIC_SITE_URL)),
        }}
      />
      <div className="flex flex-col gap-6 sm:flex-row">
        <div
          className="relative aspect-[2/3] w-48 shrink-0 self-center rounded-xl sm:w-56 sm:self-start"
          style={{ background: coverColor(slug) }}
        >
          {image && (
            <Image
              src={image}
              alt={`ปก ${title.name}`}
              fill
              priority
              sizes="224px"
              className="rounded-xl object-cover"
            />
          )}
        </div>
        <div>
          <p className="text-muted text-sm font-bold">
            {def?.label} · {STATUS_LABEL[title.status]}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{title.name}</h1>
          <p className="mt-2">{title.synopsis}</p>
          {title.tags.length > 0 && (
            <p className="text-muted mt-2 text-sm">{title.tags.join(" · ")}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {(title.type === "novel" || title.type === "manga") && episodes.length > 0 && (
              <ReadButton slug={slug} firstNumber={episodes[0].number} />
            )}
            <FavoriteButton slug={slug} />
          </div>
        </div>
      </div>
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
