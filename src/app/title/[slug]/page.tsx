import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentType } from "@/content-types/registry";
import {
  getTitle,
  listEpisodeLikeCounts,
  listEpisodes,
  listFollowerCounts,
} from "@/features/catalog/catalog";
import { coverColor } from "@/features/catalog/cover";
import { coverUrl } from "@/features/catalog/cover-url";
import { serializeJsonLd, titleJsonLd } from "@/features/catalog/json-ld";
import { publicEnv } from "@/lib/env";
import { STATUS_LABEL } from "@/features/catalog/title-card";
import { compactCount } from "@/features/catalog/sort";
import { weekdayLabel } from "@/features/catalog/schedule";
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
  const [episodes, followers, likes] = await Promise.all([
    listEpisodes(slug),
    listFollowerCounts(),
    listEpisodeLikeCounts(slug),
  ]);
  const followerCount = followers[slug] ?? 0;
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
            {title.rating !== "all" && ` · เรต ${title.rating}+`}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{title.name}</h1>
          {(title.updateDay !== null && title.status === "ongoing") || followerCount > 0 ? (
            <p className="mt-1 text-sm">
              {title.updateDay !== null && title.status === "ongoing" && (
                <span className="font-bold">อัปเดตทุกวัน{weekdayLabel(title.updateDay)}</span>
              )}
              {title.updateDay !== null && title.status === "ongoing" && followerCount > 0 && " · "}
              {followerCount > 0 && <span>ผู้ติดตาม {compactCount(followerCount)} คน</span>}
            </p>
          ) : null}
          <p className="mt-2">{title.synopsis}</p>
          {title.tags.length > 0 && (
            <p className="text-muted mt-2 text-sm">{title.tags.join(" · ")}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {episodes.length > 0 && (
              <ReadButton slug={slug} firstNumber={episodes[0].number} verb={def?.verb ?? "อ่าน"} />
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
              {likes[e.number] > 0 && (
                <span className="text-muted ml-3 text-sm">
                  ♥ ถูกใจ {compactCount(likes[e.number])}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
