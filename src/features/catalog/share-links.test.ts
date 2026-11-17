import { describe, expect, it } from "vitest";
import { shareUrls } from "./share-links";

describe("shareUrls", () => {
  it("encodes url and text for LINE / Facebook / X", () => {
    const r = shareUrls("https://x.test/title/a b?x=1&y=2", "ชื่อ เรื่อง");
    expect(r.map((s) => s.id)).toEqual(["line", "facebook", "x"]);
    for (const s of r) {
      expect(s.href.startsWith("https://")).toBe(true);
      expect(s.href).toContain(encodeURIComponent("https://x.test/title/a b?x=1&y=2"));
      expect(s.href).not.toContain("a b");
    }
    expect(r[2].href).toContain(encodeURIComponent("ชื่อ เรื่อง"));
  });
});
