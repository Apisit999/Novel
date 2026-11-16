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
  updateDay: null,
  rating: "all",
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

describe("TitleCard ป้ายเรตอายุ", () => {
  it("ทุกวัย: ไม่มีป้าย", () => {
    expect(renderToStaticMarkup(<TitleCard title={base} />)).not.toContain("เรตอายุ");
  });
  it("13+/18+: มีป้ายและข้อความสำหรับโปรแกรมอ่านหน้าจอ", () => {
    const html = renderToStaticMarkup(<TitleCard title={{ ...base, rating: "18" }} />);
    expect(html).toContain("18+");
    expect(html).toContain("เรตอายุ 18 ปีขึ้นไป");
    expect(renderToStaticMarkup(<TitleCard title={{ ...base, rating: "13" }} />)).toContain("13+");
  });
});
