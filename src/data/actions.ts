"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { FoldResolution } from "@/domain/objectives";
import type { OnboardingState } from "@/domain/onboarding";
import type { Compass, Decision, LogicalDate, ObjectiveStatus, OdysseyPlan, UserSettings } from "@/domain/types";
import * as days from "./days";
import * as life from "./life";
import * as onboarding from "./onboarding";
import { db } from "./db/client";
import * as schema from "./db/schema";
import * as plans from "./plans";
import type { KindChoice } from "./state";
import * as tasks from "./tasks";
import { saveSettings, type User } from "./users";

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

export async function setActivePlanAction(planId: string, resolution: FoldResolution | null, quarter: string, newObjectiveId: string) {
  return plans.setActivePlan(db, (await me()).id, planId, resolution, { quarter, now: now(), newObjectiveId });
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

export async function saveOnboardingAction(state: OnboardingState) {
  await onboarding.saveOnboarding(db, (await me()).id, state);
  return { ok: true as const };
}

export async function completeOnboardingAction(input: Parameters<typeof onboarding.completeOnboarding>[2]) {
  return onboarding.completeOnboarding(db, (await me()).id, input);
}
