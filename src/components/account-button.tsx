import Link from "next/link";
import { getCurrentUser } from "@/server/auth-db";

const iconBtn =
  "border-border bg-surface text-foreground hover:border-accent flex h-12 w-12 items-center justify-center rounded-full border no-underline";

function PersonIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

/** ตัวสำรองระหว่างเช็กสถานะล็อกอิน (และสำหรับหน้าที่ prerender ไว้ก่อน) */
export function AccountButtonFallback() {
  return (
    <Link href="/login" aria-label="เข้าสู่ระบบ" className={iconBtn}>
      <PersonIcon />
    </Link>
  );
}

export async function AccountButton() {
  const user = await getCurrentUser();
  return user ? (
    <Link
      href="/account"
      aria-label="บัญชีของฉัน"
      className={`${iconBtn} bg-accent text-accent-foreground`}
    >
      <PersonIcon />
    </Link>
  ) : (
    <AccountButtonFallback />
  );
}
