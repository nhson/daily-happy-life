"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { FoldResolution } from "@/domain/objectives";
import type { Settle } from "@/domain/plan-switch";
import { logicalDate } from "@/domain/logical-day";
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

export async function addObjectiveAction(input: { id: string; title: string; quarter: string }) {
  return plans.addObjective(db, (await me()).id, input);
}

export async function setObjectiveStatusAction(id: string, status: ObjectiveStatus) {
  return plans.setObjectiveStatus(db, (await me()).id, id, status);
}

export async function saveSettingsAction(patch: Partial<UserSettings>) {
  await saveSettings(db, (await me()).id, patch);
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
