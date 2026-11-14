import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CONTENT_TYPES, getContentType } from "@/content-types/registry";
import { listTags, listTitles, type TitleStatus } from "@/features/catalog/catalog";

const STATUS_LABEL: Record<TitleStatus, string> = {
  ongoing: "กำลังอัปเดต",
  completed: "จบแล้ว",
  hiatus: "พักการอัปเดต",
};

export function generateStaticParams() {
  return CONTENT_TYPES.map((t) => ({ type: t.id }));
}

function parseStatus(v: string | string[] | undefined): TitleStatus | undefined {
  return typeof v === "string" && v in STATUS_LABEL ? (v as TitleStatus) : undefined;
}

async function Listing({ props }: { props: PageProps<"/browse/[type]"> }) {
  const [{ type }, query] = await Promise.all([props.params, props.searchParams]);
  const def = getContentType(type);
  if (!def) notFound();

  const tag = typeof query.tag === "string" ? query.tag : undefined;
  const status = parseStatus(query.status);
  const [titles, tags] = await Promise.all([listTitles(def.id, { tag, status }), listTags(def.id)]);

  const href = (next: { tag?: string; status?: string }) => {
    const p = new URLSearchParams();
    const t = "tag" in next ? next.tag : tag;
    const s = "status" in next ? next.status : status;
    if (t) p.set("tag", t);
    if (s) p.set("status", s);
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
      </div>
      {titles.length === 0 ? (
        <p className="text-muted mt-4">ไม่พบ{def.label}ที่ตรงเงื่อนไข</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {titles.map((t) => (
            <li key={t.slug}>
              <Link href={`/title/${t.slug}`} className="text-accent font-semibold">
                {t.name}
              </Link>
              <span className="text-muted text-sm"> · {STATUS_LABEL[t.status]}</span>
              <p className="text-muted text-sm">{t.synopsis}</p>
            </li>
          ))}
        </ul>
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
