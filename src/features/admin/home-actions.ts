"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_SECTIONS } from "@/features/home/sections/config";
import { configFromForm, isSectionKind, parseSlugList } from "@/features/home/sections/form";
import { requireAdmin } from "./guard";
import { thaiLocalToIso } from "./schemas";

const uuid = z.string().uuid();
const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const refreshHome = () => updateTag("home");

const HOME = "/admin/home";
const PROMO = "/admin/home/promotions";
const COLLECTIONS = "/admin/home/collections";

/** กลับหน้าเดิมพร้อมข้อความ (ข้อผิดพลาดแสดงด้วย role=alert, สำเร็จด้วย role=status) */
function back(path: string, kind: "saved" | "error", message = ""): never {
  const q = kind === "error" ? `?error=${encodeURIComponent(message)}` : "?saved=1";
  redirect(`${path}${q}`);
}

const formString = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};

/** ช่วงเวลาจากฟอร์ม (เวลาไทย) — เว้นว่างได้; ถ้ากรอกต้องสิ้นสุดหลังเริ่ม */
function windowFromForm(f: FormData): { startsAt: string | null; endsAt: string | null } | string {
  const startsAt = thaiLocalToIso(formString(f, "startsAt"));
  const endsAt = thaiLocalToIso(formString(f, "endsAt"));
  if (formString(f, "startsAt") && !startsAt) return "วันเวลาเริ่มไม่ถูกต้อง";
  if (formString(f, "endsAt") && !endsAt) return "วันเวลาสิ้นสุดไม่ถูกต้อง";
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return "เวลาสิ้นสุดต้องหลังเวลาเริ่ม";
  }
  return { startsAt, endsAt };
}

// ---------------------------------------------------------------- ส่วนของหน้าแรก

type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

/** ใส่ผังเริ่มต้นลงตาราง คืนค่า false ถ้าใส่ไม่สำเร็จ */
async function insertDefaults(db: Db): Promise<boolean> {
  const { error } = await db.from("home_sections").insert(
    DEFAULT_SECTIONS.map((s, i) => ({
      kind: s.kind,
      title: s.title,
      config: s.config as never,
      position: (i + 1) * 10,
    })),
  );
  return !error;
}

/** สร้างผังเริ่มต้น (เฉพาะตอนยังไม่มีส่วนใดเลย — กันกดซ้ำแล้วได้ส่วนซ้ำ) */
export async function createDefaultSections() {
  const { db } = await requireAdmin();
  const existing = await db.from("home_sections").select("id", { count: "exact", head: true });
  if ((existing.count ?? 0) > 0) back(HOME, "error", "มีส่วนอยู่แล้ว ไม่สร้างผังเริ่มต้นซ้ำ");
  if (!(await insertDefaults(db))) back(HOME, "error", "สร้างผังเริ่มต้นไม่สำเร็จ");
  refreshHome();
  back(HOME, "saved");
}

export async function addSection(formData: FormData) {
  const { db } = await requireAdmin();
  const kind = formString(formData, "kind");
  if (!isSectionKind(kind)) back(HOME, "error", "เลือกชนิดของส่วน");
  const parsed = configFromForm(kind, formData);
  if (!parsed.ok) back(HOME, "error", parsed.error);

  // ตารางยังว่าง = หน้าแรกใช้ผังเริ่มต้นอยู่ — ใส่ผังเริ่มต้นก่อน ไม่งั้นส่วนที่เพิ่มจะแทนที่ทั้งหน้า
  const count = await db.from("home_sections").select("id", { count: "exact", head: true });
  if ((count.count ?? 0) === 0 && !(await insertDefaults(db))) {
    back(HOME, "error", "เพิ่มส่วนไม่สำเร็จ");
  }

  const last = await db
    .from("home_sections")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const position = (last.data?.[0]?.position ?? 0) + 10;
  const { error } = await db.from("home_sections").insert({
    kind,
    title: formString(formData, "title").slice(0, 120),
    config: parsed.config as never,
    position,
  });
  if (error) back(HOME, "error", "เพิ่มส่วนไม่สำเร็จ");
  refreshHome();
  back(HOME, "saved");
}

export async function saveSection(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const kind = formString(formData, "kind");
  if (!id.success || !isSectionKind(kind)) back(HOME, "error", "ข้อมูลไม่ถูกต้อง");
  const parsed = configFromForm(kind, formData);
  if (!parsed.ok) back(HOME, "error", parsed.error);
  const win = windowFromForm(formData);
  if (typeof win === "string") back(HOME, "error", win);

  const { error } = await db
    .from("home_sections")
    .update({
      title: formString(formData, "title").slice(0, 120),
      config: parsed.config as never,
      starts_at: win.startsAt,
      ends_at: win.endsAt,
    })
    .eq("id", id.data);
  if (error) back(HOME, "error", "บันทึกส่วนไม่สำเร็จ");
  refreshHome();
  back(HOME, "saved");
}

export async function toggleSection(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(HOME, "error", "ข้อมูลไม่ถูกต้อง");
  const cur = await db.from("home_sections").select("enabled").eq("id", id.data).maybeSingle();
  if (!cur.data) back(HOME, "error", "ไม่พบส่วนนี้");
  await db.from("home_sections").update({ enabled: !cur.data.enabled }).eq("id", id.data);
  refreshHome();
  back(HOME, "saved");
}

export async function deleteSection(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(HOME, "error", "ข้อมูลไม่ถูกต้อง");
  await db.from("home_sections").delete().eq("id", id.data);
  refreshHome();
  back(HOME, "saved");
}

/** เลื่อนส่วนขึ้น/ลง — จัดเลขตำแหน่งใหม่ทั้งหมดเป็น 10,20,30… (ตำแหน่งซ้ำ/ห่างกันก็ไม่มีปัญหา) */
export async function moveSection(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const dir = formData.get("dir");
  if (!id.success || (dir !== "up" && dir !== "down")) back(HOME, "error", "ข้อมูลไม่ถูกต้อง");

  const { data } = await db
    .from("home_sections")
    .select("id")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const order = (data ?? []).map((r) => r.id);
  const i = order.indexOf(id.data);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) back(HOME, "saved");
  [order[i], order[j]] = [order[j], order[i]];

  for (const [n, rowId] of order.entries()) {
    await db
      .from("home_sections")
      .update({ position: (n + 1) * 10 })
      .eq("id", rowId);
  }
  refreshHome();
  back(HOME, "saved");
}

// ---------------------------------------------------------------- ปักโปรโมท

const pinSchema = z.object({
  slug: z.string().regex(slugRe, "ใส่ slug ของเรื่อง"),
  placement: z.enum(["spotlight", "top_ten_boost", "hidden"]),
  position: z.coerce.number().int().min(0).max(999).default(0),
  note: z.string().max(300).default(""),
});

export async function addPin(formData: FormData) {
  const { db } = await requireAdmin();
  const parsed = pinSchema.safeParse({
    slug: formString(formData, "slug"),
    placement: formString(formData, "placement"),
    position: formString(formData, "position") || 0,
    note: formString(formData, "note"),
  });
  if (!parsed.success) back(PROMO, "error", parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  const win = windowFromForm(formData);
  if (typeof win === "string") back(PROMO, "error", win);

  const title = await db.from("titles").select("id").eq("slug", parsed.data.slug).maybeSingle();
  if (!title.data) back(PROMO, "error", `ไม่พบเรื่อง slug “${parsed.data.slug}”`);

  const { error } = await db.from("home_pins").insert({
    title_id: title.data.id,
    placement: parsed.data.placement,
    position: parsed.data.position,
    note: parsed.data.note,
    starts_at: win.startsAt,
    ends_at: win.endsAt,
  });
  if (error) back(PROMO, "error", "เพิ่มการปักไม่สำเร็จ");
  refreshHome();
  back(PROMO, "saved");
}

export async function deletePin(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(PROMO, "error", "ข้อมูลไม่ถูกต้อง");
  await db.from("home_pins").delete().eq("id", id.data);
  refreshHome();
  back(PROMO, "saved");
}

// ---------------------------------------------------------------- ชุดคัดสรร

const collectionSchema = z.object({
  slug: z.string().regex(slugRe, "slug ใช้ได้เฉพาะ a-z 0-9 และขีดกลาง"),
  title: z.string().min(1, "ใส่ชื่อชุด").max(120),
  description: z.string().max(500).default(""),
});

export async function saveCollection(formData: FormData) {
  const { db } = await requireAdmin();
  const id = formString(formData, "id");
  const parsed = collectionSchema.safeParse({
    slug: formString(formData, "slug"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
  });
  if (!parsed.success) {
    back(COLLECTIONS, "error", parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const published = formData.get("published") === "on";

  if (id) {
    const cid = uuid.safeParse(id);
    if (!cid.success) back(COLLECTIONS, "error", "ข้อมูลไม่ถูกต้อง");
    const { error } = await db
      .from("collections")
      .update({ ...parsed.data, published })
      .eq("id", cid.data);
    if (error) back(COLLECTIONS, "error", error.code === "23505" ? "slug ซ้ำ" : "บันทึกไม่สำเร็จ");
  } else {
    const { error } = await db.from("collections").insert({ ...parsed.data, published });
    if (error) back(COLLECTIONS, "error", error.code === "23505" ? "slug ซ้ำ" : "สร้างชุดไม่สำเร็จ");
  }
  refreshHome();
  back(COLLECTIONS, "saved");
}

/** กำหนดรายการเรื่องในชุดตามลำดับที่กรอก (แทนที่ของเดิมทั้งหมด) */
export async function saveCollectionItems(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(COLLECTIONS, "error", "ข้อมูลไม่ถูกต้อง");
  const slugs = parseSlugList(formString(formData, "slugs")).slice(0, 60);

  const found = slugs.length
    ? await db.from("titles").select("id, slug").in("slug", slugs)
    : { data: [] as { id: string; slug: string }[] };
  const bySlug = new Map((found.data ?? []).map((t) => [t.slug, t.id]));
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length > 0) back(COLLECTIONS, "error", `ไม่พบเรื่อง: ${missing.join(", ")}`);

  await db.from("collection_items").delete().eq("collection_id", id.data);
  if (slugs.length > 0) {
    const { error } = await db.from("collection_items").insert(
      slugs.map((s, i) => ({
        collection_id: id.data,
        title_id: bySlug.get(s)!,
        position: i,
      })),
    );
    if (error) back(COLLECTIONS, "error", "บันทึกรายการเรื่องไม่สำเร็จ");
  }
  refreshHome();
  back(COLLECTIONS, "saved");
}

export async function deleteCollection(formData: FormData) {
  const { db } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(COLLECTIONS, "error", "ข้อมูลไม่ถูกต้อง");
  await db.from("collections").delete().eq("id", id.data);
  refreshHome();
  back(COLLECTIONS, "saved");
}
