import { parseConfig, SECTION_KINDS, type SectionConfigs, type SectionKind } from "./config";

export const isSectionKind = (v: unknown): v is SectionKind =>
  typeof v === "string" && (SECTION_KINDS as readonly string[]).includes(v);

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};

/** ช่องตัวเลขที่เว้นว่าง = ไม่ส่งค่า (ให้ใช้ค่าเริ่มต้นของชนิดนั้น) */
const num = (f: FormData, k: string): number | undefined => {
  const v = str(f, k);
  return v === "" ? undefined : Number(v);
};

/** รายการ slug คั่นด้วยบรรทัดใหม่/จุลภาค/ช่องว่าง → อาร์เรย์ (ตัดซ้ำ) */
export function parseSlugList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** อ่านค่าจากฟอร์มแอดมินเป็น config ดิบของชนิดนั้น (ยังไม่ตรวจ — ส่งต่อให้ parseConfig) */
export function rawConfigFromForm(kind: SectionKind, f: FormData): Record<string, unknown> {
  switch (kind) {
    case "spotlight":
      return {
        mode: str(f, "mode") || undefined,
        slugs: parseSlugList(str(f, "slugs")),
        limit: num(f, "limit"),
      };
    case "top_ten":
      return { source: str(f, "source") || undefined, slugs: parseSlugList(str(f, "slugs")) };
    case "type_zone":
      return { type: str(f, "type"), limit: num(f, "limit") };
    case "latest":
    case "tag_chips":
      return { limit: num(f, "limit") };
    case "collection":
      return { slug: str(f, "collectionSlug"), limit: num(f, "limit") };
    case "banner":
      return { text: str(f, "text"), label: str(f, "label"), href: str(f, "href") };
  }
}

export type FormConfigResult<K extends SectionKind> =
  { ok: true; config: SectionConfigs[K] } | { ok: false; error: string };

/** ฟอร์ม → config ที่ตรวจแล้ว (ใช้ร่วมกันทั้งตอนเพิ่มและแก้ส่วน) */
export function configFromForm(kind: SectionKind, f: FormData): FormConfigResult<SectionKind> {
  return parseConfig(kind, rawConfigFromForm(kind, f));
}
