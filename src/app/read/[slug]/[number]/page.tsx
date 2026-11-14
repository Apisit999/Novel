import Link from "next/link";
import { notFound } from "next/navigation";
import { canAccess } from "@/features/access/can-access";
import { getNovelEpisode, getTitle, listEpisodes } from "@/features/catalog/catalog";
import { getFlags } from "@/lib/flags";

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

  const prev = episodes.find((e) => e.number === n - 1);
  const next = episodes.find((e) => e.number === n + 1);

  let body: React.ReactNode;
  if (decision.allowed) {
    const ep = await getNovelEpisode(slug, n);
    body = <p className="mt-4 leading-8 whitespace-pre-wrap">{ep?.bodyMarkdown}</p>;
  } else {
    // paywall: ไม่ส่งเนื้อหาไปเบราว์เซอร์
    body = <p className="mt-4">ตอนนี้สำหรับสมาชิกเท่านั้น</p>;
  }

  return (
    <article>
      <p className="text-muted text-sm">
        <Link href={`/title/${slug}`}>{title.name}</Link>
      </p>
      <h1 className="text-2xl font-bold">{meta.name}</h1>
      {body}
      <nav className="mt-8 flex justify-between">
        {prev ? <Link href={`/read/${slug}/${prev.number}`}>← ก่อนหน้า</Link> : <span />}
        {next ? <Link href={`/read/${slug}/${next.number}`}>ถัดไป →</Link> : <span />}
      </nav>
    </article>
  );
}
