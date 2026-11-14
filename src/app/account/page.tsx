import { redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteAccount, signOut } from "@/features/auth/actions";
import { Avatar, profileOf } from "@/features/auth/avatar";
import { getCurrentUser } from "@/server/auth-db";

export const metadata = { title: "บัญชีของฉัน", robots: { index: false } };

async function AccountBody({
  searchParams,
}: {
  searchParams: PageProps<"/account">["searchParams"];
}) {
  const [user, { error }] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login?next=/account");
  const profile = profileOf(user);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} picture={profile.picture} size={64} />
        <div>
          <p className="text-xl font-bold">{profile.name}</p>
          <p className="text-muted">{user.email}</p>
          <p className="text-muted text-sm">
            เข้าสู่ระบบด้วย {profile.provider === "google" ? "Google" : "อีเมล"}
          </p>
        </div>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="border-border bg-surface min-h-12 cursor-pointer rounded-full border px-8 font-bold"
        >
          ออกจากระบบ
        </button>
      </form>

      <section aria-labelledby="delete-h" className="border-border rounded-2xl border p-5">
        <h2 id="delete-h" className="text-xl font-bold">
          ลบบัญชี
        </h2>
        <p className="text-muted mt-2">
          การลบจะลบบัญชีและข้อมูลทั้งหมดของคุณถาวร ได้แก่ เรื่องที่ชอบ และตำแหน่งที่อ่านค้าง ไม่สามารถกู้คืนได้
        </p>
        {error === "confirm" && (
          <p role="alert" className="text-accent mt-3 font-bold">
            กรุณาติ๊กยืนยันก่อนลบบัญชี
          </p>
        )}
        {error === "failed" && (
          <p role="alert" className="text-accent mt-3 font-bold">
            ลบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </p>
        )}
        <form action={deleteAccount} className="mt-4 flex flex-col gap-4">
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" name="confirm" className="h-6 w-6" />
            <span>ฉันเข้าใจและต้องการลบบัญชีถาวร</span>
          </label>
          <button
            type="submit"
            className="border-accent text-accent min-h-12 cursor-pointer self-start rounded-full border-2 px-8 font-bold"
          >
            ลบบัญชีของฉัน
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AccountPage(props: PageProps<"/account">) {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">บัญชีของฉัน</h1>
      <Suspense fallback={<p className="text-muted">กำลังโหลด…</p>}>
        <AccountBody searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
