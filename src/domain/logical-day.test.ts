import { describe, expect, it } from "vitest";
import { addDays, dayIndex, localMinutes, logicalDate, quarterOf, quarterProgress } from "./logical-day";

const HCM = "Asia/Ho_Chi_Minh"; // UTC+7, no DST
const NY = "America/New_York"; // DST

describe("logicalDate", () => {
  it("is the local calendar date after the day-end hour", () => {
    // 2026-11-03 09:00 in HCM = 02:00Z
    expect(logicalDate(new Date("2026-11-03T02:00:00Z"), HCM, 4)).toBe("2026-11-03");
  });

  it("belongs to the previous day before the day-end hour (00:40 check-in)", () => {
    // 2026-11-04 00:40 HCM = 2026-11-03T17:40Z
    expect(logicalDate(new Date("2026-11-03T17:40:00Z"), HCM, 4)).toBe("2026-11-03");
  });

  it("switches exactly at the day-end hour", () => {
    // 2026-11-04 04:00 HCM = 2026-11-03T21:00Z
    expect(logicalDate(new Date("2026-11-03T21:00:00Z"), HCM, 4)).toBe("2026-11-04");
    expect(logicalDate(new Date("2026-11-03T20:59:59Z"), HCM, 4)).toBe("2026-11-03");
  });

  it("treats dayEndHour 0 as midnight", () => {
    expect(logicalDate(new Date("2026-11-03T17:40:00Z"), HCM, 0)).toBe("2026-11-04");
  });

  it("uses the zone's wall clock across a DST change", () => {
    // 2026-11-01 is US DST end. 02:30 EST local = 07:30Z → before 04:00 → Oct 31
    expect(logicalDate(new Date("2026-11-01T07:30:00Z"), NY, 4)).toBe("2026-10-31");
    // 09:00 EST = 14:00Z
    expect(logicalDate(new Date("2026-11-01T14:00:00Z"), NY, 4)).toBe("2026-11-01");
  });

  it("crosses month and year boundaries", () => {
    // 2027-01-01 01:00 HCM = 2026-12-31T18:00Z → still 2026-12-31
    expect(logicalDate(new Date("2026-12-31T18:00:00Z"), HCM, 4)).toBe("2026-12-31");
  });
});

describe("addDays", () => {
  it("adds and subtracts across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("dayIndex", () => {
  it("counts days since the epoch", () => {
    expect(dayIndex("1970-01-01")).toBe(0);
    expect(dayIndex("1970-01-02")).toBe(1);
    expect(dayIndex("2026-11-04") - dayIndex("2026-11-03")).toBe(1);
  });
});

describe("quarterOf", () => {
  it("maps months to quarters", () => {
    expect(quarterOf("2026-01-01")).toBe("2026-Q1");
    expect(quarterOf("2026-03-31")).toBe("2026-Q1");
    expect(quarterOf("2026-04-01")).toBe("2026-Q2");
    expect(quarterOf("2026-12-31")).toBe("2026-Q4");
  });
});

describe("localMinutes", () => {
  it("returns minutes since local midnight", () => {
    expect(localMinutes(new Date("2026-11-03T02:30:00Z"), HCM)).toBe(9 * 60 + 30);
  });
});

describe("quarterProgress", () => {
  it("starts at week 1 of 13 on the quarter's first day", () => {
    expect(quarterProgress("2026-10-01")).toEqual({ week: 1, weeks: 13, fraction: 0 });
  });
  it("counts whole weeks elapsed and the share of the quarter's days", () => {
    const p = quarterProgress("2026-11-04"); // 34 days into a 92-day quarter
    expect(p.week).toBe(5);
    expect(p.fraction).toBeCloseTo(34 / 92);
  });
  it("never goes past week 13 in a long quarter", () => {
    expect(quarterProgress("2026-12-31").week).toBe(13);
    expect(quarterProgress("2026-12-31").fraction).toBeCloseTo(91 / 92);
  });
  it("handles a short quarter", () => {
    expect(quarterProgress("2026-03-31")).toEqual({ week: 13, weeks: 13, fraction: 89 / 90 });
  });
});
