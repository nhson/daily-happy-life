import { describe, expect, it } from "vitest";
import { ritualMode } from "./ritual-mode";

const HCM = "Asia/Ho_Chi_Minh"; // UTC+7
const NY = "America/New_York";
const base = { timeZone: HCM, eveningHour: 19, dayEndHour: 4, morningAt: null, closedAt: null };

describe("ritualMode", () => {
  it("is morning until the ritual is done", () => {
    // 07:30 in HCM
    expect(ritualMode(new Date("2026-11-04T00:30:00Z"), base)).toBe("morning");
  });

  it("is day once the morning ritual is done or skipped", () => {
    expect(ritualMode(new Date("2026-11-04T03:00:00Z"), { ...base, morningAt: "2026-11-04T00:40:00Z" })).toBe("day");
  });

  it("turns evening at the evening hour in the user's timezone, not the device's", () => {
    // 19:30 in HCM is 12:30Z; a device on UTC would read 12:30 and stay "day".
    expect(ritualMode(new Date("2026-11-04T12:30:00Z"), { ...base, morningAt: "x" })).toBe("evening");
    // The same instant is 07:30 in New York: morning there.
    expect(ritualMode(new Date("2026-11-04T12:30:00Z"), { ...base, timeZone: NY })).toBe("morning");
  });

  it("stays evening after midnight until the day-end hour", () => {
    // 01:15 in HCM
    expect(ritualMode(new Date("2026-11-04T18:15:00Z"), { ...base, morningAt: "x" })).toBe("evening");
  });

  it("is evening even if the morning was never done", () => {
    expect(ritualMode(new Date("2026-11-04T13:00:00Z"), base)).toBe("evening");
  });

  it("is night once the day is closed, whatever the hour", () => {
    expect(ritualMode(new Date("2026-11-04T05:00:00Z"), { ...base, closedAt: "2026-11-04T04:59:00Z" })).toBe("night");
  });
});
