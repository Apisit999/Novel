import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("ค่า default: paywall ปิด, signup เปิด", () => {
    const env = parseServerEnv({});
    expect(env.PAYWALL_ENABLED).toBe(false);
    expect(env.SIGNUP_ENABLED).toBe(true);
  });

  it("อ่านค่า true/false/1/0", () => {
    expect(parseServerEnv({ PAYWALL_ENABLED: "true" }).PAYWALL_ENABLED).toBe(true);
    expect(parseServerEnv({ PAYWALL_ENABLED: "1" }).PAYWALL_ENABLED).toBe(true);
    expect(parseServerEnv({ SIGNUP_ENABLED: "false" }).SIGNUP_ENABLED).toBe(false);
    expect(parseServerEnv({ SIGNUP_ENABLED: "0" }).SIGNUP_ENABLED).toBe(false);
  });

  it("ค่าแปลก ๆ ต้อง error (กันพิมพ์ผิดแล้วเปิด paywall โดยไม่รู้ตัว)", () => {
    expect(() => parseServerEnv({ PAYWALL_ENABLED: "yes" })).toThrow();
  });
});

describe("parsePublicEnv", () => {
  it("มี default ของ SITE_URL", () => {
    expect(parsePublicEnv({}).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("URL ผิดรูปแบบต้อง error", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "not-a-url" })).toThrow();
  });
});
