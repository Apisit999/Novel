import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TitleSummary } from "./catalog";
import { TitleCard } from "./title-card";

const base: TitleSummary = {
  slug: "x",
  type: "novel",
  name: "เรื่องทดสอบ",
  synopsis: "",
  status: "ongoing",
  access: "premium",
  tags: [],
  featured: false,
  coverKey: null,
};

describe("TitleCard ป้าย premium", () => {
  it("ไม่แสดงป้ายเมื่อ paywall ปิด (ช่วงเปิดฟรี)", () => {
    expect(renderToStaticMarkup(<TitleCard title={base} />)).not.toContain("Premium");
  });
  it("แสดงป้ายเมื่อ paywall เปิดและเรื่องเป็น premium", () => {
    expect(renderToStaticMarkup(<TitleCard title={base} showPremium />)).toContain("Premium");
  });
  it("ไม่แสดงป้ายกับเรื่องฟรี แม้ paywall เปิด", () => {
    const free = { ...base, access: "free" as const };
    expect(renderToStaticMarkup(<TitleCard title={free} showPremium />)).not.toContain("Premium");
  });
});
