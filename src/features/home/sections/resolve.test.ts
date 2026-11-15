import { describe, expect, it } from "vitest";
import { anchorsOf, resolveSections } from "./resolve";

const row = (id: string, kind: string, config: unknown = {}, title = "") => ({
  id,
  kind,
  title,
  config,
});

describe("resolveSections", () => {
  it("เติมค่าเริ่มต้นและคงลำดับ", () => {
    const out = resolveSections([row("1", "latest"), row("2", "spotlight")]);
    expect(out.map((s) => s.kind)).toEqual(["latest", "spotlight"]);
    expect(out[0].kind === "latest" && out[0].config.limit).toBe(12);
  });

  it("ข้ามส่วนที่ชนิดแปลกหรือ config ผิด แต่ไม่ทำให้ส่วนอื่นพัง", () => {
    const out = resolveSections([
      row("1", "unknown_kind"),
      row("2", "type_zone", { type: "comic" }),
      row("3", "latest"),
    ]);
    expect(out.map((s) => s.id)).toEqual(["3"]);
  });

  it("ไม่เหลือส่วนที่ใช้ได้เลย (หรือว่าง) → ใช้ผังเริ่มต้น", () => {
    for (const rows of [[], [row("1", "type_zone", { type: "x" })]]) {
      const out = resolveSections(rows);
      expect(out.length).toBeGreaterThan(3);
      expect(out[0].kind).toBe("spotlight");
    }
  });
});

describe("anchorsOf", () => {
  it("สร้างปุ่มลัดจากส่วนที่มีจุดยึด ไม่ซ้ำ", () => {
    const sections = resolveSections([
      row("1", "spotlight"),
      row("2", "top_ten"),
      row("3", "type_zone", { type: "novel" }),
      row("4", "type_zone", { type: "novel" }),
      row("5", "collection", { slug: "night-reads" }, "อ่านจบในคืนเดียว"),
    ]);
    expect(anchorsOf(sections).map((a) => [a.id, a.label])).toEqual([
      ["zone-top", "ยอดฮิต"],
      ["zone-novel", "นิยาย"],
      ["zone-c-night-reads", "อ่านจบในคืนเดียว"],
    ]);
  });
});
