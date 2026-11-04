import { describe, expect, it } from "vitest";
import { lifeShare, weekDots } from "./life-share";

const tz = "Asia/Ho_Chi_Minh";
const done = (kind: "objective" | "maintenance" | "prototype", doneAt: string | null) => ({ kind, doneAt });

describe("lifeShare", () => {
  it("counts completed tasks per kind over the last 7 logical days", () => {
    const tasks = [
      done("objective", "2026-11-03T03:00:00Z"),
      done("objective", "2026-10-29T03:00:00Z"), // 6 days before → included
      done("maintenance", "2026-11-02T03:00:00Z"),
      done("prototype", "2026-11-01T03:00:00Z"),
      done("objective", "2026-10-27T03:00:00Z"), // 7 days before → excluded
      done("maintenance", null), // not done
    ];
    const s = lifeShare(tasks, { today: "2026-11-03", timeZone: tz, dayEndHour: 4 });
    expect(s.counts).toEqual({ objective: 2, maintenance: 1, prototype: 1 });
    expect(s.total).toBe(4);
    expect(s.percent).toEqual({ objective: 50, maintenance: 25, prototype: 25 });
  });

  it("attributes a 00:40 completion to the previous logical day", () => {
    // 2026-11-04 00:40 local → logical 2026-11-03, so it counts for "today" = 11-03
    const s = lifeShare([done("objective", "2026-11-03T17:40:00Z")], { today: "2026-11-03", timeZone: tz, dayEndHour: 4 });
    expect(s.total).toBe(1);
  });

  it("returns zeros, not NaN, with nothing done", () => {
    const s = lifeShare([], { today: "2026-11-03", timeZone: tz, dayEndHour: 4 });
    expect(s.percent).toEqual({ objective: 0, maintenance: 0, prototype: 0 });
  });

  it("percentages always sum to 100 when there is data", () => {
    const tasks = [done("objective", "2026-11-03T03:00:00Z"), done("maintenance", "2026-11-03T03:00:00Z"), done("prototype", "2026-11-03T03:00:00Z")];
    const s = lifeShare(tasks, { today: "2026-11-03", timeZone: tz, dayEndHour: 4 });
    expect(s.percent.objective + s.percent.maintenance + s.percent.prototype).toBe(100);
  });
});

describe("weekDots", () => {
  it("marks the last 7 logical days oldest → today", () => {
    const dots = weekDots(["2026-11-03", "2026-11-01", "2026-10-20"], "2026-11-03");
    expect(dots.map((d) => d.date)).toEqual([
      "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
    expect(dots.map((d) => d.checkedIn)).toEqual([false, false, false, false, true, false, true]);
  });
});
