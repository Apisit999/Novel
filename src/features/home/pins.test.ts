import { describe, expect, it } from "vitest";
import { activePins, boostRanking, spotlightOrder, withoutHidden, type Pin } from "./pins";

const now = new Date("2026-11-15T12:00:00Z");
const pin = (slug: string, placement: Pin["placement"], extra: Partial<Pin> = {}): Pin => ({
  slug,
  placement,
  position: 0,
  startsAt: null,
  endsAt: null,
  ...extra,
});
const t = (slug: string) => ({ slug });

describe("activePins", () => {
  it("ไม่ตั้งเวลา = ใช้ได้เสมอ; ยังไม่ถึงเวลา/หมดเวลาแล้ว = ไม่ใช้", () => {
    const pins = [
      pin("always", "spotlight"),
      pin("future", "spotlight", { startsAt: "2026-12-01T00:00:00Z" }),
      pin("expired", "spotlight", { endsAt: "2026-11-01T00:00:00Z" }),
      pin("inside", "spotlight", {
        startsAt: "2026-11-01T00:00:00Z",
        endsAt: "2026-12-01T00:00:00Z",
      }),
    ];
    expect(activePins(pins, now).map((p) => p.slug)).toEqual(["always", "inside"]);
  });

  it("เวลาสิ้นสุดเป็นขอบเปิด (เท่ากับ now = หมดแล้ว)", () => {
    expect(activePins([pin("x", "hidden", { endsAt: now.toISOString() })], now)).toHaveLength(0);
  });

  it("เรียงตาม position", () => {
    const out = activePins(
      [pin("b", "spotlight", { position: 2 }), pin("a", "spotlight", { position: 1 })],
      now,
    );
    expect(out.map((p) => p.slug)).toEqual(["a", "b"]);
  });
});

describe("withoutHidden", () => {
  it("ตัดเฉพาะเรื่องที่ปักซ่อน", () => {
    const out = withoutHidden([t("a"), t("b")], [pin("a", "hidden"), pin("b", "spotlight")]);
    expect(out.map((x) => x.slug)).toEqual(["b"]);
  });
});

describe("spotlightOrder", () => {
  const pool = [t("a"), t("b"), t("c"), t("d")];
  it("เรื่องที่ปักขึ้นก่อน แล้วเติมด้วย base ไม่ซ้ำ ตัดที่ limit", () => {
    const out = spotlightOrder(
      [t("a"), t("b")],
      pool,
      [pin("d", "spotlight"), pin("a", "spotlight", { position: 1 })],
      3,
    );
    expect(out.map((x) => x.slug)).toEqual(["d", "a", "b"]);
  });
  it("ปักเรื่องที่ไม่มีใน pool (ถูกซ่อน/ลบ) → ข้าม", () => {
    expect(spotlightOrder([t("a")], pool, [pin("zzz", "spotlight")], 3).map((x) => x.slug)).toEqual(
      ["a"],
    );
  });
  it("ไม่มีปัก = base ตามเดิม", () => {
    expect(spotlightOrder([t("b"), t("a")], pool, [], 5).map((x) => x.slug)).toEqual(["b", "a"]);
  });
});

describe("boostRanking", () => {
  it("เรื่องที่ถูกดันขึ้นอันดับต้น ที่เหลือตามเดิม", () => {
    const pool = [t("a"), t("b"), t("c")];
    expect(
      boostRanking([t("a"), t("b")], pool, [pin("c", "top_ten_boost")]).map((x) => x.slug),
    ).toEqual(["c", "a", "b"]);
  });
});
