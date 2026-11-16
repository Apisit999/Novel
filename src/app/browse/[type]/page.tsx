import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { isPaywallEnabled } from "@/features/access/paywall";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CONTENT_TYPES, getContentType } from "@/content-types/registry";
import {
  listFollowerCounts,
  listTags,
  listTitles,
  listViewCounts,
  type TitleStatus,
} from "@/features/catalog/catalog";
import { compactCount, parseSort, SORTS, sortTitles } from "@/features/catalog/sort";
import { STATUS_LABEL, TitleCard, TitleGrid } from "@/features/catalog/title-card";

export function generateStaticParams() {
  return CONTENT_TYPES.map((t) => ({ type: t.id }));
}

function parseStatus(v: string | string[] | undefined): TitleStatus | undefined {
  return typeof v === "string" && v in STATUS_LABEL ? (v as TitleStatus) : undefined;
}

export async function generateMetadata({ params }: PageProps<"/browse/[type]">): Promise<Metadata> {
  const { type } = await params;
  const def = getContentType(type);
  if (!def) return {};
  return {
    title: def.label,
    description: `รวม${def.label}ทั้งหมดบน ${SITE.name}`,
    alternates: { canonical: `/browse/${def.id}` }, // ตัวกรอง (?tag=) ชี้กลับหน้าหลักของหมวด
  };
}

async function Listing({ props }: { props: PageProps<"/browse/[type]"> }) {
  const [{ type }, query] = await Promise.all([props.params, props.searchParams]);
  const def = getContentType(type);
  if (!def) notFound();

  const tag = typeof query.tag === "string" ? query.tag : undefined;
  const status = parseStatus(query.status);
  const sort = parseSort(query.sort);
  const showPremium = await isPaywallEnabled();
  const [found, tags, views, followers] = await Promise.all([
    listTitles(def.id, { tag, status }),
    listTags(def.id),
    listViewCounts(),
    listFollowerCounts(),
  ]);
  const titles = sortTitles(found, sort, views);
  const metaOf = (slug: string) => {
    const parts = [];
    if (views[slug])
      parts.push(`${def.verb === "ดู" ? "ยอดดู" : "ยอดอ่าน"} ${compactCount(views[slug])}`);
    if (followers[slug]) parts.push(`ผู้ติดตาม ${compactCount(followers[slug])}`);
    return parts.join(" · ") || undefined;
  };

  const href = (next: { tag?: string; status?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const t = "tag" in next ? next.tag : tag;
    const s = "status" in next ? next.status : status;
    const o = "sort" in next ? next.sort : sort;
    if (t) p.set("tag", t);
    if (s) p.set("status", s);
    if (o && o !== "latest") p.set("sort", o);
    const qs = p.toString();
    return `/browse/${def.id}${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="mt-4 space-y-2 text-sm">
        <p>
          แท็ก:{" "}
          <Link href={href({ tag: undefined })} className={tag ? "text-accent" : "font-bold"}>
            ทั้งหมด
          </Link>
          {tags.map((t) => (
            <span key={t}>
              {" · "}
              <Link href={href({ tag: t })} className={t === tag ? "font-bold" : "text-accent"}>
                {t}
              </Link>
            </span>
          ))}
        </p>
        <p>
          สถานะ:{" "}
          <Link href={href({ status: undefined })} className={status ? "text-accent" : "font-bold"}>
            ทั้งหมด
          </Link>
          {(Object.keys(STATUS_LABEL) as TitleStatus[]).map((s) => (
            <span key={s}>
              {" · "}
              <Link
                href={href({ status: s })}
                className={s === status ? "font-bold" : "text-accent"}
              >
                {STATUS_LABEL[s]}
              </Link>
            </span>
          ))}
        </p>
        <p>
          เรียงตาม:{" "}
          {SORTS.map((o, i) => (
            <span key={o.id}>
              {i > 0 && " · "}
              <Link
                href={href({ sort: o.id })}
                aria-current={o.id === sort ? "true" : undefined}
                className={o.id === sort ? "font-bold" : "text-accent"}
              >
                {o.label}
              </Link>
            </span>
          ))}
        </p>
      </div>
      {titles.length === 0 ? (
        <p className="text-muted mt-4">ไม่พบ{def.label}ที่ตรงเงื่อนไข</p>
      ) : (
        <div className="mt-6">
          <TitleGrid>
            {titles.map((t) => (
              <TitleCard key={t.slug} title={t} showPremium={showPremium} meta={metaOf(t.slug)} />
            ))}
          </TitleGrid>
        </div>
      )}
    </>
  );
}

export default async function BrowsePage(props: PageProps<"/browse/[type]">) {
  const { type } = await props.params;
  const def = getContentType(type);
  if (!def) notFound();

  return (
    <section>
      <h1 className="text-2xl font-bold">{def.label}</h1>
      <Suspense fallback={<p className="text-muted mt-4">กำลังโหลด…</p>}>
        <Listing props={props} />
      </Suspense>
    </section>
  );
}
