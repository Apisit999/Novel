import { describe, expect, it } from "vitest";
import { paginate, pageWindow, parsePage } from "./paginate";

describe("parsePage", () => {
  it("defaults to 1 for junk", () => {
    for (const v of [undefined, "", "abc", "0", "-3", "1.5x", ["2"]]) {
      expect(parsePage(v as string)).toBe(v === "1.5x" ? 1 : 1);
    }
    expect(parsePage("7")).toBe(7);
  });
});

describe("paginate", () => {
  it("computes slice bounds", () => {
    expect(paginate(250, 2, 100)).toMatchObject({ page: 2, totalPages: 3, start: 100, end: 200 });
    expect(paginate(250, 3, 100)).toMatchObject({ start: 200, end: 250 });
  });
  it("clamps out-of-range pages and handles empty", () => {
    expect(paginate(250, 99, 100).page).toBe(3);
    expect(paginate(0, 5, 100)).toMatchObject({ page: 1, totalPages: 1, start: 0, end: 0 });
  });
});

describe("pageWindow", () => {
  it("shows first, around current, last with gaps", () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(2, 7)).toEqual([1, 2, 3, 4, null, 7]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
