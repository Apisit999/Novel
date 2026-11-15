import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, parseConfig, SECTION_KINDS } from "./config";

describe("parseConfig", () => {
  it("เติมค่าเริ่มต้นให้ config ว่าง", () => {
    const r = parseConfig("spotlight", {});
    expect(r).toEqual({ ok: true, config: { mode: "auto", slugs: [], limit: 3 } });
  });

  it("type_zone ต้องมีประเภทที่ถูกต้อง", () => {
    expect(parseConfig("type_zone", { type: "comic" }).ok).toBe(false);
    expect(parseConfig("type_zone", { type: "manga", limit: 8 }).ok).toBe(true);
  });

  it("จำกัดช่วงของ limit", () => {
    expect(parseConfig("spotlight", { limit: 0 }).ok).toBe(false);
    expect(parseConfig("spotlight", { limit: 7 }).ok).toBe(false);
    expect(parseConfig("latest", { limit: 100 }).ok).toBe(false);
  });

  it("slug ต้องเป็นรูปแบบที่ใช้ใน URL", () => {
    expect(parseConfig("top_ten", { source: "manual", slugs: ["ok-slug"] }).ok).toBe(true);
    expect(parseConfig("top_ten", { source: "manual", slugs: ["Bad Slug"] }).ok).toBe(false);
  });

  it("แถบประกาศ: ลิงก์ต้องเป็น path ในเว็บหรือ https เท่านั้น", () => {
    const ok = (href: string) => parseConfig("banner", { text: "ลด 50%", href }).ok;
    expect(ok("/browse/novel")).toBe(true);
    expect(ok("https://example.com/promo")).toBe(true);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("//evil.example")).toBe(false);
    expect(ok("http://example.com")).toBe(false);
  });

  it("config ที่ไม่ใช่อ็อบเจ็กต์ (null) ถือเป็นว่าง", () => {
    expect(parseConfig("latest", null).ok).toBe(true);
  });
});

describe("DEFAULT_SECTIONS", () => {
  it("ทุกส่วนในผังเริ่มต้นผ่านการตรวจของตัวเอง", () => {
    for (const s of DEFAULT_SECTIONS) {
      expect(SECTION_KINDS).toContain(s.kind);
      expect(parseConfig(s.kind, s.config).ok).toBe(true);
    }
  });
});
