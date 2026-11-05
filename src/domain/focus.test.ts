import { describe, expect, it } from "vitest";
import { currentFocus, endFocus, endsAt, focusedMinutes, focusedOn, isFocusMinutes, phaseOf, startFocus, type FocusSession } from "./focus";

const s = (over: Partial<FocusSession> = {}): FocusSession => ({
  id: "f1",
  taskId: "t1",
  startedAt: "2026-11-05T02:00:00.000Z",
  plannedMinutes: 25,
  endedAt: null,
  ...over,
});
const t = (iso: string) => new Date(iso);

describe("a Focus Session", () => {
  it("ends its planned minutes after it starts", () => {
    expect(endsAt(s()).toISOString()).toBe("2026-11-05T02:25:00.000Z");
  });

  it("runs, then waits for an answer once its time is up, then is over", () => {
    expect(phaseOf(s(), t("2026-11-05T02:10:00Z"))).toBe("running");
    expect(phaseOf(s(), t("2026-11-05T02:25:00Z"))).toBe("finished");
    expect(phaseOf(s({ endedAt: "2026-11-05T02:12:00.000Z" }), t("2026-11-05T02:13:00Z"))).toBe("ended");
  });

  it("counts the minutes actually focused, never more than planned", () => {
    expect(focusedMinutes(s(), t("2026-11-05T02:10:30Z"))).toBe(10);
    expect(focusedMinutes(s(), t("2026-11-05T05:00:00Z"))).toBe(25);
    expect(focusedMinutes(s({ endedAt: "2026-11-05T02:07:00.000Z" }), t("2026-11-05T05:00:00Z"))).toBe(7);
  });

  it("takes whole minutes from 1 to 180", () => {
    expect([15, 25, 50, 1, 180].every(isFocusMinutes)).toBe(true);
    expect([0, 181, 2.5, "25", null].some(isFocusMinutes)).toBe(false);
  });
});

describe("the current Focus Session", () => {
  it("is the one running or waiting for an answer", () => {
    const old = s({ id: "old", endedAt: "2026-11-05T01:30:00.000Z", startedAt: "2026-11-05T01:00:00.000Z" });
    expect(currentFocus([old, s()], t("2026-11-05T02:30:00Z"))?.id).toBe("f1");
    expect(currentFocus([old], t("2026-11-05T02:30:00Z"))).toBeNull();
  });

  it("stops asking once its end is more than 12 hours past", () => {
    expect(currentFocus([s()], t("2026-11-05T14:24:00Z"))?.id).toBe("f1");
    expect(currentFocus([s()], t("2026-11-05T14:26:00Z"))).toBeNull();
  });
});

describe("starting and ending", () => {
  it("starting one ends the one before, so only one runs at a time", () => {
    const now = t("2026-11-05T02:10:00Z");
    const next = startFocus([s()], { id: "f2", taskId: "t2", minutes: 50 }, now);
    expect(next).toHaveLength(2);
    expect(next[0].endedAt).toBe("2026-11-05T02:10:00.000Z");
    expect(next[1]).toEqual({ id: "f2", taskId: "t2", startedAt: now.toISOString(), plannedMinutes: 50, endedAt: null });
  });

  it("a session that already ran out ends at its planned end, not later", () => {
    const [x] = endFocus([s()], "f1", t("2026-11-05T03:00:00Z"));
    expect(x.endedAt).toBe("2026-11-05T02:25:00.000Z");
  });

  it("ending early keeps the minutes focused so far", () => {
    const [x] = endFocus([s()], "f1", t("2026-11-05T02:12:00Z"));
    expect(x.endedAt).toBe("2026-11-05T02:12:00.000Z");
  });

  it("ending one that is over changes nothing", () => {
    const done = [s({ endedAt: "2026-11-05T02:05:00.000Z" })];
    expect(endFocus(done, "f1", t("2026-11-05T03:00:00Z"))).toBe(done);
  });
});

describe("minutes focused on a Logical Day", () => {
  it("adds up the sessions that started on that day, in the user's zone and day end", () => {
    const tz = "Asia/Ho_Chi_Minh"; // UTC+7, day ends 04:00
    const sessions = [
      s({ id: "a", startedAt: "2026-11-05T02:00:00.000Z", endedAt: "2026-11-05T02:25:00.000Z" }), // 09:00 on the 5th
      s({ id: "b", startedAt: "2026-11-05T19:30:00.000Z", plannedMinutes: 50, endedAt: null }), // 02:30 on the 6th → still the 5th
      s({ id: "c", startedAt: "2026-11-04T10:00:00.000Z", endedAt: "2026-11-04T10:25:00.000Z" }), // the 4th
    ];
    expect(focusedOn(sessions, "2026-11-05", tz, 4, t("2026-11-05T20:00:00Z"))).toBe(25 + 30);
  });
});
