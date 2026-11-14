import { admin, revalidateCatalog } from "./supabase";
import { solidPng } from "./png";

export interface MangaFixture {
  slug: string;
  titleId: string;
  episodeId: string;
  keys: string[];
}

/**
 * สร้างมังงะทดสอบ: เรื่อง + ตอนที่ 1 + รูป n หน้า (อัปโหลดจริงเข้า Storage ผ่าน service role)
 * ความสูงรูปต่างกันตามหน้า (1000, 1100, …) เพื่อใช้ตรวจลำดับหน้าได้
 */
export async function createMangaFixture(opts: {
  slug: string;
  pages?: number;
  episodeStatus?: "draft" | "published";
}): Promise<MangaFixture> {
  const db = admin();
  const title = await db
    .from("titles")
    .insert({ slug: opts.slug, name: "มังงะทดสอบ", type: "manga", published: true })
    .select("id")
    .single();
  if (title.error) throw new Error(`สร้างเรื่องไม่ได้: ${title.error.message}`);
  const ep = await db
    .from("episodes")
    .insert({
      title_id: title.data.id,
      number: 1,
      name: "ตอนที่ 1",
      status: opts.episodeStatus ?? "published",
    })
    .select("id")
    .single();
  if (ep.error) throw new Error(`สร้างตอนไม่ได้: ${ep.error.message}`);

  const keys: string[] = [];
  const n = opts.pages ?? 3;
  for (let i = 0; i < n; i++) {
    const key = `${title.data.id}/${ep.data.id}/fx-${i + 1}.png`;
    const up = await db.storage
      .from("manga")
      .upload(key, solidPng(400, 1000 + i * 100, [40 + i * 60, 90, 160]), {
        contentType: "image/png",
      });
    if (up.error) throw new Error(`อัปโหลดรูปไม่ได้: ${up.error.message}`);
    const row = await db.from("manga_pages").insert({
      episode_id: ep.data.id,
      page_no: i + 1,
      image_key: key,
      width: 400,
      height: 1000 + i * 100,
    });
    if (row.error) throw new Error(`บันทึกหน้าไม่ได้: ${row.error.message}`);
    keys.push(key);
  }
  await revalidateCatalog(); // ให้หน้าเว็บเห็นเรื่องใหม่ทันที (ไม่รอแคช 1 นาที)
  return { slug: opts.slug, titleId: title.data.id, episodeId: ep.data.id, keys };
}

/** ลบมังงะทดสอบ: ลบไฟล์ใน Storage ทุกไฟล์ใต้เรื่องนี้ แล้วลบเรื่อง (แถวอื่น cascade) */
export async function deleteMangaFixture(slug: string) {
  const db = admin();
  const title = await db.from("titles").select("id").eq("slug", slug).maybeSingle();
  if (!title.data) return;
  const pages = await db
    .from("manga_pages")
    .select("image_key, episodes!inner(title_id)")
    .eq("episodes.title_id", title.data.id);
  const keys = (pages.data ?? []).map((p) => p.image_key);
  if (keys.length) await db.storage.from("manga").remove(keys);
  await db.from("titles").delete().eq("id", title.data.id);
}

/** ไฟล์ที่ยังอยู่ใน Storage ใต้โฟลเดอร์ของเรื่อง (ไว้ตรวจว่าไม่มีไฟล์ค้างหลังลบ) */
export async function listStoredFiles(titleId: string): Promise<string[]> {
  const db = admin();
  const out: string[] = [];
  const dirs = await db.storage.from("manga").list(titleId);
  for (const d of dirs.data ?? []) {
    const files = await db.storage.from("manga").list(`${titleId}/${d.name}`);
    out.push(...(files.data ?? []).map((f) => `${titleId}/${d.name}/${f.name}`));
  }
  return out;
}
