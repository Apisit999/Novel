import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/admin/guard";
import { ReplaceForm } from "@/features/admin/replace-form";

const UUID = /^[0-9a-f-]{36}$/i;

export const metadata = { title: "ค้นหา-แทนที่ทั้งเรื่อง" };

export default async function ReplacePage({ params }: PageProps<"/admin/titles/[id]/replace">) {
  const [{ db }, { id }] = await Promise.all([requireAdmin(), params]);
  if (!UUID.test(id)) notFound();
  const { data: title } = await db
    .from("titles")
    .select("id, name, type")
    .eq("id", id)
    .maybeSingle();
  if (!title || title.type !== "novel") notFound();

  return (
    <section>
      <p className="text-muted text-sm">
        <Link href={`/admin/titles/${id}`}>← {title.name}</Link>
      </p>
      <h1 className="mt-1 mb-2 text-2xl font-bold">ค้นหา-แทนที่ทั้งเรื่อง</h1>
      <p className="text-muted mb-8 max-w-3xl">
        แก้คำ/ชื่อตัวละครที่พิมพ์ผิดในเนื้อหาทุกตอนพร้อมกัน (ค้นหาตรงตัว ไม่ใช่ regex) ดูตัวอย่างก่อนเสมอ และแนะนำให้{" "}
        <a className="underline" href={`/admin/titles/${id}/export?format=md`}>
          ส่งออกสำรอง .md
        </a>{" "}
        ไว้ก่อน เพราะย้อนกลับไม่ได้
      </p>
      <ReplaceForm titleId={id} />
    </section>
  );
}
