import { coverUrl } from "./cover-url";
import type { TitleSummary } from "./catalog";

/** ข้อมูลโครงสร้างสำหรับ Google (schema.org) ของหน้าเรื่อง */
export function titleJsonLd(title: TitleSummary, siteUrl: string) {
  const image = coverUrl(title.coverKey);
  return {
    "@context": "https://schema.org",
    "@type":
      title.type === "manga" ? "ComicSeries" : title.type === "video" ? "VideoObject" : "Book",
    name: title.name,
    description: title.synopsis || undefined,
    url: `${siteUrl}/title/${title.slug}`,
    inLanguage: "th",
    ...(image && { image }),
    ...(title.tags.length > 0 && { keywords: title.tags.join(", ") }),
  };
}

/** แปลงเป็นสตริงที่ฝังใน <script> ได้อย่างปลอดภัย (กัน "</script>" ในชื่อ/เรื่องย่อ) */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, String.fromCharCode(92) + "u003c");
}
