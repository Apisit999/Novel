import {
  BannerSection,
  CollectionSection,
  LatestSection,
  SpotlightSection,
  TagChipsSection,
  TopTenSection,
  TypeZoneSection,
} from "./components";
import type { HomeContext } from "./context";
import type { ResolvedSection } from "./resolve";

/**
 * ตัว render ของแต่ละชนิดส่วน — เพิ่มชนิดใหม่ = เพิ่ม case เดียวที่นี่ + schema ใน config.ts
 * (เหมือน content-type registry) ส่วนที่ไม่รู้จักถูกกรองออกตั้งแต่ resolveSections แล้ว
 */
export async function SectionView({
  section,
  ctx,
}: {
  section: ResolvedSection;
  ctx: HomeContext;
}) {
  switch (section.kind) {
    case "spotlight":
      return <SpotlightSection title={section.title} config={section.config} ctx={ctx} />;
    case "top_ten":
      return <TopTenSection title={section.title} config={section.config} ctx={ctx} />;
    case "type_zone":
      return <TypeZoneSection title={section.title} config={section.config} ctx={ctx} />;
    case "latest":
      return <LatestSection title={section.title} config={section.config} ctx={ctx} />;
    case "tag_chips":
      return <TagChipsSection title={section.title} config={section.config} ctx={ctx} />;
    case "collection":
      return <CollectionSection title={section.title} config={section.config} ctx={ctx} />;
    case "banner":
      return <BannerSection title={section.title} config={section.config} ctx={ctx} />;
  }
}
