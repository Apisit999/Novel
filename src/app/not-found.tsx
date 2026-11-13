import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
      <p className="mt-4">
        <Link href="/" className="text-accent">
          กลับหน้าแรก
        </Link>
      </p>
    </section>
  );
}
