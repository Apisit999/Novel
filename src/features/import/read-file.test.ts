import { describe, expect, it } from "vitest";
import { baseName, decodeText, fileKind } from "./read-file";

describe("decodeText", () => {
  it("UTF-8 ปกติ", () => {
    const buf = new TextEncoder().encode("สวัสดีครับ").buffer as ArrayBuffer;
    expect(decodeText(buf)).toBe("สวัสดีครับ");
  });
  it("ไฟล์ Windows-874 (ไทยแบบเก่า) ถอดเป็นไทยถูกต้อง ไม่ใช่ตัวเพี้ยน", () => {
    // "สวัสดี" ใน Windows-874: ส=CA ว=C7 ั=D1 ส=CA ด=B4 ี=D5
    const bytes = new Uint8Array([0xca, 0xc7, 0xd1, 0xca, 0xb4, 0xd5]);
    expect(decodeText(bytes.buffer)).toBe("สวัสดี");
  });
});

describe("fileKind / baseName", () => {
  it("แยกชนิดไฟล์", () => {
    expect(fileKind("a.docx")).toBe("docx");
    expect(fileKind("A.DOCX")).toBe("docx");
    expect(fileKind("a.txt")).toBe("text");
    expect(fileKind("a.md")).toBe("text");
    expect(fileKind("a.pdf")).toBeNull();
    expect(fileKind("a.doc")).toBeNull();
  });
  it("ชื่อไฟล์ไม่รวมนามสกุล", () => {
    expect(baseName("ตอนที่ 1.docx")).toBe("ตอนที่ 1");
    expect(baseName("a.b.txt")).toBe("a.b");
  });
});
