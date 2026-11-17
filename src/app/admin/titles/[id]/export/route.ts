import { notFound } from "next/navigation";
import { auditLog } from "@/features/admin/audit";
import { requireAdmin } from "@/features/admin/guard";
import { buildNovelText, safeFileStem } from "@/features/export/build-export";
import { loadNovel } from "@/features/export/load-novels";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * ดาวน์โหลดนิยายทั้งเรื่องเป็นไฟล์เดียว (?format=md|txt) — เฉพาะแอดมิน รวมทุกตอนทุกสถานะ
 * รูปแบบนำเข้ากลับด้วยหน้า "นำเข้าหลายตอน" ได้
 */
export async function GET(request: Request, ctx: RouteContext<"/admin/titles/[id]/export">) {
  const [admin, { id }] = await Promise.all([requireAdmin(), ctx.params]);
  const { db } = admin;
  if (!UUID.test(id)) notFound();

  const format = new URL(request.url).searchParams.get("format") === "txt" ? "txt" : "md";
  const novel = await loadNovel(db, id);
  if (!novel) notFound();

  await auditLog(admin, "export.title", id, { format, episodes: novel.episodes.length });
  const text = buildNovelText(novel.title, novel.episodes, format);
  const file = `${safeFileStem(novel.title.slug)}.${format}`;
  return new Response(text, {
    headers: {
      "Content-Type": `${format === "md" ? "text/markdown" : "text/plain"}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
