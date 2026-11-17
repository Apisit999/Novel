import { describe, expect, it } from "vitest";
import { bangkokWeekday, parseWeekday, weekdayLabel } from "./schedule";

describe("schedule", () => {
  it("วันตามเวลาไทย: UTC เสาร์ 18:00 = ไทยอาทิตย์ 01:00", () => {
    expect(bangkokWeekday(new Date("2026-11-14T18:00:00Z"))).toBe(0); // 15 พ.ย. 2026 = อาทิตย์
    expect(bangkokWeekday(new Date("2026-11-16T00:00:00Z"))).toBe(1); // จันทร์ 07:00
  });
  it("parseWeekday รับเฉพาะ 0–6", () => {
    expect(parseWeekday("0")).toBe(0);
    expect(parseWeekday("6")).toBe(6);
    expect(parseWeekday("7")).toBeNull();
    expect(parseWeekday("")).toBeNull();
    expect(parseWeekday(undefined)).toBeNull();
  });
  it("ป้ายชื่อวัน", () => {
    expect(weekdayLabel(1)).toBe("จันทร์");
    expect(weekdayLabel(9)).toBe("");
  });
});

describe("thaiShortDate / isRecent", () => {
  it("formats Thai short date in Bangkok time with Buddhist year", async () => {
    const { thaiShortDate } = await import("./schedule");
    expect(thaiShortDate("2026-11-17T10:00:00Z")).toBe("17 พ.ย. 69");
    expect(thaiShortDate("2026-12-31T20:00:00Z")).toBe("1 ม.ค. 70"); // ข้ามเที่ยงคืนเวลาไทย
  });
  it("marks only episodes within the last 7 days (not future)", async () => {
    const { isRecent } = await import("./schedule");
    const now = Date.parse("2026-11-17T00:00:00Z");
    expect(isRecent("2026-11-12T00:00:00Z", now)).toBe(true);
    expect(isRecent("2026-11-01T00:00:00Z", now)).toBe(false);
    expect(isRecent("2026-11-20T00:00:00Z", now)).toBe(false);
    expect(isRecent(undefined, now)).toBe(false);
  });
});
