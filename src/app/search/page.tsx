import { Suspense } from "react";
import { isPaywallEnabled } from "@/features/access/paywall";
import { Pagination } from "@/components/pagination";
import { paginate, parsePage } from "@/lib/paginate";
import { SearchForm } from "@/components/search-form";
import { searchTitles } from "@/features/catalog/catalog";
import { TitleCard, TitleGrid } from "@/features/catalog/title-card";

const PER_PAGE = 24;

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q, page: pageParam } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const results = await searchTitles(query);
  const showPremium = await isPaywallEnabled();
  const pg = paginate(results.length, parsePage(pageParam), PER_PAGE);
  const href = (n: number) => `/search?q=${encodeURIComponent(query)}${n > 1 ? `&page=${n}` : ""}`;

  return (
    <>
      <div className="mt-4">
        <SearchForm defaultValue={query} />
      </div>
      {query && (
        <p className="text-muted mt-6">
          พบ {results.length} เรื่อง สำหรับ “{query}”
        </p>
      )}
      {results.length > 0 && (
        <div className="mt-4">
          <TitleGrid>
            {results.slice(pg.start, pg.end).map((t) => (
              <TitleCard key={t.slug} title={t} showPremium={showPremium} />
            ))}
          </TitleGrid>
          <Pagination page={pg.page} totalPages={pg.totalPages} href={href} />
        </div>
      )}
    </>
  );
}

export const metadata = { title: "ค้นหา", robots: { index: false } };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <section>
      <h1 className="text-2xl font-bold">ค้นหา</h1>
      <Suspense fallback={<p className="text-muted mt-4">กำลังโหลด…</p>}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
