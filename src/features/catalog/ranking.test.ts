import { describe, expect, it } from "vitest";
import { bangkokDayAgo, rankMovement, trendingSlugs } from "./ranking";

const now = new Date("2026-11-15T09:00:00+07:00");

describe("trendingSlugs", () => {
  it("ยอดช่วงนี้ชนะยอดเก่าที่มากกว่า (ฮิตจริง ไม่ใช่ยอดสะสม)", () => {
    const out = trendingSlugs(
      [
        { slug: "old", day: "2026-11-02", count: 100 }, // เก่า 13 วัน → น้ำหนักน้อยมาก
        { slug: "new", day: "2026-11-15", count: 30 },
      ],
      now,
    );
    expect(out).toEqual(["new", "old"]);
  });

  it("รวมยอดหลายวันของเรื่องเดียวกัน", () => {
    const out = trendingSlugs(
      [
        { slug: "a", day: "2026-11-15", count: 10 },
        { slug: "a", day: "2026-11-14", count: 10 },
        { slug: "b", day: "2026-11-15", count: 15 },
      ],
      now,
    );
    expect(out[0]).toBe("a");
  });

  it("ข้ามยอดที่เก่ากว่าหน้าต่างเวลา และยอด 0", () => {
    const out = trendingSlugs(
      [
        { slug: "ancient", day: "2026-09-01", count: 9999 },
        { slug: "zero", day: "2026-11-15", count: 0 },
        { slug: "ok", day: "2026-11-14", count: 1 },
      ],
      now,
    );
    expect(out).toEqual(["ok"]);
  });

  it("เรื่องที่มีตอนใหม่ได้โบนัสเล็กน้อย", () => {
    const rows = [
      { slug: "plain", day: "2026-11-15", count: 100 },
      { slug: "fresh", day: "2026-11-15", count: 90 },
    ];
    expect(trendingSlugs(rows, now)[0]).toBe("plain");
    expect(trendingSlugs(rows, now, { fresh: ["fresh"] })[0]).toBe("fresh");
  });

  it("คะแนนเท่ากันเรียงตาม slug (ผลคงที่)", () => {
    const out = trendingSlugs(
      [
        { slug: "b", day: "2026-11-15", count: 5 },
        { slug: "a", day: "2026-11-15", count: 5 },
      ],
      now,
    );
    expect(out).toEqual(["a", "b"]);
  });

  it("วันที่เสียหรืออยู่ในอนาคตไม่ทำให้พัง", () => {
    const out = trendingSlugs(
      [
        { slug: "bad", day: "not-a-day", count: 5 },
        { slug: "future", day: "2026-12-31", count: 5 },
      ],
      now,
    );
    expect(out).toEqual(["future"]);
  });
});

describe("bangkokDayAgo", () => {
  it("ใช้วันตามเวลาไทย (ตี 1 ไทย = ยังเป็นวันก่อนหน้าตาม UTC)", () => {
    expect(bangkokDayAgo(new Date("2026-11-14T18:30:00Z"), 0)).toBe("2026-11-15");
    expect(bangkokDayAgo(new Date("2026-11-15T09:00:00+07:00"), 14)).toBe("2026-11-01");
  });
});

describe("rankMovement", () => {
  const now = new Date("2026-11-16T05:00:00Z"); // จันทร์ 16 พ.ย. 12:00 ไทย
  it("ขึ้น/ลง/เข้าใหม่ เทียบอันดับเมื่อวาน", () => {
    const rows = [
      { slug: "a", day: "2026-11-15", count: 100 },
      { slug: "b", day: "2026-11-15", count: 50 },
      // วันนี้ b พุ่งแซง a และ c เข้าใหม่
      { slug: "b", day: "2026-11-16", count: 500 },
      { slug: "c", day: "2026-11-16", count: 20 },
    ];
    const m = rankMovement(rows, now);
    expect(m.get("b")).toBe(1); // เมื่อวานที่ 2 → วันนี้ที่ 1
    expect(m.get("a")).toBe(-1);
    expect(m.get("c")).toBe("new");
  });
  it("ไม่มียอดเมื่อวานเลย → ไม่แสดงการขยับ", () => {
    expect(rankMovement([{ slug: "a", day: "2026-11-16", count: 5 }], now).size).toBe(0);
  });
});
