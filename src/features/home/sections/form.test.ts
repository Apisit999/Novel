import { describe, expect, it } from "vitest";
import { configFromForm, parseSlugList } from "./form";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("parseSlugList", () => {
  it("แยกด้วยบรรทัด/จุลภาค/ช่องว่าง และตัดซ้ำ", () => {
    expect(parseSlugList("a, b\nc  a")).toEqual(["a", "b", "c"]);
    expect(parseSlugList("")).toEqual([]);
  });
});

describe("configFromForm", () => {
  it("ช่องตัวเลขว่าง = ใช้ค่าเริ่มต้น", () => {
    const r = configFromForm("type_zone", form({ type: "novel", limit: "" }));
    expect(r).toEqual({ ok: true, config: { type: "novel", limit: 6 } });
  });

  it("ค่านอกช่วง/ไม่ใช่ตัวเลข = ไม่ผ่าน", () => {
    expect(configFromForm("latest", form({ limit: "999" })).ok).toBe(false);
    expect(configFromForm("latest", form({ limit: "abc" })).ok).toBe(false);
  });

  it("spotlight แบบเลือกเอง รับรายการ slug", () => {
    const r = configFromForm("spotlight", form({ mode: "manual", slugs: "a\nb", limit: "2" }));
    expect(r).toEqual({ ok: true, config: { mode: "manual", slugs: ["a", "b"], limit: 2 } });
  });

  it("ชุดคัดสรรและแถบประกาศต้องกรอกช่องที่จำเป็น", () => {
    expect(configFromForm("collection", form({ collectionSlug: "" })).ok).toBe(false);
    expect(configFromForm("banner", form({ text: "", href: "/x" })).ok).toBe(false);
    expect(configFromForm("banner", form({ text: "ลดราคา", href: "javascript:1" })).ok).toBe(false);
    expect(configFromForm("banner", form({ text: "ลดราคา", href: "/browse/novel" })).ok).toBe(true);
  });
});
