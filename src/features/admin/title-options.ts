import "server-only";
import type { requireAdmin } from "./guard";

export interface TitleOption {
  slug: string;
  name: string;
  type: "novel" | "manga" | "video";
  published: boolean;
}

export interface CollectionOption {
  slug: string;
  title: string;
}

type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

/** รายชื่อเรื่องทั้งหมดสำหรับตัวเลือกในหน้าจัดหน้าแรก (เรียงตามชื่อ) */
export async function listTitleOptions(db: Db): Promise<TitleOption[]> {
  const { data, error } = await db
    .from("titles")
    .select("slug, name, type, published")
    .order("name", { ascending: true });
  if (error) throw new Error(`อ่านรายชื่อเรื่องไม่สำเร็จ: ${error.message}`);
  return data ?? [];
}

export async function listCollectionOptions(db: Db): Promise<CollectionOption[]> {
  const { data, error } = await db
    .from("collections")
    .select("slug, title")
    .order("title", { ascending: true });
  if (error) throw new Error(`อ่านรายการชุดคัดสรรไม่สำเร็จ: ${error.message}`);
  return data ?? [];
}
