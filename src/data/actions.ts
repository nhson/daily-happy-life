"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { FoldResolution } from "@/domain/objectives";
import type { Settle } from "@/domain/plan-switch";
import { logicalDate, quarterOf } from "@/domain/logical-day";
import type { LeftoverChoice } from "@/domain/quarter-close";
import { parseOnboardingEvent } from "@/domain/onboarding";
import type { Compass, Decision, LogicalDate, ObjectiveStatus, OdysseyPlan, UserSettings } from "@/domain/types";
import * as days from "./days";
import * as life from "./life";
import * as onboarding from "./onboarding";
import { db } from "./db/client";
import * as schema from "./db/schema";
import * as plans from "./plans";
import type { KindChoice } from "./state";
import * as tasks from "./tasks";
import { openRouterReviewer } from "./ai";
import * as focus from "./focus";
import * as weekly from "./weekly-review";
import * as quarterly from "./quarterly-review";
import { parseDashboard, parseRerated, previousQuarter } from "@/domain/quarterly-review";
import { qstashLater, qstashScheduler } from "./push-services";
import { savePush, syncReminder, type PushSubscriptionJSON } from "./reminders";
import { saveSettings, settingsOf, type User } from "./users";

/**
 * Server Actions behind the store's live mode. Each one acts as the signed-in user only; the
 * browser applies the change first (optimistic) and resyncs if one of these says no.
 */

async function me(): Promise<User> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.clerkId, userId));
  if (!user) throw new Error("No user row");
  return user;
}

const now = () => new Date().toISOString();

export async function createTaskAction(input: { id: string; title: string; choice: KindChoice }) {
  return tasks.createTask(db, (await me()).id, input);
}

export async function editTaskAction(id: string, patch: { title?: string; choice?: KindChoice; dueDate?: string | null }) {
  return tasks.editTask(db, (await me()).id, id, patch);
}

export async function setDoneAction(id: string, done: boolean) {
  return tasks.setDone(db, (await me()).id, id, done ? now() : null);
}

export async function setTop3Action(id: string, date: string | null) {
  return tasks.setTop3(db, (await me()).id, id, date);
}

export async function replaceTop3Action(date: string, ids: string[]) {
  return tasks.replaceTop3(db, (await me()).id, date, ids);
}

export async function closeTaskAction(id: string) {
  return tasks.closeTask(db, (await me()).id, id, now());
}

export async function deleteTaskAction(id: string) {
  return tasks.deleteTask(db, (await me()).id, id);
}

export async function savePlanAction(plan: OdysseyPlan) {
  return { ok: await plans.savePlan(db, (await me()).id, plan) };
}

/** Only "keep"/"drop" choices and a well-formed Prototype resolution get through; the rest is ignored. */
function settleOf(x: unknown): Settle {
  const v = (x ?? {}) as { objectives?: unknown; prototypes?: unknown };
  const objectives: Settle["objectives"] = {};
  if (v.objectives && typeof v.objectives === "object")
    for (const [id, c] of Object.entries(v.objectives)) if (c === "keep" || c === "drop") objectives[id] = c;
  const p = v.prototypes as Record<string, unknown> | string | null | undefined;
  const prototypes: FoldResolution | null =
    p === "close"
      ? "close"
      : p && typeof p === "object" && typeof p.fold === "string" && p.fold.trim()
        ? { fold: p.fold.slice(0, 200) }
        : p && typeof p === "object" && typeof p.into === "string"
          ? { into: p.into }
          : null;
  return { objectives, prototypes };
}

export async function setActivePlanAction(planId: string, settle: Settle, quarter: string, newObjectiveId: string) {
  return plans.setActivePlan(db, (await me()).id, planId, settleOf(settle), { quarter, now: now(), newObjectiveId });
}

export async function finishObjectiveAction(id: string, then: "close" | { move: string }) {
  const t = then !== "close" && typeof then?.move === "string" ? { move: then.move } : "close";
  return plans.finishObjective(db, (await me()).id, id, t, now());
}

/** Quarter Close. The new quarter is the server's own reading of the user's Logical Day. */
export async function settleLeftoverAction(id: string, choice: LeftoverChoice, newObjectiveId: string) {
  if (choice !== "done" && choice !== "drop" && choice !== "carry") return { ok: false as const };
  const user = await me();
  const { timeZone, dayEndHour } = settingsOf(user);
  const quarter = quarterOf(logicalDate(new Date(), timeZone, dayEndHour));
  return plans.settleLeftover(db, user.id, id, choice, { quarter, now: now(), newObjectiveId });
}

export async function addObjectiveAction(input: { id: string; title: string; quarter: string }) {
  return plans.addObjective(db, (await me()).id, input);
}

export async function setObjectiveStatusAction(id: string, status: ObjectiveStatus) {
  return plans.setObjectiveStatus(db, (await me()).id, id, status);
}

export async function saveSettingsAction(patch: Partial<UserSettings>) {
  const user = await me();
  await saveSettings(db, user.id, patch);
  // The reminder follows a new time or zone.
  const scheduler = qstashScheduler();
  if (scheduler && (patch.reminderTime !== undefined || patch.timeZone !== undefined)) await syncReminder(db, user.id, scheduler);
  return { ok: true as const };
}

export async function patchLogAction(date: LogicalDate, patch: days.LogPatch) {
  await days.patchLog(db, (await me()).id, date, patch);
  return { ok: true as const };
}

export async function saveCompassAction(c: Compass) {
  if (!c.workview.trim() || !c.lifeview.trim()) return { ok: false as const };
  await life.saveCompass(db, (await me()).id, c);
  return { ok: true as const };
}

export async function addDecisionAction(d: Decision) {
  return life.addDecision(db, (await me()).id, d);
}

export async function recordOnboardingAction(event: unknown) {
  const e = parseOnboardingEvent(event);
  if (!e) return { ok: false as const };
  const user = await me();
  const { timeZone, dayEndHour } = settingsOf(user);
  const at = new Date();
  const stored = await onboarding.recordOnboarding(db, user.id, e, { today: logicalDate(at, timeZone, dayEndHour), now: at.toISOString() });
  return stored ? { ok: true as const } : { ok: false as const };
}

export async function completeOnboardingAction(input: Parameters<typeof onboarding.completeOnboarding>[2]) {
  return onboarding.completeOnboarding(db, (await me()).id, input);
}

/** Reminders on for this device (its push subscription) or off (null). */
export async function savePushAction(sub: PushSubscriptionJSON | null) {
  const scheduler = qstashScheduler();
  if (!scheduler) return { ok: false as const };
  return savePush(db, (await me()).id, sub, scheduler);
}

/** Focus Sessions: the server's clock decides when it started and ended. */
export async function startFocusAction(input: { id: string; taskId: string; minutes: number }) {
  return focus.startFocus(db, (await me()).id, { id: String(input.id), taskId: String(input.taskId), minutes: input.minutes }, new Date(), qstashLater());
}

export async function endFocusAction(id: string) {
  return focus.endFocus(db, (await me()).id, String(id), new Date(), qstashLater());
}

/** Weekly Review: the numbers from the database, the notes from the AI (when it answers). */
export async function startReviewAction(weekEnd: string) {
  return weekly.startReview(db, (await me()).id, String(weekEnd), new Date(), openRouterReviewer());
}

export async function saveTakeawayAction(weekEnd: string, text: string) {
  return weekly.saveTakeaway(db, (await me()).id, String(weekEnd), String(text ?? ""));
}

/** Quarterly Review: always of the quarter before the user's own Logical Day, by the server's clock. */
async function reviewedQuarter(): Promise<{ user: User; quarter: string }> {
  const user = await me();
  const { timeZone, dayEndHour } = settingsOf(user);
  return { user, quarter: previousQuarter(quarterOf(logicalDate(new Date(), timeZone, dayEndHour))) };
}

export async function saveDashboardAction(dashboard: unknown) {
  const { user, quarter } = await reviewedQuarter();
  return quarterly.saveDashboard(db, user.id, quarter, parseDashboard(dashboard));
}

export async function finishQuarterPlansAction(rerated: unknown) {
  const { user, quarter } = await reviewedQuarter();
  return quarterly.finishQuarterPlans(db, user.id, quarter, now(), parseRerated(rerated));
}

export async function completeQuarterReviewAction() {
  const { user, quarter } = await reviewedQuarter();
  return quarterly.completeQuarterReview(db, user.id, quarter, now());
}

/** The yearly Compass (review of Q4): a rewrite, or null to keep it. */
export async function reviewCompassAction(next: Compass | null) {
  const { user, quarter } = await reviewedQuarter();
  const c = next && typeof next.workview === "string" && typeof next.lifeview === "string" ? { workview: next.workview.slice(0, 1000), lifeview: next.lifeview.slice(0, 1000) } : null;
  return quarterly.reviewCompass(db, user.id, quarter, now(), c);
}
