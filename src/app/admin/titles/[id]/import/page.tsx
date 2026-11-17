import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/admin/guard";
import { ImportWizard } from "@/features/import/import-wizard";
import { MangaImport } from "@/features/import/manga-import";

const UUID = /^[0-9a-f-]{36}$/i;

export const metadata = { title: "นำเข้าหลายตอน" };

export default async function ImportPage({ params }: PageProps<"/admin/titles/[id]/import">) {
  const [{ db }, { id }] = await Promise.all([requireAdmin(), params]);
  if (!UUID.test(id)) notFound();

  const { data: title } = await db
    .from("titles")
    .select("id, name, type")
    .eq("id", id)
    .maybeSingle();
  if (!title || (title.type !== "novel" && title.type !== "manga")) notFound();
  const { data: episodes } = await db
    .from("episodes")
    .select("number")
    .eq("title_id", id)
    .order("number", { ascending: true });
  const numbers = (episodes ?? []).map((e) => e.number);
  const nextNumber = (numbers.at(-1) ?? 0) + 1;

  return (
    <section>
      <p className="text-muted text-sm">
        <Link href={`/admin/titles/${id}`}>← {title.name}</Link>
      </p>
      <h1 className="mt-1 mb-2 text-2xl font-bold">นำเข้าหลายตอน</h1>
      {title.type === "manga" ? (
        <>
          <p className="text-muted mb-8 max-w-3xl">
            เลือกโฟลเดอร์ของเรื่อง ข้างในมีโฟลเดอร์ย่อยตอนละโฟลเดอร์ (เลขตอนดึงจากชื่อโฟลเดอร์ แก้ได้) ระบบสร้างตอน
            ย่อรูปเป็น WebP แล้วอัปโหลดทุกหน้าให้ตามลำดับชื่อไฟล์ — ตอนที่เลขซ้ำกับที่มีอยู่จะถูกข้าม
          </p>
          <MangaImport titleId={id} existingNumbers={numbers} nextNumber={nextNumber} />
        </>
      ) : (
        <>
          <p className="text-muted mb-8 max-w-3xl">
            นำเข้านิยายทั้งเรื่องหรือหลายตอนในครั้งเดียวจากไฟล์ Word / ข้อความ หรือวางข้อความ ระบบแบ่งตอนให้
            แล้วให้คุณตรวจ แก้ชื่อ/เลขตอนก่อนบันทึก (ค่าเริ่มต้นเป็นฉบับร่าง ยังไม่เผยแพร่ให้ผู้อ่านเห็น)
          </p>
          <ImportWizard
            titleId={id}
            titleName={title.name}
            existingNumbers={numbers}
            nextNumber={nextNumber}
          />
        </>
      )}
    </section>
  );
}
