import { quarterOf } from "./logical-day";
import type { Gauges, LogicalDate, OdysseyPlan } from "./types";

/**
 * Quarterly Review (SPEC Phase 2 · 3, GLOSSARY): at the start of a quarter, one card on Today looks
 * back at the quarter just ended — the Life Dashboard, the Odyssey Plans' Gauges, the Active Plan —
 * and then runs Quarter Close on its leftovers. Saved step by step, so it resumes after a reload.
 */

export type LifeArea = "health" | "work" | "play" | "love";
export const LIFE_AREAS: readonly LifeArea[] = ["health", "work", "play", "love"];
/** 0–10 per area; null when skipped. */
export type Dashboard = Record<LifeArea, number | null>;

/** A written plan's Gauges as they stood when the quarter was reviewed. */
export interface PlanRating {
  planId: string;
  slot: 1 | 2 | 3;
  title: string;
  gauges: Gauges;
}

export interface QuarterlyReview {
  /** The quarter looked back on, "YYYY-Qn". */
  quarter: string;
  dashboard: Dashboard;
  /** Null until the plans step is passed. */
  plans: PlanRating[] | null;
  activePlanId: string | null;
  /** Only in the review of Q4: the Compass rewritten or kept. */
  compassReviewedAt: string | null;
  dashboardAt: string | null;
  plansReviewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type ReviewStep = "compass" | "dashboard" | "plans" | "settle" | "wrapUp" | "done";

/** "2027-Q1" → "2026-Q4". */
export function previousQuarter(quarter: string): string {
  const [y, q] = quarter.split("-Q").map(Number);
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
}

/** A quarter's first Logical Day: "2026-Q4" → "2026-10-01". */
export function quarterStart(quarter: string): LogicalDate {
  const [y, q] = quarter.split("-Q").map(Number);
  return `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
}

/**
 * The quarter waiting for its review, or null. Asked once the user has lived through a quarter (set
 * up before this one began) — or whenever last quarter's Objectives still wait to be settled. Once
 * begun it stays until finished, even after the last leftover is settled.
 */
export function quarterToReview(input: {
  today: LogicalDate;
  setupDate: LogicalDate | null;
  leftoverCount: number;
  reviews: Pick<QuarterlyReview, "quarter" | "completedAt">[];
}): string | null {
  const quarter = quarterOf(input.today);
  const last = previousQuarter(quarter);
  if (input.leftoverCount > 0) return last;
  const started = input.reviews.find((r) => r.quarter === last);
  if (started) return started.completedAt ? null : last; // once begun, it stays until finished
  return input.setupDate !== null && input.setupDate < quarterStart(quarter) ? last : null;
}

/** The review looking back on Q4 — the first one of a new year — begins with the Compass. */
export function asksCompass(quarter: string): boolean {
  return quarter.endsWith("-Q4");
}

/** Where the review stands: settling leftovers can't be skipped, so it waits for them. */
export function reviewStep(review: QuarterlyReview | undefined, leftoverCount: number, quarter: string): ReviewStep {
  if (asksCompass(quarter) && !review?.compassReviewedAt) return "compass";
  if (!review?.dashboardAt) return "dashboard";
  if (!review.plansReviewedAt) return "plans";
  if (leftoverCount > 0) return "settle";
  return review.completedAt ? "done" : "wrapUp";
}

/** A Compass the user rewrote: kept with when it was written and when it was replaced. */
export interface CompassVersion {
  workview: string;
  lifeview: string;
  writtenAt: string;
  replacedAt: string;
}

const rating = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);

/** Whatever a client sends becomes a Dashboard; anything that isn't a whole 0–10 is unrated. */
export function parseDashboard(x: unknown): Dashboard {
  const v = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return { health: rating(v.health), work: rating(v.work), play: rating(v.play), love: rating(v.love) };
}

/** Re-rated Gauges sent by a client: only whole 0–10 ratings of the four Gauges get through. */
export function parseRerated(x: unknown): { planId: string; gauges: Gauges }[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, 3).flatMap((r) => {
    const v = (r && typeof r === "object" ? r : {}) as { planId?: unknown; gauges?: Record<string, unknown> };
    if (typeof v.planId !== "string" || !v.gauges || typeof v.gauges !== "object") return [];
    const g = v.gauges;
    return [{ planId: v.planId, gauges: { resources: rating(g.resources), likability: rating(g.likability), confidence: rating(g.confidence), coherence: rating(g.coherence) } }];
  });
}

/** The written plans' Gauges as they stand, in slot order. */
export function ratedPlans(plans: OdysseyPlan[]): PlanRating[] {
  return plans
    .filter((p) => p.title.trim())
    .sort((a, b) => a.slot - b.slot)
    .map((p) => ({ planId: p.id, slot: p.slot, title: p.title, gauges: { ...p.gauges } }));
}
