import { describe, expect, it } from "vitest";
import {
  countWords,
  episodeSchema,
  isoToThaiLocal,
  slugSchema,
  thaiLocalToIso,
  titleSchema,
} from "./schemas";

describe("slugSchema", () => {
  it("รับ slug ที่ถูกต้อง", () => {
    for (const ok of ["moonlit-garden", "a1", "novel-2"])
      expect(slugSchema.safeParse(ok).success).toBe(true);
  });
  it("ปฏิเสธ slug ที่ไม่ปลอดภัยสำหรับ URL", () => {
    for (const bad of ["", "a", "Moon", "มังกร", "a b", "-a", "a-", "a--b", "../x", "a/b"]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("titleSchema", () => {
  const base = {
    type: "novel",
    slug: "x-novel",
    name: "ชื่อ",
    synopsis: "",
    status: "ongoing",
    rating: "all",
    access: "free",
    published: false,
    featured: false,
    tags: "",
  };
  it("แท็ก: ตัดช่องว่าง ตัดซ้ำ ตัดค่าว่าง", () => {
    const r = titleSchema.parse({ ...base, tags: " แฟนตาซี, แอ็คชัน ,, แฟนตาซี " });
    expect(r.tags).toEqual(["แฟนตาซี", "แอ็คชัน"]);
  });
  it("ปฏิเสธชนิดที่ไม่มีอยู่และชื่อว่าง", () => {
    expect(titleSchema.safeParse({ ...base, type: "podcast" }).success).toBe(false);
    expect(titleSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });
});

describe("episodeSchema", () => {
  const base = {
    number: "3",
    name: "ตอน",
    access: "inherit",
    status: "draft",
    body: "x",
    en: "",
    enMachine: false,
    zh: "",
    zhMachine: true,
  };
  it("แปลงเลขตอนจากข้อความ", () => {
    expect(episodeSchema.parse(base).number).toBe(3);
  });
  it("ปฏิเสธเลขตอนไม่ถูกต้อง", () => {
    for (const n of ["0", "-1", "1.5", "abc"])
      expect(episodeSchema.safeParse({ ...base, number: n }).success).toBe(false);
  });
  it("ตั้งเวลาเผยแพร่ต้องมีวันเวลา", () => {
    expect(episodeSchema.safeParse({ ...base, status: "scheduled" }).success).toBe(false);
    expect(
      episodeSchema.safeParse({ ...base, status: "scheduled", publishAt: "2026-12-01T09:00" })
        .success,
    ).toBe(true);
  });
});

describe("เวลาไทย ↔ ISO", () => {
  it("09:00 เวลาไทย = 02:00 UTC", () => {
    expect(thaiLocalToIso("2026-12-01T09:00")).toBe("2026-12-01T02:00:00.000Z");
  });
  it("แปลงกลับได้ค่าเดิม (รวมกรณีข้ามวัน)", () => {
    for (const v of ["2026-12-01T09:00", "2026-12-31T23:30", "2027-01-01T00:15"]) {
      expect(isoToThaiLocal(thaiLocalToIso(v))).toBe(v);
    }
  });
  it("ค่าว่าง/ผิดรูปแบบ → null/ว่าง", () => {
    expect(thaiLocalToIso("")).toBeNull();
    expect(thaiLocalToIso("พรุ่งนี้")).toBeNull();
    expect(isoToThaiLocal(null)).toBe("");
  });
});

describe("countWords", () => {
  it("นับคำไทยและอังกฤษ", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("ฉันกินข้าว")).toBeGreaterThanOrEqual(3);
    expect(countWords("")).toBe(0);
  });
});
