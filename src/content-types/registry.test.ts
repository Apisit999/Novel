import { describe, expect, it } from "vitest";
import { CONTENT_TYPES, getContentType } from "./registry";

describe("content type registry", () => {
  it("มี novel, manga, video", () => {
    expect(CONTENT_TYPES.map((t) => t.id)).toEqual(["novel", "manga", "video"]);
  });

  it("id ไม่ซ้ำกัน", () => {
    const ids = CONTENT_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ทุกประเภทกรอกข้อมูลครบ", () => {
    for (const t of CONTENT_TYPES) {
      expect(t.label).toBeTruthy();
      expect(t.episodeNoun).toBeTruthy();
      expect(t.verb).toBeTruthy();
    }
  });

  it("getContentType คืน undefined เมื่อไม่รู้จัก", () => {
    expect(getContentType("novel")?.label).toBe("นิยาย");
    expect(getContentType("podcast")).toBeUndefined();
  });
});
