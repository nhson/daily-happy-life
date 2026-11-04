/**
 * First-run onboarding after setup: one-time tips, Odyssey nudges, the reminder ask.
 * Pure rules — see SPEC §7 "First run". Day N counts Logical Days since setup (setup day = 1).
 */
import { addDays, dayIndex } from "./logical-day";
import type { LogicalDate, OdysseyPlan } from "./types";

export type TipId = "top3" | "capture" | "morning" | "evening" | "closedDay" | "life";
export type PlanSlot = 1 | 2 | 3;

export interface NudgeState {
  snoozedUntil: LogicalDate | null;
  notNowCount: number;
}

export interface OnboardingState {
  /** Logical Day setup finished; null before setup. */
  setupDate: LogicalDate | null;
  seenTips: TipId[];
  reminderAskedAt: string | null;
  nudges: Partial<Record<`${PlanSlot}`, NudgeState>>;
}

/** Logical Day on which each plan's nudge first appears. */
export const NUDGE_DAY: Record<PlanSlot, number> = { 1: 2, 2: 4, 3: 6 };
const SNOOZE_DAYS = 2;
const MAX_NOT_NOW = 3;

export function freshOnboarding(setupDate: LogicalDate | null): OnboardingState {
  return { setupDate, seenTips: [], reminderAskedAt: null, nudges: {} };
}

/** Day 1 is the setup day. */
export function dayNumber(setupDate: LogicalDate, today: LogicalDate): number {
  return dayIndex(today) - dayIndex(setupDate) + 1;
}

/** The plan to nudge about today: the earliest unwritten plan whose day has come, unless snoozed or given up on. */
export function dueNudge(onboarding: OnboardingState, today: LogicalDate, plans: OdysseyPlan[]): PlanSlot | null {
  if (!onboarding.setupDate) return null;
  const day = dayNumber(onboarding.setupDate, today);
  for (const slot of [1, 2, 3] as const) {
    if (plans.find((p) => p.slot === slot)?.title.trim()) continue;
    if (day < NUDGE_DAY[slot]) return null; // later plans come later still
    const n = onboarding.nudges[`${slot}`];
    if (n && n.notNowCount >= MAX_NOT_NOW) continue;
    if (n?.snoozedUntil && today < n.snoozedUntil) return null;
    return slot;
  }
  return null;
}

/** "Not now": hide this plan's nudge for two days; the third time, stop for good. */
export function snoozeNudge(onboarding: OnboardingState, slot: PlanSlot, today: LogicalDate): OnboardingState {
  const prev = onboarding.nudges[`${slot}`];
  return {
    ...onboarding,
    nudges: {
      ...onboarding.nudges,
      [`${slot}`]: { snoozedUntil: addDays(today, SNOOZE_DAYS), notNowCount: (prev?.notNowCount ?? 0) + 1 },
    },
  };
}

export type TodayCard = { type: "tip"; tip: "top3" | "closedDay" } | { type: "reminder" } | { type: "nudge"; slot: PlanSlot } | null;

/** At most one onboarding card on Today, in priority tip → reminder ask → Odyssey nudge. */
export function todayCard(input: {
  onboarding: OnboardingState;
  today: LogicalDate;
  plans: OdysseyPlan[];
  mode: "morning" | "day" | "evening" | "night";
  hasTop3: boolean;
  hasClosedDay: boolean;
}): TodayCard {
  const { onboarding, today, plans, mode, hasTop3, hasClosedDay } = input;
  if (!onboarding.setupDate || mode === "evening") return null;
  const unseen = (t: TipId) => !onboarding.seenTips.includes(t);

  if (mode === "night" && unseen("closedDay")) return { type: "tip", tip: "closedDay" };
  if (mode !== "night" && hasTop3 && unseen("top3")) return { type: "tip", tip: "top3" };
  if (hasClosedDay && !onboarding.reminderAskedAt) return { type: "reminder" };
  const slot = dueNudge(onboarding, today, plans);
  return slot ? { type: "nudge", slot } : null;
}
