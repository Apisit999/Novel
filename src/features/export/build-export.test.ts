import { describe, expect, it } from "vitest";
import { assignNumbers, normalizeText, splitChapters } from "@/features/import/split-chapters";
import { buildInfoJson, buildNovelText, chapterHeading, safeFileStem } from "./build-export";

const body = (n: number) => `ย่อหน้าแรกของตอน ${n}\n\nย่อหน้าสองของตอน ${n} `.repeat(8).trim();

describe("chapterHeading", () => {
  it("ชื่อที่เป็นหัวตอนอยู่แล้วและเลขตรงกัน ใช้ตามเดิม", () => {
    expect(chapterHeading(5, "ตอนที่ 5 การเดินทาง")).toBe("ตอนที่ 5 การเดินทาง");
    expect(chapterHeading(5, "Chapter 5")).toBe("Chapter 5");
  });
  it("ชื่อธรรมดา เติม 'ตอนที่ N' นำหน้า", () => {
    expect(chapterHeading(5, "การเดินทาง")).toBe("ตอนที่ 5 การเดินทาง");
    expect(chapterHeading(7, "")).toBe("ตอนที่ 7");
  });
  it("ชื่อเป็นหัวตอนแต่เลขไม่ตรงกับเลขจริง → ยึดเลขจริง (กันนำเข้ากลับผิดเลข)", () => {
    expect(chapterHeading(9, "ตอนที่ 5 การเดินทาง")).toBe("ตอนที่ 9 ตอนที่ 5 การเดินทาง");
  });
  it("ยุบช่องว่าง/ขึ้นบรรทัดในชื่อให้เป็นบรรทัดเดียว", () => {
    expect(chapterHeading(2, "ก\n  ข")).toBe("ตอนที่ 2 ก ข");
  });
});

describe("buildNovelText + นำเข้ากลับ (round trip)", () => {
  const episodes = [
    { number: 3, name: "ตอนที่ 3", body: body(3) },
    { number: 1, name: "ประตูสีเขียว", body: body(1) },
    { number: 2, name: "ตอนที่ 2 เสียงในหมอก", body: body(2) },
  ];

  for (const format of ["md", "txt"] as const) {
    it(`ส่งออก ${format} แล้วนำเข้ากลับได้ครบทุกตอน เลขตรง เนื้อหาตรง`, () => {
      const text = buildNovelText({ name: "นิยายทดสอบ", author: "สมชาย" }, episodes, format);
      expect(text).toContain("ผู้แต่ง: สมชาย");
      const { chapters, preface } = splitChapters(normalizeText(text, "keep"), {
        method: "headings",
      });
      // ชื่อเรื่อง/ผู้แต่งเป็นคำนำ ไม่ปนเข้าตอนใด
      expect(preface).toContain("นิยายทดสอบ");
      const numbered = assignNumbers(chapters, "from-headings", 1);
      expect(numbered.map((c) => c.finalNumber)).toEqual([1, 2, 3]); // เรียงตามเลขตอน
      expect(numbered[0].name).toBe("ตอนที่ 1 ประตูสีเขียว");
      for (const c of numbered) {
        const original = episodes.find((e) => e.number === c.finalNumber)!;
        expect(c.body).toBe(original.body.trim());
        expect(c.warnings).toEqual([]);
      }
    });
  }

  it("เรื่องไม่มีผู้แต่ง: ไม่มีบรรทัดผู้แต่ง", () => {
    expect(buildNovelText({ name: "ก", author: null }, episodes, "md")).not.toContain("ผู้แต่ง");
  });
});

describe("buildInfoJson / safeFileStem", () => {
  it("JSON อ่านกลับได้ มีสถานะ/สิทธิ์/เวลา แต่ไม่ใส่เนื้อหาเต็ม", () => {
    const json = JSON.parse(
      buildInfoJson(
        {
          slug: "x",
          name: "ก",
          author: null,
          synopsis: "",
          status: "ongoing",
          rating: "all",
          updateDay: 1,
          published: true,
          tags: ["รัก"],
        },
        [
          {
            number: 2,
            name: "ข",
            status: "scheduled",
            access: "premium",
            publishAt: "2030-01-01T00:00:00Z",
            body: "abcdef",
            translations: [{ lang: "en", body: "x", machine: true }],
          },
          {
            number: 1,
            name: "ก",
            status: "draft",
            access: "inherit",
            publishAt: null,
            body: "",
            translations: [],
          },
        ],
      ),
    );
    expect(json.episodes.map((e: { number: number }) => e.number)).toEqual([1, 2]);
    expect(json.episodes[1]).toMatchObject({
      status: "scheduled",
      access: "premium",
      characters: 6,
    });
    expect(json.episodes[1].translations).toEqual([{ lang: "en", machine: true }]);
    expect(JSON.stringify(json)).not.toContain("abcdef");
  });

  it("ชื่อไฟล์ปลอดภัย", () => {
    expect(safeFileStem("moonlit-garden")).toBe("moonlit-garden");
    expect(safeFileStem("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileStem("นิยาย")).toBe("novel");
  });
});
