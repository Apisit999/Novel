import { describe, expect, it } from "vitest";
import { adminMfaGate } from "./mfa-gate";

describe("adminMfaGate", () => {
  it("passes when MFA is not required", () => {
    expect(adminMfaGate(false, "aal1", "aal1")).toBe("ok");
  });
  it("passes when the session is already aal2", () => {
    expect(adminMfaGate(true, "aal2", "aal2")).toBe("ok");
  });
  it("asks for a code when a factor is enrolled but the session is aal1", () => {
    expect(adminMfaGate(true, "aal1", "aal2")).toBe("challenge");
  });
  it("forces enrollment when no factor exists", () => {
    expect(adminMfaGate(true, "aal1", "aal1")).toBe("enroll");
  });
  it("fails closed on unknown/missing levels", () => {
    expect(adminMfaGate(true, null, undefined)).toBe("enroll");
    expect(adminMfaGate(true, "weird", "weird")).toBe("enroll");
  });
});
