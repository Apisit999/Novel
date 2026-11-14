import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const html = (s: string) => renderToStaticMarkup(<Markdown source={s} />);

describe("Markdown", () => {
  it("แบ่งย่อหน้าด้วยบรรทัดว่าง", () => {
    expect(html("หนึ่ง\n\nสอง")).toBe("<p>หนึ่ง</p><p>สอง</p>");
  });
  it("บรรทัดเดี่ยวในย่อหน้าเป็น <br>", () => {
    expect(html("ก\nข")).toBe("<p>ก<br/>ข</p>");
  });
  it("ตัวหนาและตัวเอียง", () => {
    expect(html("**หนา** และ *เอียง*")).toContain("<strong>หนา</strong>");
    expect(html("**หนา** และ *เอียง*")).toContain("<em>เอียง</em>");
  });
  it("หัวข้อลดระดับลง 1 ขั้น (h1 เป็นของชื่อตอน)", () => {
    expect(html("# ตอนที่ 1")).toContain("<h2");
    expect(html("## ฉาก")).toContain("<h3");
  });
  it("เส้นคั่น ---", () => {
    expect(html("ก\n\n---\n\nข")).toContain("<hr");
  });
  it("HTML ในข้อความถูก escape ไม่ถูกตีความ", () => {
    const out = html('<script>alert(1)</script> <img src=x onerror="x()">');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });
  it("เครื่องหมาย * ที่ไม่ครบคู่แสดงตามตัวอักษร", () => {
    expect(html("5 * 3 = 15")).toContain("5 * 3 = 15");
  });
});
