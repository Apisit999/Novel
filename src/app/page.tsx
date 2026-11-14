import Link from "next/link";
import { SITE } from "@/lib/site";
import { CONTENT_TYPES } from "@/content-types/registry";
import { SearchForm } from "@/components/search-form";
import { getFeatured, listTitles } from "@/features/catalog/catalog";
import { coverColor } from "@/features/catalog/cover";
import { STATUS_LABEL, TitleCard, TitleGrid } from "@/features/catalog/title-card";

export default async function HomePage() {
  const [featured, sections] = await Promise.all([
    getFeatured(),
    Promise.all(
      CONTENT_TYPES.map(async (t) => ({ def: t, titles: (await listTitles(t.id)).slice(0, 5) })),
    ),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">{SITE.name}</h1>
      <SearchForm />

      {featured && (
        <section
          aria-label="เรื่องเด่น"
          className="bg-surface border-border flex flex-col items-center gap-6 rounded-3xl border p-5 sm:flex-row sm:gap-9 sm:p-8"
        >
          <div
            className="aspect-[2/3] w-44 shrink-0 rounded-2xl sm:w-60"
            style={{ background: coverColor(featured.slug) }}
          />
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <span className="text-accent font-bold">เรื่องเด่น</span>
            <h2 className="text-3xl leading-tight font-bold sm:text-4xl">{featured.name}</h2>
            <p className="text-muted max-w-xl">{featured.synopsis}</p>
            <p className="text-muted text-sm">
              {STATUS_LABEL[featured.status]}
              {featured.tags.length > 0 && ` · ${featured.tags.join(" · ")}`}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Link
                href={`/title/${featured.slug}`}
                className="bg-accent text-accent-foreground flex min-h-12 items-center rounded-full px-8 font-bold no-underline"
              >
                เริ่มอ่าน
              </Link>
              <Link
                href="/library"
                className="border-accent text-accent flex min-h-12 items-center rounded-full border-2 px-6 font-bold no-underline"
              >
                เพิ่มในเรื่องที่ชอบ
              </Link>
            </div>
          </div>
        </section>
      )}

      {sections.map(({ def, titles }) => (
        <section key={def.id} aria-labelledby={`sec-${def.id}`} className="flex flex-col gap-4">
          <div className="border-border flex items-baseline justify-between border-b-2 pb-2">
            <h2 id={`sec-${def.id}`} className="text-2xl font-bold sm:text-3xl">
              {def.label}
            </h2>
            <Link href={`/browse/${def.id}`} className="text-accent font-bold no-underline">
              ดูทั้งหมด
            </Link>
          </div>
          {titles.length === 0 ? (
            <p className="text-muted">ยังไม่มี{def.label}</p>
          ) : (
            <TitleGrid>
              {titles.map((t) => (
                <TitleCard key={t.slug} title={t} />
              ))}
            </TitleGrid>
          )}
        </section>
      ))}
    </div>
  );
}
