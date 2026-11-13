"use client";

const THEMES = ["light", "sepia", "dark"] as const;

export function ThemeToggle() {
  function next() {
    const root = document.documentElement;
    const current = (root.dataset.theme ?? "light") as (typeof THEMES)[number];
    const idx = THEMES.indexOf(current);
    const nextTheme = THEMES[(idx + 1) % THEMES.length];
    root.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
  }

  return (
    <button
      type="button"
      onClick={next}
      aria-label="สลับธีม สว่าง ซีเปีย มืด"
      className="border-border bg-surface hover:border-accent cursor-pointer rounded-lg border px-4 py-1.5"
    >
      ธีม
    </button>
  );
}
