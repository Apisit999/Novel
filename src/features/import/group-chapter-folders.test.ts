import { describe, expect, it } from "vitest";
import { groupChapterFolders } from "./group-chapter-folders";

const f = (path: string) => ({ path, file: new File([""], path.split("/").pop()!) });

describe("groupChapterFolders", () => {
  it("groups by subfolder, numbers from folder name, natural page order", () => {
    const g = groupChapterFolders([
      f("R/ตอน 10/p10.jpg"),
      f("R/ตอน 10/p2.jpg"),
      f("R/ตอน 2/a.png"),
      f("R/readme.txt"),
    ]);
    expect(g.map((c) => c.number)).toEqual([2, 10]);
    expect(g[1].files.map((x) => x.name)).toEqual(["p2.jpg", "p10.jpg"]);
  });
  it("gives unique numbers to folders without digits or duplicates", () => {
    const g = groupChapterFolders([f("R/intro/a.jpg"), f("R/1/a.jpg"), f("R/ch1/a.jpg")], 5);
    expect(new Set(g.map((c) => c.number)).size).toBe(3);
  });
  it("treats files directly in the folder as one chapter", () => {
    expect(groupChapterFolders([f("Ch3/a.jpg")])[0].number).toBe(3);
  });
});
