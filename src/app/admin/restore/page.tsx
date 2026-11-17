import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";
import { RestoreWizard } from "@/features/export/restore-wizard";

export const metadata = { title: "กู้คืนจากไฟล์สำรอง" };

export default async function RestorePage() {
  await requireAdmin();
  return (
    <section>
      <p className="text-muted text-sm">
        <Link href="/admin">← เรื่องทั้งหมด</Link>
      </p>
      <h1 className="mt-1 mb-2 text-2xl font-bold">กู้คืนจากไฟล์สำรอง</h1>
      <p className="text-muted mb-8 max-w-3xl">
        อัปโหลดไฟล์ .zip ที่ได้จาก “สำรองนิยายทั้งหมด” ระบบสร้างเรื่องที่หายไปกลับมาพร้อมตอน สถานะ สิทธิ์ เวลาเผยแพร่
        และคำแปล โดยไม่เขียนทับของที่มีอยู่แล้ว
      </p>
      <RestoreWizard />
    </section>
  );
}
