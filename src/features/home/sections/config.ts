import { z } from "zod";

/** ชนิดของส่วนในหน้าแรก — ต้องตรงกับ check constraint ของตาราง home_sections */
export const SECTION_KINDS = [
  "spotlight",
  "top_ten",
  "type_zone",
  "latest",
  "tag_chips",
  "collection",
  "banner",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const KIND_LABEL: Record<SectionKind, string> = {
  spotlight: "เรื่องเด่น (แบนเนอร์ใหญ่)",
  top_ten: "10 อันดับยอดฮิต",
  type_zone: "โซนตามประเภท",
  latest: "อัปเดตล่าสุด",
  tag_chips: "หมวดที่คนชอบ",
  collection: "ชุดคัดสรร",
  banner: "แถบประกาศ/โปรโมชัน",
};

const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugList = z.array(z.string().regex(slugRe)).max(24).default([]);

/** ลิงก์ที่ปลอดภัย: path ในเว็บ (ขึ้นต้น / ไม่ใช่ //) หรือ https เท่านั้น — กัน javascript: และลิงก์แปลก ๆ */
const safeHref = z
  .string()
  .max(300)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || v.startsWith("https://"), {
    message: "ลิงก์ต้องขึ้นต้นด้วย / หรือ https://",
  });

export const CONFIG_SCHEMAS = {
  spotlight: z.object({
    mode: z.enum(["auto", "manual"]).default("auto"),
    slugs: slugList,
    limit: z.number().int().min(1).max(6).default(3),
  }),
  top_ten: z.object({
    source: z.enum(["auto", "manual"]).default("auto"),
    slugs: slugList,
  }),
  type_zone: z.object({
    type: z.enum(["novel", "manga", "video"]),
    limit: z.number().int().min(3).max(12).default(6),
  }),
  latest: z.object({ limit: z.number().int().min(4).max(24).default(12) }),
  tag_chips: z.object({ limit: z.number().int().min(3).max(16).default(8) }),
  collection: z.object({
    slug: z.string().regex(slugRe),
    limit: z.number().int().min(3).max(12).default(6),
  }),
  banner: z.object({
    text: z.string().min(1).max(200),
    label: z.string().max(40).default(""),
    href: safeHref,
  }),
} satisfies Record<SectionKind, z.ZodType>;

export type SectionConfigs = {
  [K in SectionKind]: z.output<(typeof CONFIG_SCHEMAS)[K]>;
};

export type ConfigResult<K extends SectionKind> =
  { ok: true; config: SectionConfigs[K] } | { ok: false; error: string };

/** ตรวจ + เติมค่าเริ่มต้นของ config ตามชนิด (ใช้ทั้งตอนแสดงหน้าแรกและตอนแอดมินบันทึก) */
export function parseConfig<K extends SectionKind>(kind: K, raw: unknown): ConfigResult<K> {
  const result = CONFIG_SCHEMAS[kind].safeParse(raw ?? {});
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "ค่าตั้งไม่ถูกต้อง" };
  }
  return { ok: true, config: result.data as SectionConfigs[K] };
}

export interface DefaultSection {
  kind: SectionKind;
  title: string;
  config: Record<string, unknown>;
}

/**
 * ผังเริ่มต้น — ใช้เมื่อยังไม่มีส่วนในฐานข้อมูล (หน้าแรกไม่ว่าง) และเป็นต้นแบบของปุ่ม "สร้างผังเริ่มต้น"
 */
export const DEFAULT_SECTIONS: DefaultSection[] = [
  { kind: "spotlight", title: "", config: { mode: "auto", limit: 3 } },
  { kind: "top_ten", title: "", config: { source: "auto" } },
  { kind: "type_zone", title: "", config: { type: "novel", limit: 6 } },
  { kind: "type_zone", title: "", config: { type: "manga", limit: 6 } },
  { kind: "type_zone", title: "", config: { type: "video", limit: 6 } },
  { kind: "latest", title: "", config: { limit: 12 } },
  { kind: "tag_chips", title: "", config: { limit: 8 } },
];
