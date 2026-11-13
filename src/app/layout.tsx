import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s | ${SITE.name}` },
  description: SITE.description,
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={SITE.lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
