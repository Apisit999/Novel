import { describe, expect, it } from "vitest";
import { firstSnippet, replaceLiteral } from "./replace-text";

describe("replaceLiteral", () => {
  it("replaces all literal occurrences and counts", () => {
    expect(replaceLiteral("มินมินกับมิน", "มิน", "มิ้น", true)).toEqual({ text: "มิ้นมิ้นกับมิ้น", count: 3 });
  });
  it("is literal, not regex; replacement is literal too", () => {
    expect(replaceLiteral("a.b a.b", "a.b", "$1", true)).toEqual({ text: "$1 $1", count: 2 });
    expect(replaceLiteral("axb", "a.b", "z", true).count).toBe(0);
  });
  it("case-insensitive when asked", () => {
    expect(replaceLiteral("Tom tom TOM", "tom", "X", false)).toEqual({ text: "X X X", count: 3 });
    expect(replaceLiteral("Tom tom", "tom", "X", true).count).toBe(1);
  });
  it("empty find does nothing", () => {
    expect(replaceLiteral("abc", "", "x", true).count).toBe(0);
  });
  it("snippet shows context", () => {
    expect(firstSnippet("0123456789abcdef", "89", true, 3)).toBe("…567" + "89" + "abc…");
  });
});
