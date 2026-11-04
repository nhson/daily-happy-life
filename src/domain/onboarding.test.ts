import { describe, expect, it } from "vitest";
import {
  dayNumber,
  dueNudge,
  freshOnboarding,
  snoozeNudge,
  todayCard,
  type OnboardingState,
} from "./onboarding";
import type { OdysseyPlan } from "./types";

const plan = (slot: 1 | 2 | 3, title = ""): OdysseyPlan => ({
  id: `plan_${slot}`,
  slot,
  title,
  questions: "",
  gauges: { resources: null, likability: null, confidence: null, coherence: null },
  isActive: slot === 1,
});
const unwritten = [plan(1), plan(2), plan(3)];
const setupOn = (setupDate: string, patch: Partial<OnboardingState> = {}): OnboardingState => ({
  ...freshOnboarding(setupDate),
  ...patch,
});

describe("dayNumber", () => {
  it("counts the setup day as day 1", () => {
    expect(dayNumber("2026-11-04", "2026-11-04")).toBe(1);
    expect(dayNumber("2026-11-04", "2026-11-05")).toBe(2);
  });
  it("counts Logical Days, whether or not the app was opened", () => {
    expect(dayNumber("2026-11-04", "2026-11-14")).toBe(11);
  });
});

describe("dueNudge", () => {
  it("is silent on day 1", () => {
    expect(dueNudge(setupOn("2026-11-04"), "2026-11-04", unwritten)).toBeNull();
  });
  it("asks for Plan 1 from day 2", () => {
    expect(dueNudge(setupOn("2026-11-04"), "2026-11-05", unwritten)).toBe(1);
  });
  it("moves on to Plan 2 on day 4 once Plan 1 is written", () => {
    const plans = [plan(1, "Lead AI products"), plan(2), plan(3)];
    expect(dueNudge(setupOn("2026-11-04"), "2026-11-06", plans)).toBeNull(); // day 3
    expect(dueNudge(setupOn("2026-11-04"), "2026-11-07", plans)).toBe(2); // day 4
  });
  it("still asks for the earliest unwritten plan first", () => {
    expect(dueNudge(setupOn("2026-11-04"), "2026-11-09", unwritten)).toBe(1); // day 6
  });
  it("is due on the next visit after its day, however late", () => {
    const plans = [plan(1, "a"), plan(2, "b"), plan(3)];
    expect(dueNudge(setupOn("2026-11-04"), "2026-12-20", plans)).toBe(3);
  });
  it("is silent when all three plans are written", () => {
    const plans = [plan(1, "a"), plan(2, "b"), plan(3, "c")];
    expect(dueNudge(setupOn("2026-11-04"), "2026-11-20", plans)).toBeNull();
  });
  it("is silent before setup", () => {
    expect(dueNudge(freshOnboarding(null), "2026-11-20", unwritten)).toBeNull();
  });
});

describe("snoozeNudge", () => {
  it("hides the nudge for two days, then it returns", () => {
    const s = snoozeNudge(setupOn("2026-11-04"), 1, "2026-11-05");
    expect(dueNudge(s, "2026-11-05", unwritten)).toBeNull();
    expect(dueNudge(s, "2026-11-06", unwritten)).toBeNull();
    expect(dueNudge(s, "2026-11-07", unwritten)).toBe(1);
  });
  it("stops a plan's nudge for good after three 'not now's, and moves to the next plan", () => {
    let s = setupOn("2026-11-04");
    s = snoozeNudge(s, 1, "2026-11-05");
    s = snoozeNudge(s, 1, "2026-11-07");
    s = snoozeNudge(s, 1, "2026-11-09");
    expect(s.nudges["1"]).toEqual({ snoozedUntil: "2026-11-11", notNowCount: 3 });
    expect(dueNudge(s, "2026-11-30", [plan(1), plan(2, "b"), plan(3, "c")])).toBeNull();
    expect(dueNudge(s, "2026-11-30", unwritten)).toBe(2);
  });
  it("does not mutate the state it is given", () => {
    const s = setupOn("2026-11-04");
    snoozeNudge(s, 1, "2026-11-05");
    expect(s.nudges).toEqual({});
  });
});

describe("todayCard", () => {
  const base = { today: "2026-11-05", plans: unwritten, mode: "day" as const, hasTop3: true, hasClosedDay: false };

  it("shows the Top 3 tip first, before any nudge", () => {
    expect(todayCard({ ...base, onboarding: setupOn("2026-11-04") })).toEqual({ type: "tip", tip: "top3" });
  });
  it("waits for a Top 3 before teaching it", () => {
    expect(todayCard({ ...base, hasTop3: false, onboarding: setupOn("2026-11-04") })).toEqual({ type: "nudge", slot: 1 });
  });
  it("shows the closed-day tip at night", () => {
    const onboarding = setupOn("2026-11-04", { seenTips: ["top3"] });
    expect(todayCard({ ...base, mode: "night", hasClosedDay: true, onboarding })).toEqual({ type: "tip", tip: "closedDay" });
  });
  it("asks about the reminder once, after the first closed day, before nudging", () => {
    const onboarding = setupOn("2026-11-04", { seenTips: ["top3", "closedDay"] });
    expect(todayCard({ ...base, hasClosedDay: true, onboarding })).toEqual({ type: "reminder" });
    const asked = { ...onboarding, reminderAskedAt: "2026-11-05T20:00:00.000Z" };
    expect(todayCard({ ...base, hasClosedDay: true, onboarding: asked })).toEqual({ type: "nudge", slot: 1 });
  });
  it("never asks about the reminder before a day has been closed", () => {
    const onboarding = setupOn("2026-11-04", { seenTips: ["top3"] });
    expect(todayCard({ ...base, onboarding })).toEqual({ type: "nudge", slot: 1 });
  });
  it("keeps the evening clear — the check-in sheet carries its own tip", () => {
    expect(todayCard({ ...base, mode: "evening", onboarding: setupOn("2026-11-04") })).toBeNull();
  });
  it("shows nothing when onboarding is complete", () => {
    const plans = [plan(1, "a"), plan(2, "b"), plan(3, "c")];
    const onboarding = setupOn("2026-11-04", { seenTips: ["top3", "closedDay"], reminderAskedAt: "x" });
    expect(todayCard({ ...base, plans, hasClosedDay: true, onboarding })).toBeNull();
  });
});
