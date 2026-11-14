import type { MetadataRoute } from "next";
import { CONTENT_TYPES } from "@/content-types/registry";
import { listForSitemap } from "@/features/catalog/catalog";
import { publicEnv } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const entries = await listForSitemap();

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...CONTENT_TYPES.map((t) => ({
      url: `${base}/browse/${t.id}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...entries.flatMap(({ title, episodes }) => [
      { url: `${base}/title/${title.slug}`, changeFrequency: "weekly" as const, priority: 0.7 },
      // ตอนอ่านของนิยายเท่านั้น (มังงะ/วิดีโอมาในเฟส 4/5)
      ...(title.type === "novel"
        ? episodes.map((e) => ({
            url: `${base}/read/${title.slug}/${e.number}`,
            changeFrequency: "monthly" as const,
            priority: 0.5,
          }))
        : []),
    ]),
  ];
}
