import { describe, expect, it } from "vitest";
import {
  buildInfoJson,
  buildNovelText,
  type ExportEpisode,
  type ExportTitle,
} from "./build-export";
import { parseBackup } from "./parse-backup";

const title: ExportTitle = {
  slug: "moon",
  name: "จันทร์",
  author: "เอ",
  synopsis: "เรื่องย่อ",
  status: "completed",
  rating: "13",
  updateDay: 2,
  published: true,
  tags: ["รัก", "แฟนตาซี"],
};
const eps: ExportEpisode[] = [
  {
    number: 1,
    name: "เริ่มต้น",
    status: "published",
    access: "free",
    publishAt: null,
    body: "ย่อหน้าแรก\n\nย่อหน้าสอง",
    translations: [{ lang: "en", body: "First", machine: true }],
  },
  {
    number: 2,
    name: "ตอนที่ 2 ต่อมา",
    status: "scheduled",
    access: "premium",
    publishAt: "2026-12-01T03:00:00.000Z",
    body: "เนื้อหาตอนสอง",
    translations: [],
  },
];

describe("parseBackup", () => {
  it("round-trips export → restore data", () => {
    const md = buildNovelText(title, eps, "md");
    const en = buildNovelText(title, [{ number: 1, name: "เริ่มต้น", body: "First" }], "md");
    const r = parseBackup(md, buildInfoJson(title, eps), { en });
    expect(r.title).toEqual(title);
    expect(r.missingBodies).toEqual([]);
    expect(r.chapters).toHaveLength(2);
    expect(r.chapters[0]).toMatchObject({
      number: 1,
      name: "เริ่มต้น",
      body: "ย่อหน้าแรก\n\nย่อหน้าสอง",
      status: "published",
      access: "free",
      translations: [{ lang: "en", body: "First", machine: true }],
    });
    expect(r.chapters[1]).toMatchObject({
      number: 2,
      status: "scheduled",
      access: "premium",
      publishAt: "2026-12-01T03:00:00.000Z",
    });
  });
  it("reports episodes whose body is missing", () => {
    const md = buildNovelText(title, [eps[0]], "md");
    expect(parseBackup(md, buildInfoJson(title, eps), {}).missingBodies).toEqual([2]);
  });
  it("rejects garbage info.json", () => {
    expect(() => parseBackup("", "nope", {})).toThrow();
    expect(() => parseBackup("", "{}", {})).toThrow();
  });
});
