import type { TitleType } from "./catalog";

/** สีประจำประเภท — ค่าจริงอยู่ในธีม (globals.css) จึงเปลี่ยนตามธีมสว่าง/ซีเปีย/มืดเอง */
function tone(v: string) {
  return {
    accent: `var(${v})`,
    fg: "var(--type-fg)",
    /** พื้นโซน: สีประเภทจาง ๆ ผสมกับสีพื้นผิวของธีม */
    tint: `color-mix(in srgb, var(${v}) 9%, var(--surface))`,
  };
}

export const TYPE_STYLE: Record<TitleType, { accent: string; fg: string; tint: string }> = {
  novel: tone("--type-novel"),
  manga: tone("--type-manga"),
  video: tone("--type-video"),
};
