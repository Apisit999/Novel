import JSZip from "jszip";
import { requireAdmin } from "@/features/admin/guard";
import { buildInfoJson, buildNovelText, safeFileStem } from "@/features/export/build-export";
import { listNovelIds, loadNovel } from "@/features/export/load-novels";

/**
 * สำรองนิยายทั้งระบบเป็นไฟล์ .zip — เฉพาะแอดมิน
 * ต่อเรื่อง: <slug>/novel.md (เนื้อหาไทยทุกตอน นำเข้ากลับได้), <slug>/info.json (ข้อมูลเรื่อง + สถานะ/สิทธิ์/เวลาของตอน),
 * <slug>/translations/<ภาษา>.md (คำแปลที่มี)
 */
export async function GET() {
  const { db } = await requireAdmin();
  const zip = new JSZip();
  const used = new Set<string>();

  for (const id of await listNovelIds(db)) {
    const novel = await loadNovel(db, id);
    if (!novel) continue;
    // โฟลเดอร์ต่อเรื่องใช้ slug (ไม่ซ้ำอยู่แล้วในฐานข้อมูล) — กันชื่อชนหลังทำให้ปลอดภัยด้วยเลขต่อท้าย
    let dir = safeFileStem(novel.title.slug);
    for (let i = 2; used.has(dir); i++) dir = `${safeFileStem(novel.title.slug)}-${i}`;
    used.add(dir);

    zip.file(`${dir}/novel.md`, buildNovelText(novel.title, novel.episodes, "md"));
    zip.file(`${dir}/info.json`, buildInfoJson(novel.title, novel.episodes));
    const langs = new Set(novel.episodes.flatMap((e) => e.translations.map((t) => t.lang)));
    for (const lang of langs) {
      const eps = novel.episodes.flatMap((e) => {
        const t = e.translations.find((x) => x.lang === lang);
        return t ? [{ number: e.number, name: e.name, body: t.body }] : [];
      });
      zip.file(
        `${dir}/translations/${safeFileStem(lang)}.md`,
        buildNovelText({ name: novel.title.name, author: novel.title.author }, eps, "md"),
      );
    }
  }
  if (used.size === 0) zip.file("README.txt", "ยังไม่มีนิยายในระบบ\n");

  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const stamp = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10); // วันที่ไทย
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="aandoo-novels-${stamp}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
