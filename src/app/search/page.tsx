import { Suspense } from "react";
import { isPaywallEnabled } from "@/features/access/paywall";
import { SearchForm } from "@/components/search-form";
import { searchTitles } from "@/features/catalog/catalog";
import { TitleCard, TitleGrid } from "@/features/catalog/title-card";

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const results = await searchTitles(query);
  const showPremium = await isPaywallEnabled();

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
            {results.map((t) => (
              <TitleCard key={t.slug} title={t} showPremium={showPremium} />
            ))}
          </TitleGrid>
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
