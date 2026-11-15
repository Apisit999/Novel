import { Suspense } from "react";
import { signInWithGoogle } from "@/features/auth/actions";
import { GoogleButton } from "@/features/auth/google-button";
import { LoginForm } from "@/features/auth/login-form";
import { safeNext } from "@/features/auth/safe-next";
import { getFlags } from "@/lib/flags";
import { SITE } from "@/lib/site";

export const metadata = { title: "เข้าสู่ระบบ", robots: { index: false } };

const ERRORS: Record<string, string> = {
  denied: "คุณยกเลิกการเข้าสู่ระบบ กดปุ่มด้านล่างเพื่อลองอีกครั้งได้เลย",
  expired: "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณากดขอลิงก์ใหม่ (ลิงก์ในอีเมลใช้ได้ครั้งเดียว)",
  browser: "กรุณาเปิดลิงก์ในเบราว์เซอร์เดียวกับที่กดขอลิงก์ (และใช้ที่อยู่เว็บเดียวกัน) แล้วลองอีกครั้ง",
  "provider-failed": "สมัคร/เข้าสู่ระบบไม่สำเร็จจากฝั่งผู้ให้บริการ กรุณาลองใหม่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแล",
  provider: "ขณะนี้ยังเข้าสู่ระบบด้วย Google ไม่ได้ กรุณาลองใหม่อีกครั้งภายหลัง",
};
const GENERIC_ERROR = "เข้าสู่ระบบไม่สำเร็จ ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง";

async function LoginBody({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  const safe = safeNext(typeof next === "string" ? next : undefined);
  const emailLogin = getFlags().emailLoginEnabled;

  return (
    <>
      {error && (
        <p
          role="alert"
          className="border-accent text-accent mb-6 rounded-2xl border-2 p-4 font-bold"
        >
          {(typeof error === "string" && ERRORS[error]) || GENERIC_ERROR}
        </p>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={safe} />
        <GoogleButton />
      </form>

      {emailLogin && (
        <>
          <div className="text-muted my-6 flex items-center gap-4 text-sm" aria-hidden="true">
            <span className="bg-border h-px flex-1" />
            หรือ
            <span className="bg-border h-px flex-1" />
          </div>
          <LoginForm next={safe} />
        </>
      )}
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <section className="mx-auto max-w-md py-6 sm:py-12">
      <div className="bg-surface border-border rounded-3xl border p-6 shadow-sm sm:p-10">
        <p className="text-accent text-center text-3xl font-bold">{SITE.name}</p>
        <h1 className="mt-6 text-center text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="text-muted mt-2 mb-8 text-center">บันทึกเรื่องที่ชอบ และอ่านต่อจากที่ค้างไว้ได้ทุกเครื่อง</p>

        <Suspense fallback={<p className="text-muted text-center">กำลังโหลด…</p>}>
          <LoginBody searchParams={props.searchParams} />
        </Suspense>

        <p className="text-muted mt-8 text-center text-sm leading-relaxed">
          {getFlags().emailLoginEnabled
            ? "เราใช้บัญชี Google หรืออีเมลเพื่อยืนยันตัวตนเท่านั้น (ใช้อีเมลเดียวกันจะเป็นบัญชีเดียวกัน) จะไม่เห็นรหัสผ่านของคุณ และไม่โพสต์หรือส่งอะไรในนามคุณ"
            : "เราใช้บัญชี Google เพื่อยืนยันตัวตนเท่านั้น จะไม่เห็นรหัสผ่านของคุณ และไม่โพสต์หรือส่งอะไรในนามคุณ"}
          ผู้ที่ยังไม่มีบัญชีจะถูกสร้างให้อัตโนมัติ
        </p>
      </div>
    </section>
  );
}
