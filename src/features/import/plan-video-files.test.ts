import { describe, expect, it } from "vitest";
import { planVideoFiles } from "./plan-video-files";

const f = (name: string, type = "video/mp4", size = 10) => {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
};

describe("planVideoFiles", () => {
  it("sorts naturally and numbers from filename", () => {
    const p = planVideoFiles([f("ep10.mp4"), f("ep2.mp4")], 1, 1000);
    expect(p.map((x) => x.number)).toEqual([2, 10]);
    expect(p[0].name).toBe("ep2");
  });
  it("gives unique numbers to duplicates / no digits", () => {
    const p = planVideoFiles([f("a.mp4"), f("b.mp4"), f("1.mp4"), f("1b.mp4")], 5, 1000);
    expect(new Set(p.map((x) => x.number)).size).toBe(4);
  });
  it("flags oversize and unsupported files", () => {
    const p = planVideoFiles(
      [f("1.mp4", "video/mp4", 2000), f("2.mov", "video/quicktime")],
      1,
      1000,
    );
    expect(p[0].problem).toBeTruthy();
    expect(p[1].problem).toBeTruthy();
  });
});
