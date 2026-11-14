import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTENT_TYPES, getContentType } from "@/content-types/registry";
import { listTitles } from "@/features/catalog/catalog";

export function generateStaticParams() {
  return CONTENT_TYPES.map((t) => ({ type: t.id }));
}

export default async function BrowsePage({ params }: PageProps<"/browse/[type]">) {
  const { type } = await params;
  const def = getContentType(type);
  if (!def) notFound();

  const titles = await listTitles(def.id);

  return (
    <section>
      <h1 className="text-2xl font-bold">{def.label}</h1>
      {titles.length === 0 ? (
        <p className="text-muted mt-2">ยังไม่มี{def.label}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {titles.map((t) => (
            <li key={t.slug}>
              <Link href={`/title/${t.slug}`} className="text-accent font-semibold">
                {t.name}
              </Link>
              <p className="text-muted text-sm">{t.synopsis}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
