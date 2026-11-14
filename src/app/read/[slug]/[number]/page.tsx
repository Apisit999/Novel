import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccess, effectiveAccess } from "@/features/access/can-access";
import { getNovelEpisode, getTitle, listEpisodes } from "@/features/catalog/catalog";
import { NovelReader, type ReaderBody, type ReaderLang } from "@/features/reader/novel-reader";
import { getFlags } from "@/lib/flags";

export async function generateMetadata({
  params,
}: PageProps<"/read/[slug]/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const title = await getTitle(slug);
  const meta = (await listEpisodes(slug)).find((e) => e.number === Number(number));
  if (!title || !meta) return {};
  const free = effectiveAccess(title.access, meta.access) === "free";
  const url = `/read/${slug}/${number}`;
  return {
    title: `${meta.name} — ${title.name}`,
    description: title.synopsis,
    alternates: { canonical: url },
    // ตอน premium ไม่ให้ค้นหาเจอ (เนื้อหาไม่ได้เปิดสาธารณะ)
    robots: free ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title: `${meta.name} — ${title.name}`, url },
  };
}

export default async function ReadPage({ params }: PageProps<"/read/[slug]/[number]">) {
  const { slug, number } = await params;
  const n = Number(number);
  const title = await getTitle(slug);
  if (!title || title.type !== "novel" || !Number.isInteger(n)) notFound();

  const episodes = await listEpisodes(slug);
  const meta = episodes.find((e) => e.number === n);
  if (!meta) notFound();

  const decision = canAccess({
    titleAccess: title.access,
    episodeAccess: meta.access,
    user: null, // เฟส 2 จะดึงผู้ใช้จริง
    paywallEnabled: getFlags().paywallEnabled,
  });

  if (!decision.allowed) {
    // paywall: ไม่ส่งเนื้อหาไปเบราว์เซอร์
    return (
      <article>
        <p className="text-muted text-sm">
          <Link href={`/title/${slug}`}>{title.name}</Link>
        </p>
        <h1 className="text-2xl font-bold">{meta.name}</h1>
        <p className="mt-4">ตอนนี้สำหรับสมาชิกเท่านั้น</p>
      </article>
    );
  }

  const ep = await getNovelEpisode(slug, n);
  if (!ep) notFound();
  const bodies: Partial<Record<ReaderLang, ReaderBody>> = {
    th: { text: ep.bodyMarkdown, machine: false },
  };
  for (const [lang, t] of Object.entries(ep.translations)) {
    bodies[lang as ReaderLang] = { text: t.bodyMarkdown, machine: t.machine };
  }

  const prev = episodes.find((e) => e.number === n - 1);
  const next = episodes.find((e) => e.number === n + 1);

  return (
    <NovelReader
      slug={slug}
      number={n}
      titleName={title.name}
      titleHref={`/title/${slug}`}
      episodeName={meta.name}
      bodies={bodies}
      prevHref={prev && `/read/${slug}/${prev.number}`}
      nextHref={next && `/read/${slug}/${next.number}`}
    />
  );
}
