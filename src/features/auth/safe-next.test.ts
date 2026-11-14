import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext (กัน open redirect)", () => {
  it("รับ path ภายในเว็บ", () => {
    expect(safeNext("/library")).toBe("/library");
    expect(safeNext("/read/moonlit-garden/2?x=1")).toBe("/read/moonlit-garden/2?x=1");
  });
  it("ว่าง/ไม่มี → ค่า fallback", () => {
    expect(safeNext(null)).toBe("/library");
    expect(safeNext("")).toBe("/library");
    expect(safeNext(undefined, "/")).toBe("/");
  });
  it("ปฏิเสธ URL เต็มและรูปแบบที่เบราว์เซอร์ตีเป็นโดเมนอื่น", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "evil.com",
    ]) {
      expect(safeNext(bad)).toBe("/library");
    }
  });
});
