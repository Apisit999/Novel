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
