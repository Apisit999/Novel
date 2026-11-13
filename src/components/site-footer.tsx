import { SITE } from "@/lib/site";

export async function SiteFooter() {
  "use cache";
  return (
    <footer className="border-border text-muted border-t p-6 text-center text-sm">
      © {new Date().getFullYear()} {SITE.name}
    </footer>
  );
}
