import Link from "next/link";
import { SITE } from "@/lib/site";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="text-foreground text-lg font-bold no-underline">
          {SITE.name}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
