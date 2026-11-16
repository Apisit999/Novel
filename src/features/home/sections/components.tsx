import Link from "next/link";
import { getContentType } from "@/content-types/registry";
import { getCollection, type TitleType } from "@/features/catalog/catalog";
import { resolveSlugs, topTagRows } from "@/features/catalog/discovery";
import { TitleCard, TitleGrid, TitleRow } from "@/features/catalog/title-card";
import { TYPE_STYLE } from "@/features/catalog/type-style";
import { HeroSpotlight } from "../hero-spotlight";
import { spotlightOrder } from "../pins";
import { TopTen } from "../top-ten";
import type { SectionConfigs } from "./config";
import type { HomeContext } from "./context";

const h2 = "border-border border-b-2 pb-2 text-2xl font-bold sm:text-3xl";
const chip =
  "border-border bg-surface text-foreground flex min-h-12 items-center gap-2 rounded-full border-2 px-5 text-lg font-bold no-underline";

interface Props<K extends keyof SectionConfigs> {
  title: string;
  config: SectionConfigs[K];
  ctx: HomeContext;
}

export function SpotlightSection({ config, ctx }: Props<"spotlight">) {
  const base = config.mode === "manual" ? resolveSlugs(config.slugs, ctx.titles) : ctx.featuredBase;
  return <HeroSpotlight titles={spotlightOrder(base, ctx.titles, ctx.pins, config.limit)} />;
}

export function TopTenSection({ title, config, ctx }: Props<"top_ten">) {
  const ranked = config.source === "manual" ? resolveSlugs(config.slugs, ctx.titles) : ctx.ranking;
  const ofType = (type: TitleType) => ranked.filter((t) => t.type === type);
  return (
    <TopTen
      heading={title || undefined}
      movement={ctx.movement}
      lists={{
        all: ranked,
        novel: ofType("novel"),
        manga: ofType("manga"),
        video: ofType("video"),
      }}
    />
  );
}

export function TypeZoneSection({ title, config, ctx }: Props<"type_zone">) {
  const def = getContentType(config.type);
  if (!def) return null;
  const style = TYPE_STYLE[config.type];
  const hits = ctx.ranking.filter((t) => t.type === config.type);
  const rest = ctx.titles
    .filter((t) => t.type === config.type)
    .filter((t) => !hits.some((h) => h.slug === t.slug));
  const titles = [...hits, ...rest].slice(0, config.limit);
  const id = `zone-${config.type}`;

  return (
    <section
      id={id}
      aria-labelledby={`h-${id}`}
      className="border-border flex scroll-mt-4 flex-col gap-6 rounded-3xl border p-5 sm:p-8"
      style={{ background: style.tint, borderTop: `6px solid ${style.accent}` }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id={`h-${id}`}
          className="text-3xl font-bold sm:text-4xl"
          style={{ color: style.accent }}
        >
          {title || def.label}
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
            <TitleCard key={t.slug} title={t} showPremium={ctx.showPremium} showType={false} />
          ))}
        </TitleGrid>
      )}
    </section>
  );
}

export function LatestSection({ title, config, ctx }: Props<"latest">) {
  const titles = ctx.latest.slice(0, config.limit);
  if (titles.length === 0) return null;
  return (
    <section aria-labelledby="h-latest" className="flex flex-col gap-4">
      <h2 id="h-latest" className={h2}>
        {title || "อัปเดตล่าสุด"}
      </h2>
      <TitleRow titles={titles} showPremium={ctx.showPremium} />
    </section>
  );
}

export function TagChipsSection({ title, config, ctx }: Props<"tag_chips">) {
  const rows = topTagRows(ctx.titles, { maxRows: config.limit, minTitles: 2 });
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="h-tags" className="flex flex-col gap-4">
      <h2 id="h-tags" className={h2}>
        {title || "หมวดที่คนชอบ"}
      </h2>
      <div className="flex flex-wrap gap-3">
        {rows.map(({ tag, titles }) => (
          <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className={chip}>
            {tag}
            <span className="text-muted font-normal">{titles.length}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export async function CollectionSection({ title, config, ctx }: Props<"collection">) {
  const collection = await getCollection(config.slug);
  if (!collection) return null;
  const visible = new Set(ctx.titles.map((t) => t.slug));
  const titles = collection.titles.filter((t) => visible.has(t.slug)).slice(0, config.limit);
  if (titles.length === 0) return null;
  const id = `zone-c-${config.slug}`;
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="flex scroll-mt-4 flex-col gap-4">
      <div>
        <h2 id={`h-${id}`} className={h2}>
          {title || collection.title}
        </h2>
        {collection.description && <p className="text-muted mt-2">{collection.description}</p>}
      </div>
      <TitleRow titles={titles} showPremium={ctx.showPremium} />
    </section>
  );
}

export function BannerSection({ config }: Props<"banner">) {
  const external = config.href.startsWith("https://");
  return (
    <section
      aria-label="ประกาศ"
      className="flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-6"
      style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
    >
      <p className="text-xl font-bold">{config.text}</p>
      {config.label && (
        <Link
          href={config.href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="bg-surface text-foreground flex min-h-12 items-center rounded-full px-6 font-bold no-underline"
        >
          {config.label}
        </Link>
      )}
    </section>
  );
}
