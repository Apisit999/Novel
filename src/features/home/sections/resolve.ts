import { CONTENT_TYPES } from "@/content-types/registry";
import {
  DEFAULT_SECTIONS,
  parseConfig,
  SECTION_KINDS,
  type SectionConfigs,
  type SectionKind,
} from "./config";

export interface RawSection {
  id: string;
  kind: string;
  title: string;
  config: unknown;
}

/** ส่วนที่ตรวจผ่านแล้ว พร้อม render (config ถูกเติมค่าเริ่มต้นแล้ว) */
export type ResolvedSection = {
  [K in SectionKind]: { id: string; kind: K; title: string; config: SectionConfigs[K] };
}[SectionKind];

const isKind = (k: string): k is SectionKind => (SECTION_KINDS as readonly string[]).includes(k);

/**
 * ตรวจส่วนที่แอดมินตั้งไว้: ชนิดแปลก/config ผิดรูปจะถูกข้าม (หน้าแรกไม่พังเพราะส่วนเดียวเสีย)
 * ถ้าไม่เหลือส่วนที่ใช้ได้เลย → ใช้ผังเริ่มต้น หน้าแรกจึงไม่มีวันว่าง
 */
export function resolveSections(rows: RawSection[]): ResolvedSection[] {
  const out: ResolvedSection[] = [];
  for (const r of rows) {
    if (!isKind(r.kind)) continue;
    const parsed = parseConfig(r.kind, r.config);
    if (!parsed.ok) {
      console.error(`home: ข้ามส่วน ${r.kind} (${r.id}): ${parsed.error}`);
      continue;
    }
    out.push({ id: r.id, kind: r.kind, title: r.title, config: parsed.config } as ResolvedSection);
  }
  if (out.length > 0) return out;
  return resolveSections(
    DEFAULT_SECTIONS.map((s, i) => ({
      id: `default-${i}`,
      kind: s.kind,
      title: s.title,
      config: s.config,
    })),
  );
}

export interface Anchor {
  id: string;
  label: string;
  /** สีประจำประเภท (ถ้ามี) ใช้เป็นจุดสีหน้าชื่อปุ่มลัด */
  type?: "novel" | "manga" | "video";
}

/** จุดยึดของส่วน (ไว้ทำปุ่มลัดด้านบนหน้าแรก) — ไม่มีจุดยึด = ไม่แสดงเป็นปุ่มลัด */
export function sectionAnchor(section: ResolvedSection): Anchor | null {
  switch (section.kind) {
    case "top_ten":
      return { id: "zone-top", label: section.title || "ยอดฮิต" };
    case "type_zone": {
      const label = CONTENT_TYPES.find((t) => t.id === section.config.type)?.label ?? "";
      return {
        id: `zone-${section.config.type}`,
        label: section.title || label,
        type: section.config.type,
      };
    }
    case "collection":
      return { id: `zone-c-${section.config.slug}`, label: section.title || section.config.slug };
    default:
      return null;
  }
}

/** ปุ่มลัดทั้งหมด ไม่ซ้ำ id (ส่วนซ้ำกัน เช่น โซนนิยายสองโซน ใช้อันแรก) */
export function anchorsOf(sections: ResolvedSection[]): Anchor[] {
  const seen = new Set<string>();
  const out: Anchor[] = [];
  for (const s of sections) {
    const a = sectionAnchor(s);
    if (a && !seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}
