import { describe, expect, it } from "vitest";
import type { TitleSummary } from "./catalog";
import { compactCount, parseSort, sortTitles } from "./sort";

const t = (slug: string, name: string) => ({ slug, name }) as unknown as TitleSummary;
const list = [t("b", "ข"), t("a", "ก"), t("c", "ค")];

describe("sortTitles", () => {
  it("latest คงลำดับเดิม และไม่แก้อาร์เรย์ต้นฉบับ", () => {
    const out = sortTitles(list, "latest");
    expect(out.map((x) => x.slug)).toEqual(["b", "a", "c"]);
    expect(out).not.toBe(list);
  });
  it("popular เรียงตามยอด เท่ากันเรียงตามชื่อ", () => {
    expect(sortTitles(list, "popular", { c: 50, b: 10 }).map((x) => x.slug)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(sortTitles(list, "popular").map((x) => x.slug)).toEqual(["a", "b", "c"]);
  });
  it("name เรียงตามชื่อไทย", () => {
    expect(sortTitles(list, "name").map((x) => x.slug)).toEqual(["a", "b", "c"]);
  });
  it("parseSort ค่าแปลก → latest", () => {
    expect(parseSort("popular")).toBe("popular");
    expect(parseSort("xx")).toBe("latest");
    expect(parseSort(undefined)).toBe("latest");
  });
  it("compactCount", () => {
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1234)).toBe("1.2K");
    expect(compactCount(2_000_000)).toBe("2M");
  });
});

describe("เรียงชื่อไทยแบบพจนานุกรม", () => {
  it("สระนำ เ แ โ ใ ไ เรียงตามพยัญชนะตัวถัดไป (ICU จัดการให้)", () => {
    const names = ["ซซซ", "เรื่อง", "คน", "แมว", "ไก่", "ลม", "กา"].map((n, i) => t(String(i), n));
    // ก(กา,ไก่) ค ซ ม(แมว) ร(เรื่อง) ล
    expect(sortTitles(names, "name").map((x) => x.name)).toEqual([
      "กา",
      "ไก่",
      "คน",
      "ซซซ",
      "แมว",
      "เรื่อง",
      "ลม",
    ]);
  });
});
