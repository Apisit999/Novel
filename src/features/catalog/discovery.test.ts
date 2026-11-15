import { describe, expect, it } from "vitest";
import { latestSlugs, pickFeatured, resolveSlugs } from "./discovery";

describe("latestSlugs", () => {
  it("เรียงใหม่สุดก่อน เรื่องละครั้ง และข้ามเวลาเสีย", () => {
    expect(
      latestSlugs([
        { slug: "a", at: "2026-01-01T00:00:00Z" },
        { slug: "b", at: "2026-03-01T00:00:00Z" },
        { slug: "a", at: "2026-05-01T00:00:00Z" },
        { slug: "c", at: "not-a-date" },
      ]),
    ).toEqual(["a", "b"]);
  });
  it("ว่าง → ว่าง", () => expect(latestSlugs([])).toEqual([]));
});

describe("pickFeatured", () => {
  const t = (slug: string, featured: boolean) => ({ slug, featured });
  it("เลือกเฉพาะที่ติ๊กเด่น เรื่องที่อัปเดตล่าสุดก่อน", () => {
    const r = pickFeatured([t("a", false), t("b", true), t("c", true)], ["a", "c", "b"]);
    expect(r?.slug).toBe("c");
  });
  it("ไม่มีใครติ๊ก → ใช้เรื่องที่อัปเดตล่าสุด", () => {
    expect(pickFeatured([t("a", false), t("b", false)], ["b", "a"])?.slug).toBe("b");
  });
  it("ไม่มีเรื่องเลย → undefined", () => {
    expect(pickFeatured([], [])).toBeUndefined();
  });
  it("เรื่องที่ยังไม่มีตอนไม่พัง (เรียงท้ายสุด)", () => {
    expect(pickFeatured([t("a", true), t("b", true)], ["b"])?.slug).toBe("b");
  });
});

describe("resolveSlugs", () => {
  it("คงลำดับ และข้าม slug ที่ไม่มี", () => {
    const titles = [{ slug: "a" }, { slug: "b" }];
    expect(resolveSlugs(["b", "x", "a"], titles)).toEqual([{ slug: "b" }, { slug: "a" }]);
  });
});
