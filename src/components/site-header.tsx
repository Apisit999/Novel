import Link from "next/link";
import { SITE } from "@/lib/site";
import { CONTENT_TYPES } from "@/content-types/registry";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-foreground text-lg font-bold no-underline">
            {SITE.name}
          </Link>
          <nav aria-label="หมวดเนื้อหา" className="flex gap-4">
            {CONTENT_TYPES.map((t) => (
              <Link
                key={t.id}
                href={`/browse/${t.id}`}
                className="text-muted hover:text-accent no-underline"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
