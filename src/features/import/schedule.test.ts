import { describe, expect, it } from "vitest";
import { schedulePublishAt, validScheduleOptions } from "./schedule";

const base = { startDate: "2026-11-30", time: "18:00", perDay: 2 };

describe("schedulePublishAt", () => {
  it("ลงวันละ N ตอน ข้ามเดือน/ปีได้ถูกต้อง", () => {
    expect(schedulePublishAt(0, base)).toBe("2026-11-30T18:00");
    expect(schedulePublishAt(1, base)).toBe("2026-11-30T18:00");
    expect(schedulePublishAt(2, base)).toBe("2026-12-01T18:00");
    expect(schedulePublishAt(3, base)).toBe("2026-12-01T18:00");
    expect(schedulePublishAt(62, base)).toBe("2026-12-31T18:00");
    expect(schedulePublishAt(124, base)).toBe("2027-01-31T18:00"); // ข้ามปี
  });
  it("วันละตอน", () => {
    const o = { ...base, perDay: 1 };
    expect(schedulePublishAt(0, o)).toBe("2026-11-30T18:00");
    expect(schedulePublishAt(1, o)).toBe("2026-12-01T18:00");
  });
  it("ปีอธิกสุรทิน", () => {
    expect(schedulePublishAt(1, { startDate: "2028-02-28", time: "06:30", perDay: 1 })).toBe(
      "2028-02-29T06:30",
    );
    expect(schedulePublishAt(2, { startDate: "2028-02-28", time: "06:30", perDay: 1 })).toBe(
      "2028-03-01T06:30",
    );
  });
});

describe("validScheduleOptions", () => {
  it("รับค่าที่ถูกต้อง ปฏิเสธค่าผิด", () => {
    expect(validScheduleOptions(base)).toBe(true);
    expect(validScheduleOptions({ ...base, startDate: "2026-13-40" })).toBe(false);
    expect(validScheduleOptions({ ...base, startDate: "" })).toBe(false);
    expect(validScheduleOptions({ ...base, time: "25:00" })).toBe(false);
    expect(validScheduleOptions({ ...base, time: "6:00" })).toBe(false);
    expect(validScheduleOptions({ ...base, perDay: 0 })).toBe(false);
    expect(validScheduleOptions({ ...base, perDay: 1.5 })).toBe(false);
  });
});
