import { SITE } from "@/lib/site";
import { SearchForm } from "@/components/search-form";
import { listHomeSections } from "@/features/catalog/catalog";
import { TYPE_STYLE } from "@/features/catalog/type-style";
import { ContinueStrip } from "@/features/library/library-view";
import { loadHomeContext } from "@/features/home/sections/context";
import { anchorsOf, resolveSections } from "@/features/home/sections/resolve";
import { SectionView } from "@/features/home/sections/view";

/**
 * หน้าแรก = ประกอบจาก "ส่วน" ที่แอดมินจัดไว้ใน /admin/home (เรียง/เปิดปิด/ตั้งเวลา)
 * ไม่มีส่วนที่ใช้ได้ → ใช้ผังเริ่มต้น (DEFAULT_SECTIONS) หน้าแรกจึงไม่ว่าง
 */
export default async function HomePage() {
  const [rows, ctx] = await Promise.all([listHomeSections(), loadHomeContext()]);
  const sections = resolveSections(rows);
  const anchors = anchorsOf(sections);
  const firstSpotlight = sections.findIndex((s) => s.kind === "spotlight");

  return (
    <div className="flex flex-col gap-14">
      <h1 className="sr-only">{SITE.name}</h1>

      <div className="flex flex-col gap-4">
        <SearchForm />
        {anchors.length > 0 && (
          <nav aria-label="ไปที่โซน" className="flex flex-wrap gap-2">
            {anchors.map((a) => (
              <a key={a.id} href={`#${a.id}`} aria-label={`เลื่อนไปโซน${a.label}`} className={chip}>
                {a.type && (
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full"
                    style={{ background: TYPE_STYLE[a.type].accent }}
                  />
                )}
                {a.label}
              </a>
            ))}
          </nav>
        )}
      </div>

      {firstSpotlight === -1 && <ContinueStrip titles={ctx.titles} />}
      {sections.map((section, i) => (
        <div key={section.id} className="contents">
          <SectionView section={section} ctx={ctx} />
          {i === firstSpotlight && <ContinueStrip titles={ctx.titles} />}
        </div>
      ))}
    </div>
  );
}

const chip =
  "border-border bg-surface text-foreground flex min-h-12 items-center gap-2 rounded-full border-2 px-5 font-bold no-underline";
