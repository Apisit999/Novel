import Link from "next/link";
import { SITE } from "@/lib/site";
import { CONTENT_TYPES } from "@/content-types/registry";
import { SearchForm } from "@/components/search-form";
import {
  listAllTitles,
  listFeatured,
  listLatestUpdated,
  listPopular,
  type TitleSummary,
  type TitleType,
} from "@/features/catalog/catalog";
import { topTagRows } from "@/features/catalog/discovery";
import { TitleCard, TitleGrid, TitleRow } from "@/features/catalog/title-card";
import { TYPE_STYLE } from "@/features/catalog/type-style";
import { isPaywallEnabled } from "@/features/access/paywall";
import { HeroSpotlight } from "@/features/home/hero-spotlight";
import { TopTen } from "@/features/home/top-ten";
import { ContinueStrip } from "@/features/library/library-view";

const ZONE_SIZE = 6;

export default async function HomePage() {
  const showPremium = await isPaywallEnabled();
  const [featured, allTitles, latest, popular] = await Promise.all([
    listFeatured(3),
    listAllTitles(),
    listLatestUpdated(12),
    listPopular(60),
  ]);

  // ยังไม่มียอดเข้าชม (เว็บใหม่) → ใช้เรื่องที่อัปเดตล่าสุดแทน อันดับจะไม่ว่าง
  const ranking = popular.length > 0 ? popular : latest;
  const ofType = (list: TitleSummary[], type: TitleType) => list.filter((t) => t.type === type);
  const topLists = {
    all: ranking,
    novel: ofType(ranking, "novel"),
    manga: ofType(ranking, "manga"),
    video: ofType(ranking, "video"),
  };

  const zones = CONTENT_TYPES.map((def) => {
    const hits = ofType(ranking, def.id);
    const rest = ofType(allTitles, def.id).filter((t) => !hits.some((h) => h.slug === t.slug));
    return { def, titles: [...hits, ...rest].slice(0, ZONE_SIZE) };
  });
  const tagRows = topTagRows(allTitles, { maxRows: 8, minTitles: 2 });

  return (
    <div className="flex flex-col gap-14">
      <h1 className="sr-only">{SITE.name}</h1>

      <div className="flex flex-col gap-4">
        <SearchForm />
        <nav aria-label="ไปที่โซน" className="flex flex-wrap gap-2">
          <a href="#zone-top" className={chip}>
            ยอดฮิต
          </a>
          {CONTENT_TYPES.map((def) => (
            <a
              key={def.id}
              href={`#zone-${def.id}`}
              aria-label={`เลื่อนไปโซน${def.label}`}
              className={chip}
            >
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full"
                style={{ background: TYPE_STYLE[def.id].accent }}
              />
              {def.label}
            </a>
          ))}
        </nav>
      </div>

      <HeroSpotlight titles={featured} />
      <ContinueStrip titles={allTitles} />
      <TopTen lists={topLists} />

      {zones.map(({ def, titles }) => {
        const style = TYPE_STYLE[def.id];
        return (
          <section
            key={def.id}
            id={`zone-${def.id}`}
            aria-labelledby={`h-${def.id}`}
            className="border-border flex scroll-mt-4 flex-col gap-6 rounded-3xl border p-5 sm:p-8"
            style={{ background: style.tint, borderTop: `6px solid ${style.accent}` }}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2
                id={`h-${def.id}`}
                className="text-3xl font-bold sm:text-4xl"
                style={{ color: style.accent }}
              >
                {def.label}
              </h2>
              <Link
                href={`/browse/${def.id}`}
                className="flex min-h-12 items-center rounded-full px-6 font-bold no-underline"
                style={{ background: style.accent, color: style.fg }}
              >
                ดู{def.label}ทั้งหมด
              </Link>
            </div>
            {titles.length === 0 ? (
              <p className="text-muted">ยังไม่มี{def.label} — กลับมาดูใหม่เร็ว ๆ นี้</p>
            ) : (
              <TitleGrid>
                {titles.map((t) => (
                  <TitleCard key={t.slug} title={t} showPremium={showPremium} showType={false} />
                ))}
              </TitleGrid>
            )}
          </section>
        );
      })}

      {latest.length > 0 && (
        <section aria-labelledby="h-latest" className="flex flex-col gap-4">
          <h2
            id="h-latest"
            className="border-border border-b-2 pb-2 text-2xl font-bold sm:text-3xl"
          >
            อัปเดตล่าสุด
          </h2>
          <TitleRow titles={latest} showPremium={showPremium} />
        </section>
      )}

      {tagRows.length > 0 && (
        <section aria-labelledby="h-tags" className="flex flex-col gap-4">
          <h2 id="h-tags" className="border-border border-b-2 pb-2 text-2xl font-bold sm:text-3xl">
            หมวดที่คนชอบ
          </h2>
          <div className="flex flex-wrap gap-3">
            {tagRows.map(({ tag, titles }) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className={`${chip} text-lg`}
              >
                {tag}
                <span className="text-muted font-normal">{titles.length}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const chip =
  "border-border bg-surface text-foreground flex min-h-12 items-center gap-2 rounded-full border-2 px-5 font-bold no-underline";
