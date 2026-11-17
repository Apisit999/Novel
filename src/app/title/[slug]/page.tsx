import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentType } from "@/content-types/registry";
import {
  getTitle,
  listAllTitles,
  type EpisodeSummary,
  listEpisodeLikeCounts,
  listEpisodes,
  listFollowerCounts,
} from "@/features/catalog/catalog";
import { coverColor } from "@/features/catalog/cover";
import { coverUrl } from "@/features/catalog/cover-url";
import { serializeJsonLd, titleJsonLd } from "@/features/catalog/json-ld";
import { publicEnv } from "@/lib/env";
import { STATUS_LABEL, TitleCard, TitleGrid } from "@/features/catalog/title-card";
import { compactCount } from "@/features/catalog/sort";
import { isRecent, thaiShortDate, weekdayLabel } from "@/features/catalog/schedule";
import { FavoriteButton, ReadButton } from "@/features/library/library-actions";
import { isPaywallEnabled } from "@/features/access/paywall";
import { Pagination } from "@/components/pagination";
import { paginate, parsePage } from "@/lib/paginate";
import { ShareLinks } from "@/features/catalog/share-links";

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

const TOC_PER_PAGE = 100;

/** สารบัญแบ่งหน้า (นิยายหลายร้อยตอน): ?page=N — อ่าน searchParams ในส่วนนี้เท่านั้นเพื่อให้ตัวหน้าหลักยังพรีเรนเดอร์ได้ */
async function EpisodeToc({
  slug,
  episodes,
  likes,
  searchParams,
}: {
  slug: string;
  episodes: EpisodeSummary[];
  likes: Record<number, number>;
  searchParams: PageProps<"/title/[slug]">["searchParams"];
}) {
  const pg = paginate(episodes.length, parsePage((await searchParams).page), TOC_PER_PAGE);
  const now = new Date().getTime(); // เซิร์ฟเวอร์เรนเดอร์ตามคำขอ (หน้านี้ไม่ได้แคชทั้งหน้า) จึงใช้เวลาปัจจุบันได้
  return (
    <>
      <ol className="mt-2 space-y-1">
        {episodes.slice(pg.start, pg.end).map((e) => (
          <li key={e.number}>
            <Link href={`/read/${slug}/${e.number}`} className="text-accent">
              {e.name}
            </Link>
            {isRecent(e.publishedAt, now) && (
              <span className="bg-accent text-accent-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-bold">
                ใหม่
              </span>
            )}
            {e.publishedAt && (
              <span className="text-muted ml-3 text-sm">{thaiShortDate(e.publishedAt)}</span>
            )}
            {likes[e.number] > 0 && (
              <span className="text-muted ml-3 text-sm">
                ♥ ถูกใจ {compactCount(likes[e.number])}
              </span>
            )}
          </li>
        ))}
      </ol>
      <Pagination
        page={pg.page}
        totalPages={pg.totalPages}
        label="แบ่งหน้าสารบัญ"
        href={(n) => (n > 1 ? `/title/${slug}?page=${n}` : `/title/${slug}`)}
      />
    </>
  );
}

export default async function TitlePage({ params, searchParams }: PageProps<"/title/[slug]">) {
  const { slug } = await params;
  const title = await getTitle(slug);
  if (!title) notFound();
  const def = getContentType(title.type);
  const [episodes, followers, likes, allTitles, showPremium] = await Promise.all([
    listEpisodes(slug),
    listFollowerCounts(),
    listEpisodeLikeCounts(slug),
    title.author ? listAllTitles() : Promise.resolve([]),
    isPaywallEnabled(),
  ]);
  // ผลงานอื่นของผู้สร้างคนเดียวกัน (สูงสุด 6 เรื่อง) — เหมือนส่วน "ผลงานอื่นของครีเอเตอร์" ของ WEBTOON
  const moreByAuthor = allTitles
    .filter((t) => t.author === title.author && t.slug !== slug)
    .slice(0, 6);
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
          {title.author && (
            <p className="mt-1">
              โดย{" "}
              <Link
                href={`/author/${encodeURIComponent(title.author)}`}
                className="text-accent font-bold"
              >
                {title.author}
              </Link>
            </p>
          )}
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
            {episodes.length > 1 && (
              <Link
                href={`/read/${slug}/${episodes[episodes.length - 1].number}`}
                className="border-border bg-surface text-foreground flex min-h-12 items-center rounded-full border px-6 font-bold no-underline"
              >
                ไปตอนล่าสุด
              </Link>
            )}
          </div>
          <ShareLinks
            url={`${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/title/${slug}`}
            text={title.name}
          />
        </div>
      </div>
      <h2 className="mt-6 text-xl font-semibold">
        สารบัญ{episodes.length > 0 && ` (${episodes.length} ${def?.episodeNoun ?? "ตอน"})`}
      </h2>
      {episodes.length === 0 ? (
        <p className="text-muted mt-2">ยังไม่มี{def?.episodeNoun}</p>
      ) : (
        <Suspense fallback={<p className="text-muted mt-2">กำลังโหลดสารบัญ…</p>}>
          <EpisodeToc slug={slug} episodes={episodes} likes={likes} searchParams={searchParams} />
        </Suspense>
      )}
      {moreByAuthor.length > 0 && title.author && (
        <>
          <h2 className="mt-10 text-xl font-semibold">
            ผลงานอื่นของ{" "}
            <Link href={`/author/${encodeURIComponent(title.author)}`} className="text-accent">
              {title.author}
            </Link>
          </h2>
          <div className="mt-4">
            <TitleGrid>
              {moreByAuthor.map((t) => (
                <TitleCard key={t.slug} title={t} showPremium={showPremium} />
              ))}
            </TitleGrid>
          </div>
        </>
      )}
    </section>
  );
}
