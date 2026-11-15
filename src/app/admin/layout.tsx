import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";

export const metadata = { title: "หลังบ้าน", robots: { index: false, follow: false } };

// หลังบ้านรอเซิร์ฟเวอร์ตรวจสิทธิ์ให้เสร็จก่อนส่งอะไรออกไป (ไม่สตรีมเปลือกหน้า) →
// ผู้ที่ไม่ใช่แอดมินได้ 404 / redirect จริง และไม่เห็นแม้แต่แถบเมนูหลังบ้าน
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin(); // ทุกหน้าและ action ตรวจซ้ำเองอีกชั้น; ชั้นสุดท้ายคือ RLS ในฐานข้อมูล

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="เมนูหลังบ้าน"
        className="border-border flex flex-wrap items-center gap-4 border-b pb-3"
      >
        <span className="font-bold">หลังบ้าน</span>
        <Link href="/admin" className="text-accent font-bold no-underline">
          เรื่องทั้งหมด
        </Link>
        <Link href="/admin/home" className="text-accent font-bold no-underline">
          จัดหน้าแรก
        </Link>
        <Link href="/admin/titles/new" className="text-accent font-bold no-underline">
          + เรื่องใหม่
        </Link>
        <Link href="/" className="text-muted ml-auto no-underline">
          ดูหน้าเว็บ →
        </Link>
      </nav>
      {children}
    </div>
  );
}
