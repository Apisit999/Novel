import { describe, expect, it } from "vitest";
import { searchIn, tokenize } from "./search";

const items = [
  { name: "ตำนานดาบวิญญาณ", synopsis: "นักดาบหนุ่มออกผจญภัย", tags: ["แฟนตาซี", "ผจญภัย"] },
  { name: "สวนจันทร์เจ้า", synopsis: "ความลับของสวนเก่า ตำนานดาบเล่มหนึ่ง", tags: ["ลึกลับ"] },
  { name: "Moonlit Garden", synopsis: "A quiet mystery", tags: ["Mystery"] },
];

describe("tokenize", () => {
  it("ตัดคำไทยและทิ้งช่องว่าง", () => {
    expect(tokenize("ตำนานดาบ แฟนตาซี")).toEqual(["ตำนาน", "ดาบ", "แฟนตาซี"]);
  });
  it("คำค้นว่างหรือมีแต่เครื่องหมาย → ไม่มี token", () => {
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("!!!")).toEqual([]);
  });
  it("จำกัดไม่เกิน 8 คำ", () => {
    expect(tokenize("a b c d e f g h i j")).toHaveLength(8);
  });
});

describe("searchIn", () => {
  it("เจอจากชื่อโดยไม่ต้องเว้นวรรค และเรียงชื่อก่อนเรื่องย่อ", () => {
    expect(searchIn(items, "ตำนานดาบ").map((t) => t.name)).toEqual(["ตำนานดาบวิญญาณ", "สวนจันทร์เจ้า"]);
  });
  it("หลายคำต้องเจอครบทุกคำ", () => {
    expect(searchIn(items, "ดาบ แฟนตาซี").map((t) => t.name)).toEqual(["ตำนานดาบวิญญาณ"]);
    expect(searchIn(items, "ดาบ ลึกลับ").map((t) => t.name)).toEqual(["สวนจันทร์เจ้า"]);
  });
  it("ไม่สนตัวพิมพ์เล็ก/ใหญ่ และค้นแท็กได้", () => {
    expect(searchIn(items, "MOONLIT")).toHaveLength(1);
    expect(searchIn(items, "mystery")).toHaveLength(1);
  });
  it("ไม่เจอ / คำค้นว่าง → ว่าง", () => {
    expect(searchIn(items, "ไม่มีแน่นอน")).toEqual([]);
    expect(searchIn(items, "")).toEqual([]);
  });
});
