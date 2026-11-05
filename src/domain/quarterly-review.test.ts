import { describe, expect, it } from "vitest";
import {
  parseDashboard,
  parseRerated,
  previousQuarter,
  quarterStart,
  quarterToReview,
  ratedPlans,
  reviewStep,
  type QuarterlyReview,
} from "./quarterly-review";
import type { OdysseyPlan } from "./types";

const review = (quarter: string, v: Partial<QuarterlyReview> = {}): QuarterlyReview => ({
  quarter,
  dashboard: { health: 6, work: 7, play: 3, love: 8 },
  plans: null,
  activePlanId: null,
  plansReviewedAt: null,
  completedAt: null,
  createdAt: "2027-01-02T01:00:00.000Z",
  ...v,
});
const plan = (slot: 1 | 2 | 3, title: string, isActive = false): OdysseyPlan => ({
  id: `p${slot}`,
  slot,
  title,
  questions: "",
  gauges: { resources: 5, likability: 6, confidence: null, coherence: 7 },
  isActive,
});

describe("quarters", () => {
  it("knows the quarter before, across a year", () => {
    expect(previousQuarter("2027-Q1")).toBe("2026-Q4");
    expect(previousQuarter("2026-Q4")).toBe("2026-Q3");
  });
  it("knows a quarter's first Logical Day", () => {
    expect(quarterStart("2026-Q4")).toBe("2026-10-01");
    expect(quarterStart("2027-Q1")).toBe("2027-01-01");
    expect(quarterStart("2027-Q2")).toBe("2027-04-01");
  });
});

describe("quarterToReview", () => {
  const base = { today: "2027-01-01", setupDate: "2026-11-04", leftoverCount: 0, reviews: [] as QuarterlyReview[] };

  it("asks about the quarter just ended once the user lived through one", () => {
    expect(quarterToReview(base)).toBe("2026-Q4");
    expect(quarterToReview({ ...base, today: "2027-02-20" })).toBe("2026-Q4");
  });
  it("waits for a user set up this quarter, unless leftovers wait", () => {
    expect(quarterToReview({ ...base, setupDate: "2027-01-01" })).toBeNull();
    expect(quarterToReview({ ...base, setupDate: null })).toBeNull();
    expect(quarterToReview({ ...base, setupDate: "2027-01-01", leftoverCount: 1 })).toBe("2026-Q4");
  });
  it("stops once that quarter's review is finished, and not before", () => {
    expect(quarterToReview({ ...base, reviews: [review("2026-Q4")] })).toBe("2026-Q4");
    expect(quarterToReview({ ...base, reviews: [review("2026-Q4", { completedAt: "2027-01-02T02:00:00.000Z" })] })).toBeNull();
  });
  it("a review started because of leftovers stays until finished, after the last one is settled", () => {
    expect(quarterToReview({ ...base, setupDate: "2027-01-01", reviews: [review("2026-Q4", { plansReviewedAt: "x" })] })).toBe("2026-Q4");
  });
  it("an older quarter's review doesn't count for this one", () => {
    expect(quarterToReview({ ...base, today: "2027-04-02", reviews: [review("2026-Q4", { completedAt: "2027-01-02T02:00:00.000Z" })] })).toBe(
      "2027-Q1",
    );
  });
  it("leftovers still ask even after the review was finished elsewhere", () => {
    expect(quarterToReview({ ...base, leftoverCount: 2, reviews: [review("2026-Q4", { completedAt: "2027-01-02T02:00:00.000Z" })] })).toBe(
      "2026-Q4",
    );
  });
});

describe("reviewStep", () => {
  it("starts at the dashboard, then the plans, then the leftovers, then the wrap-up", () => {
    expect(reviewStep(undefined, 2)).toBe("dashboard");
    expect(reviewStep(review("2026-Q4"), 2)).toBe("plans");
    expect(reviewStep(review("2026-Q4", { plansReviewedAt: "2027-01-02T01:05:00.000Z" }), 2)).toBe("settle");
    expect(reviewStep(review("2026-Q4", { plansReviewedAt: "2027-01-02T01:05:00.000Z" }), 0)).toBe("wrapUp");
  });
  it("a finished review is done, even if leftovers came back", () => {
    expect(reviewStep(review("2026-Q4", { plansReviewedAt: "x", completedAt: "y" }), 1)).toBe("settle");
    expect(reviewStep(review("2026-Q4", { plansReviewedAt: "x", completedAt: "y" }), 0)).toBe("done");
  });
});

describe("parseDashboard", () => {
  it("keeps whole ratings 0–10 and leaves the rest unrated", () => {
    expect(parseDashboard({ health: 0, work: 10, play: 4, love: 7 })).toEqual({ health: 0, work: 10, play: 4, love: 7 });
    expect(parseDashboard({ health: 11, work: -1, play: 4.5, love: "7" })).toEqual({ health: null, work: null, play: null, love: null });
    expect(parseDashboard(null)).toEqual({ health: null, work: null, play: null, love: null });
    expect(parseDashboard({ health: 3, extra: 9 })).toEqual({ health: 3, work: null, play: null, love: null });
  });
});

describe("parseRerated", () => {
  it("keeps plan ids with whole 0–10 Gauges, at most three", () => {
    expect(parseRerated([{ planId: "p1", gauges: { resources: 3, likability: 11, confidence: 2.5, coherence: 10 } }, { gauges: {} }, "x"])).toEqual([
      { planId: "p1", gauges: { resources: 3, likability: null, confidence: null, coherence: 10 } },
    ]);
    expect(parseRerated(null)).toEqual([]);
    expect(parseRerated([1, 2, 3, 4].map((i) => ({ planId: `p${i}`, gauges: {} })))).toHaveLength(3);
  });
});

describe("ratedPlans", () => {
  it("keeps the written plans' Gauges as they stand, in slot order", () => {
    const plans = [plan(3, "Wild card"), plan(1, "Current path", true), plan(2, "")];
    expect(ratedPlans(plans)).toEqual([
      { planId: "p1", slot: 1, title: "Current path", gauges: { resources: 5, likability: 6, confidence: null, coherence: 7 } },
      { planId: "p3", slot: 3, title: "Wild card", gauges: { resources: 5, likability: 6, confidence: null, coherence: 7 } },
    ]);
  });
});
