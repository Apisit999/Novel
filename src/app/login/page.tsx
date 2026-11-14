import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { safeNext } from "@/features/auth/safe-next";

export const metadata = { title: "เข้าสู่ระบบ", robots: { index: false } };

async function LoginBody({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && (
        <p
          role="alert"
          className="border-accent text-accent mb-6 rounded-2xl border-2 p-4 font-bold"
        >
          ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่
        </p>
      )}
      <LoginForm next={safeNext(typeof next === "string" ? next : undefined)} />
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ / สมัครสมาชิก</h1>
      <p className="text-muted mt-2 mb-6">
        ไม่ต้องจำรหัสผ่าน — กรอกอีเมล แล้วเราจะส่งลิงก์เข้าสู่ระบบให้ ผู้ที่ยังไม่มีบัญชีจะถูกสร้างให้อัตโนมัติ
      </p>
      <Suspense fallback={<p className="text-muted">กำลังโหลด…</p>}>
        <LoginBody searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
