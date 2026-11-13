import { notFound } from "next/navigation";
import { CONTENT_TYPES, getContentType } from "@/content-types/registry";

export function generateStaticParams() {
  return CONTENT_TYPES.map((t) => ({ type: t.id }));
}

export default async function BrowsePage({ params }: PageProps<"/browse/[type]">) {
  const { type } = await params;
  const def = getContentType(type);
  if (!def) notFound();

  return (
    <section>
      <h1 className="text-2xl font-bold">{def.label}</h1>
      <p className="text-muted mt-2">เร็ว ๆ นี้ — รายการ{def.label}จะมาในเฟสถัดไป</p>
    </section>
  );
}
