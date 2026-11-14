import Link from "next/link";
import { SITE } from "@/lib/site";
import { CONTENT_TYPES } from "@/content-types/registry";
import { Suspense } from "react";
import { AccountButton, AccountButtonFallback } from "@/components/account-button";
import { ThemeToggle } from "@/components/theme-toggle";

const iconBtn =
  "border-border bg-surface text-foreground hover:border-accent flex h-12 w-12 items-center justify-center rounded-full border no-underline";

export function SiteHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="text-accent text-2xl font-bold no-underline">
          {SITE.name}
        </Link>
        <nav aria-label="หมวดเนื้อหา" className="ml-4 hidden gap-1 md:flex">
          {CONTENT_TYPES.map((t) => (
            <Link
              key={t.id}
              href={`/browse/${t.id}`}
              className="text-foreground hover:bg-background flex min-h-12 items-center rounded-full px-4 no-underline"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/search" aria-label="ค้นหา" className={iconBtn}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
          </Link>
          <Link href="/library" aria-label="เรื่องที่ชอบ" className={iconBtn}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
            </svg>
          </Link>
          <ThemeToggle />
          <Suspense fallback={<AccountButtonFallback />}>
            <AccountButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
