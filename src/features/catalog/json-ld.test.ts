import { describe, expect, it } from "vitest";
import { serializeJsonLd, titleJsonLd } from "./json-ld";
import type { TitleSummary } from "./catalog";

const base: TitleSummary = {
  slug: "moon",
  type: "novel",
  name: "ดวงจันทร์",
  synopsis: "เรื่องย่อ",
  status: "ongoing",
  access: "free",
  tags: ["รัก", "ดราม่า"],
  coverKey: null,
  featured: false,
  updateDay: null,
  rating: "all",
  author: null,
};

describe("titleJsonLd", () => {
  it("นิยาย = Book พร้อม url และคีย์เวิร์ด", () => {
    const d = titleJsonLd(base, "https://x.test");
    expect(d["@type"]).toBe("Book");
    expect(d.url).toBe("https://x.test/title/moon");
    expect(d.keywords).toBe("รัก, ดราม่า");
    expect("image" in d).toBe(false);
  });
  it("มังงะ = ComicSeries", () => {
    expect(titleJsonLd({ ...base, type: "manga" }, "https://x.test")["@type"]).toBe("ComicSeries");
  });
});

describe("serializeJsonLd", () => {
  it("กัน </script> หลุดออกจากแท็ก", () => {
    const s = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("JSON-LD ผู้แต่ง", () => {
  it("มี author เป็น Person เมื่อระบุชื่อ และไม่มีคีย์เมื่อไม่ระบุ", () => {
    expect(titleJsonLd({ ...base, author: "สมชาย ใจดี" }, "https://x.test")).toMatchObject({
      author: { "@type": "Person", name: "สมชาย ใจดี" },
    });
    expect(titleJsonLd(base, "https://x.test")).not.toHaveProperty("author");
  });
});
