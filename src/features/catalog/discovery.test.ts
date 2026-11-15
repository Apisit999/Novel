import { describe, expect, it } from "vitest";
import { latestSlugs, pickFeatured, pickFeaturedList, resolveSlugs, topTagRows } from "./discovery";

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

describe("topTagRows", () => {
  const t = (name: string, tags: string[]) => ({ name, tags });
  const titles = [
    t("1", ["แฟนตาซี", "ผจญภัย"]),
    t("2", ["แฟนตาซี"]),
    t("3", ["แฟนตาซี", "ผจญภัย"]),
    t("4", ["ลึกลับ"]),
  ];
  it("แท็กที่มีเรื่องมากสุดก่อน และข้ามแท็กที่มีเรื่องเดียว", () => {
    const rows = topTagRows(titles);
    expect(rows.map((r) => r.tag)).toEqual(["แฟนตาซี", "ผจญภัย"]);
    expect(rows[0].titles).toHaveLength(3);
  });
  it("จำกัดจำนวนแถวและจำนวนเรื่องต่อแถว", () => {
    const rows = topTagRows(titles, { maxRows: 1, perRow: 2 });
    expect(rows).toHaveLength(1);
    expect(rows[0].titles).toHaveLength(2);
  });
  it("แท็กซ้ำในเรื่องเดียวไม่นับสองครั้ง / ไม่มีเรื่อง → ว่าง", () => {
    expect(topTagRows([t("a", ["x", "x"]), t("b", ["y"])])).toEqual([]);
    expect(topTagRows([])).toEqual([]);
  });
});

describe("pickFeaturedList", () => {
  const t = (slug: string, featured = false) => ({ slug, featured });
  const titles = [t("a"), t("b", true), t("c"), t("d", true)];

  it("เรื่องที่ติ๊กมาก่อน (อัปเดตล่าสุดก่อน) แล้วเติมด้วยเรื่องอื่นที่อัปเดตล่าสุด", () => {
    expect(pickFeaturedList(titles, ["c", "d", "a", "b"], 3).map((x) => x.slug)).toEqual([
      "d",
      "b",
      "c",
    ]);
  });
  it("ไม่มีใครติ๊ก = ใช้เรื่องที่อัปเดตล่าสุด และไม่เกิน limit", () => {
    expect(pickFeaturedList([t("a"), t("b")], ["b", "a"], 1).map((x) => x.slug)).toEqual(["b"]);
  });
  it("ไม่ซ้ำเรื่อง", () => {
    const slugs = pickFeaturedList(titles, [], 10).map((x) => x.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
