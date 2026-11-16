import { describe, expect, it } from "vitest";
import {
  assignNumbers,
  chineseToNumber,
  duplicateNumbers,
  normalizeText,
  parseHeading,
  splitChapters,
} from "./split-chapters";

const body = (n: number) => `เนื้อหาตอนที่ ${n} `.repeat(30);

describe("parseHeading", () => {
  it.each([
    ["ตอนที่ 1", 1],
    ["ตอนที่ ๑๒ การเดินทาง", 12],
    ["บทที่ 5: จุดเริ่มต้น", 5],
    ["บทที่5", 5],
    ["ตอน 7", 7],
    ["Chapter 12", 12],
    ["CHAPTER 3 - The Gate", 3],
    ["Ch.4", 4],
    ["Episode 9", 9],
    ["第12章 风起", 12],
    ["第十二回", 12],
    ["# ตอนที่ 2", 2],
    ["## Chapter 8", 8],
  ])("รู้จัก %s → เลข %d", (line, n) => {
    expect(parseHeading(line)?.number).toBe(n);
  });

  it.each([
    "ตอนนี้ฝนตกหนักมาก", // "ตอน" นำหน้าแต่ไม่ใช่หัวตอน
    "บทสนทนาของเขากับเธอ",
    "ฉันอ่านบทที่ 5 ของหนังสือเมื่อวาน แล้วก็ไปนอน", // มีเลขแต่ไม่ได้ขึ้นต้นหัวตอน
    "Chapters of my life",
    "",
    "ตอนที่ 0", // เลข 0 ไม่ใช่ตอน
    "ตอนที่ " + "ก".repeat(200), // ยาวเกินหัวตอน
  ])("ไม่ใช่หัวตอน: %s", (line) => {
    expect(parseHeading(line)).toBeNull();
  });
});

describe("chineseToNumber", () => {
  it("อ่านเลขจีนพื้นฐาน", () => {
    expect(chineseToNumber("十")).toBe(10);
    expect(chineseToNumber("十二")).toBe(12);
    expect(chineseToNumber("二十")).toBe(20);
    expect(chineseToNumber("一百零五")).toBe(105);
    expect(chineseToNumber("三")).toBe(3);
    expect(chineseToNumber("abc")).toBeNull();
  });
});

describe("normalizeText", () => {
  it("ตัด BOM/ช่องว่างท้ายบรรทัด/อักขระความกว้างศูนย์ และยุบบรรทัดว่าง", () => {
    const out = normalizeText("﻿สวัสดี​  \r\n\r\n\r\n\r\nลาก่อน", "keep");
    expect(out).toBe("สวัสดี\n\nลาก่อน");
  });

  it("auto: ข้อความหนึ่งบรรทัดต่อหนึ่งย่อหน้า → คั่นด้วยบรรทัดว่างให้ทุกบรรทัด", () => {
    expect(normalizeText("ย่อหน้า ก\nย่อหน้า ข\nย่อหน้า ค", "auto")).toBe(
      "ย่อหน้า ก\n\nย่อหน้า ข\n\nย่อหน้า ค",
    );
  });

  it("auto: ข้อความที่คั่นย่อหน้าด้วยบรรทัดว่างอยู่แล้ว ไม่แตะ", () => {
    const t = "ย่อหน้า ก\n\nย่อหน้า ข\n\nย่อหน้า ค";
    expect(normalizeText(t, "auto")).toBe(t);
  });

  it("every-line บังคับทุกบรรทัด; keep ไม่แตะ", () => {
    expect(normalizeText("ก\nข", "every-line")).toBe("ก\n\nข");
    expect(normalizeText("ก\nข", "keep")).toBe("ก\nข");
  });
});

describe("splitChapters: headings", () => {
  it("แบ่งตามหัวตอน เก็บชื่อและเลข", () => {
    const text = `ตอนที่ 1 เริ่มต้น\n\n${body(1)}\n\nตอนที่ 2 ต่อมา\n\n${body(2)}`;
    const { chapters, preface } = splitChapters(text, { method: "headings" });
    expect(preface).toBe("");
    expect(chapters.map((c) => [c.number, c.name])).toEqual([
      [1, "ตอนที่ 1 เริ่มต้น"],
      [2, "ตอนที่ 2 ต่อมา"],
    ]);
    expect(chapters[0].body).toContain("เนื้อหาตอนที่ 1");
    expect(chapters[0].body).not.toContain("ตอนที่ 2");
    expect(chapters.every((c) => c.warnings.length === 0)).toBe(true);
  });

  it("ข้อความก่อนหัวตอนแรกเป็นคำนำ (ไม่นำเข้า แต่คืนให้รู้)", () => {
    const { chapters, preface } = splitChapters(`ชื่อเรื่อง: มังกร\nผู้แต่ง: ก\n\nตอนที่ 1\n\n${body(1)}`, {
      method: "headings",
    });
    expect(chapters).toHaveLength(1);
    expect(preface).toContain("ชื่อเรื่อง: มังกร");
  });

  it("ไม่พบหัวตอนเลย → ทั้งไฟล์เป็นตอนเดียว ใช้ชื่อสำรอง", () => {
    const { chapters } = splitChapters(body(1), { method: "headings", fallbackName: "บทนำ.txt" });
    expect(chapters).toHaveLength(1);
    expect(chapters[0].name).toBe("บทนำ.txt");
    expect(chapters[0].number).toBeNull();
  });

  it("ข้อความว่าง → ไม่มีตอน", () => {
    expect(splitChapters("", { method: "headings" }).chapters).toHaveLength(0);
  });

  it("เตือน: เลขข้าม / เลขซ้ำ / ย้อนกลับ / เนื้อหาสั้นมาก / ว่าง", () => {
    const text = [
      `ตอนที่ 1\n\n${body(1)}`,
      `ตอนที่ 3\n\n${body(3)}`, // ข้าม 2
      `ตอนที่ 3\n\n${body(3)}`, // ซ้ำ
      `ตอนที่ 2\n\n${body(2)}`, // ย้อนกลับ
      `ตอนที่ 5\n\nสั้น`, // ข้าม + สั้นมาก
      `ตอนที่ 6`, // ว่าง
    ].join("\n\n");
    const w = splitChapters(text, { method: "headings" }).chapters.map((c) => c.warnings.join("|"));
    expect(w[0]).toBe("");
    expect(w[1]).toContain("ข้ามจาก 1 เป็น 3");
    expect(w[2]).toContain("ซ้ำ");
    expect(w[3]).toContain("ย้อนกลับ");
    expect(w[4]).toContain("สั้นมาก");
    expect(w[5]).toContain("ไม่มีเนื้อหา");
  });

  it("ไม่แบ่งผิดที่ในบทสนทนาที่มีคำว่า ตอน/บท", () => {
    const text = `ตอนที่ 1\n\nเขาบอกว่าตอนนี้ต้องไปแล้ว\nบทสนทนาของพวกเขายาวนาน\n\n${body(1)}`;
    expect(splitChapters(text, { method: "headings" }).chapters).toHaveLength(1);
  });

  it("หลายร้อยตอน (ประสิทธิภาพ) แบ่งได้ครบ", () => {
    const text = Array.from({ length: 500 }, (_, i) => `ตอนที่ ${i + 1}\n\n${body(i + 1)}`).join(
      "\n\n",
    );
    const { chapters } = splitChapters(text, { method: "headings" });
    expect(chapters).toHaveLength(500);
    expect(chapters[499].number).toBe(500);
    expect(chapters.every((c) => c.warnings.length === 0)).toBe(true);
  });
});

describe("splitChapters: separator / size", () => {
  it("แบ่งด้วยบรรทัด ***", () => {
    const { chapters } = splitChapters(`${body(1)}\n\n***\n\n${body(2)}\n\n===\n\n${body(3)}`, {
      method: "separator",
      fallbackName: "ตอน",
    });
    expect(chapters.map((c) => c.name)).toEqual(["ตอน 1", "ตอน 2", "ตอน 3"]);
  });

  it("แบ่งตามความยาว ตัดที่ขอบย่อหน้า ไม่ตัดกลางย่อหน้า", () => {
    const paras = Array.from({ length: 20 }, (_, i) => `ย่อหน้าที่ ${i} `.repeat(20).trim());
    const { chapters } = splitChapters(paras.join("\n\n"), { method: "size", targetChars: 1500 });
    expect(chapters.length).toBeGreaterThan(1);
    const rejoined = chapters.map((c) => c.body).join("\n\n");
    expect(rejoined).toBe(paras.join("\n\n").trim());
    for (const c of chapters) expect(c.body.startsWith("ย่อหน้าที่")).toBe(true);
  });
});

describe("assignNumbers", () => {
  const draft = (number: number | null) => ({ number, name: "x", body: "b", warnings: [] });

  it("from-headings: ใช้เลขจากหัวตอน ตอนไม่มีเลขเรียงต่อ", () => {
    const out = assignNumbers([draft(5), draft(null), draft(7), draft(null)], "from-headings", 1);
    expect(out.map((c) => c.finalNumber)).toEqual([5, 6, 7, 8]);
  });

  it("from-headings: ตอนแรกไม่มีเลข ใช้เลขเริ่มต้น", () => {
    expect(
      assignNumbers([draft(null), draft(null)], "from-headings", 10).map((c) => c.finalNumber),
    ).toEqual([10, 11]);
  });

  it("sequential: เรียงต่อจากเลขเริ่มต้นเสมอ", () => {
    expect(assignNumbers([draft(5), draft(9)], "sequential", 20).map((c) => c.finalNumber)).toEqual(
      [20, 21],
    );
  });

  it("duplicateNumbers หาเลขซ้ำ", () => {
    const out = assignNumbers([draft(1), draft(2), draft(2)], "from-headings", 1);
    expect(duplicateNumbers(out)).toEqual([2]);
  });
});
