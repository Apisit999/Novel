import { describe, expect, it } from "vitest";
import { canAccess, effectiveAccess, type AccessInput } from "./can-access";

const now = new Date("2026-11-13T00:00:00Z");
const future = new Date("2026-12-13T00:00:00Z");
const past = new Date("2026-10-13T00:00:00Z");

const base: AccessInput = {
  titleAccess: "premium",
  episodeAccess: "inherit",
  user: null,
  paywallEnabled: true,
  now,
};

const subscriber = (status: "active" | "past_due" | "canceled", end: Date | null = future) => ({
  subscription: { status, currentPeriodEnd: end },
});

describe("effectiveAccess", () => {
  it("inherit ใช้ค่าของเรื่อง", () => {
    expect(effectiveAccess("premium", "inherit")).toBe("premium");
    expect(effectiveAccess("free", "inherit")).toBe("free");
  });
  it("ค่าของตอนชนะค่าของเรื่อง", () => {
    expect(effectiveAccess("premium", "free")).toBe("free");
    expect(effectiveAccess("free", "premium")).toBe("premium");
  });
});

describe("canAccess", () => {
  it("เนื้อหาฟรี: ทุกคนเข้าได้แม้ไม่ล็อกอิน", () => {
    expect(canAccess({ ...base, titleAccess: "free" })).toEqual({ allowed: true, reason: "free" });
  });

  it("ตอนฟรีในเรื่อง premium: เข้าได้", () => {
    expect(canAccess({ ...base, episodeAccess: "free" })).toEqual({
      allowed: true,
      reason: "free",
    });
  });

  it("paywall ปิด: premium เปิดฟรีให้ทุกคน (ช่วงเปิดตัว)", () => {
    expect(canAccess({ ...base, paywallEnabled: false })).toEqual({
      allowed: true,
      reason: "paywall-off",
    });
  });

  it("paywall เปิด + ไม่ล็อกอิน: ต้องล็อกอิน", () => {
    expect(canAccess(base)).toEqual({ allowed: false, reason: "login-required" });
  });

  it("paywall เปิด + ล็อกอินแต่ไม่มีสมาชิก: ต้องสมัครสมาชิก", () => {
    expect(canAccess({ ...base, user: { subscription: null } })).toEqual({
      allowed: false,
      reason: "subscription-required",
    });
  });

  it("สมาชิก active: เข้าได้", () => {
    expect(canAccess({ ...base, user: subscriber("active") })).toEqual({
      allowed: true,
      reason: "subscriber",
    });
  });

  it("ยกเลิกแล้วแต่ยังไม่หมดรอบบิล: ยังเข้าได้", () => {
    expect(canAccess({ ...base, user: subscriber("canceled", future) }).allowed).toBe(true);
  });

  it("ยกเลิกและหมดรอบบิลแล้ว: เข้าไม่ได้", () => {
    expect(canAccess({ ...base, user: subscriber("canceled", past) })).toEqual({
      allowed: false,
      reason: "subscription-required",
    });
  });

  it("canceled ที่ไม่มีวันหมดรอบ: เข้าไม่ได้", () => {
    expect(canAccess({ ...base, user: subscriber("canceled", null) }).allowed).toBe(false);
  });

  it("past_due (ชำระไม่สำเร็จ): เข้าไม่ได้", () => {
    expect(canAccess({ ...base, user: subscriber("past_due") }).allowed).toBe(false);
  });
});
