import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPaywallEnabled } from "@/features/access/paywall";
import { listAllTitles } from "@/features/catalog/catalog";
import { TitleCard, TitleGrid } from "@/features/catalog/title-card";

/** ชื่อใน URL (เข้ารหัสแล้ว) → ชื่อจริง; รูปแบบเข้ารหัสเสีย = ไม่พบ */
function decodeName(raw: string): string | null {
  try {
    const name = decodeURIComponent(raw).trim();
    return name.length > 0 && name.length <= 100 ? name : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/author/[name]">): Promise<Metadata> {
  const name = decodeName((await params).name);
  if (!name) return {};
  return {
    title: `ผลงานของ ${name}`,
    description: `รวมผลงานทั้งหมดของ ${name}`,
    alternates: { canonical: `/author/${encodeURIComponent(name)}` },
  };
}

export default async function AuthorPage({ params }: PageProps<"/author/[name]">) {
  const name = decodeName((await params).name);
  if (!name) notFound();
  const [all, showPremium] = await Promise.all([listAllTitles(), isPaywallEnabled()]);
  const works = all.filter((t) => t.author === name);
  if (works.length === 0) notFound();

  return (
    <section>
      <p className="text-muted text-sm font-bold">ผู้แต่ง/ผู้สร้าง</p>
      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="text-muted">{works.length} เรื่อง</p>
      <div className="mt-6">
        <TitleGrid>
          {works.map((t) => (
            <TitleCard key={t.slug} title={t} showPremium={showPremium} />
          ))}
        </TitleGrid>
      </div>
    </section>
  );
}
