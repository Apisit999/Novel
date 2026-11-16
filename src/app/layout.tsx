import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/site";
import { publicEnv } from "@/lib/env";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav, BottomNavLinks } from "@/components/bottom-nav";
import { CONTENT_TYPES } from "@/content-types/registry";
import { LibrarySync } from "@/features/library/library-sync";
import { getCurrentUser } from "@/server/auth-db";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: SITE.name, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "th_TH",
    title: SITE.name,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
};

// ตั้งธีม/ฟอนต์/ขนาดตัวอักษรก่อนวาดหน้า เพื่อไม่ให้จอกะพริบ
const initScript = `
(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem('theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    d.dataset.theme = t;
    var f = localStorage.getItem('font');
    if (f) d.dataset.font = f;
    var s = localStorage.getItem('size');
    if (s) d.style.setProperty('--read-size', s + 'rem');
  } catch (e) {}
})();
`;

const NAV_ITEMS = [
  { href: "/", label: "หน้าแรก" },
  ...CONTENT_TYPES.map((t) => ({ href: `/browse/${t.id}`, label: t.label })),
  { href: "/schedule", label: "รายวัน" },
  { href: "/library", label: "ของฉัน" },
];

/** บอกตัวซิงก์ว่าใครล็อกอินอยู่ (ไม่แสดงอะไร) */
async function SessionSync() {
  const user = await getCurrentUser();
  return <LibrarySync userId={user?.id ?? null} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={SITE.lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="flex min-h-dvh flex-col pb-14 md:pb-0">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <SiteFooter />
        <Suspense fallback={null}>
          <SessionSync />
        </Suspense>
        <Suspense fallback={<BottomNavLinks items={NAV_ITEMS} pathname="" />}>
          <BottomNav items={NAV_ITEMS} />
        </Suspense>
      </body>
    </html>
  );
}
