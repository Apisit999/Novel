"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BottomNavItem {
  href: string;
  label: string;
}

/** เมนูล่างสำหรับมือถือ (ซ่อนตั้งแต่ md ขึ้นไป ที่ใช้เมนูบน) — ไม่ผูกกับ URL เพื่อใช้เป็นตัวสำรองระหว่างโหลดได้ */
export function BottomNavLinks({ items, pathname }: { items: BottomNavItem[]; pathname: string }) {
  return (
    <nav
      aria-label="เมนูหลัก"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-[1240px]">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center px-1 text-center text-sm no-underline ${
                  active ? "text-accent font-bold" : "text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  return <BottomNavLinks items={items} pathname={usePathname()} />;
}
