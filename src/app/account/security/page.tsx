import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "@/features/auth/safe-next";
import { MfaPanel } from "@/features/auth/mfa-panel";
import { getCurrentUser } from "@/server/auth-db";

export const metadata = { title: "ความปลอดภัยของบัญชี", robots: { index: false } };

async function Body({
  searchParams,
}: {
  searchParams: PageProps<"/account/security">["searchParams"];
}) {
  const [user, q] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login?next=/account/security");
  const mode = q.challenge ? "challenge" : q.enroll ? "enroll" : null;
  return (
    <MfaPanel
      mode={mode}
      next={safeNext(typeof q.next === "string" ? q.next : undefined, "/account")}
    />
  );
}

export default function SecurityPage(props: PageProps<"/account/security">) {
  return (
    <section>
      <p className="text-muted text-sm">
        <Link href="/account">← บัญชีของฉัน</Link>
      </p>
      <h1 className="mt-1 mb-6 text-2xl font-bold">ความปลอดภัยของบัญชี</h1>
      <Suspense fallback={<p className="text-muted">กำลังโหลด…</p>}>
        <Body searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
