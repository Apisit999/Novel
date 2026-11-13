import { SITE } from "@/lib/site";

export default function HomePage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">{SITE.name}</h1>
      <p className="text-muted mt-2">{SITE.description}</p>
      <p className="border-border bg-surface mt-8 rounded-xl border p-5">
        ฐานรากพร้อมแล้ว — เนื้อหาจะมาในเฟสถัดไป
      </p>
    </section>
  );
}
