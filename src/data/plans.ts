import { and, eq, inArray, isNull } from "drizzle-orm";
import { objectiveRoom } from "@/domain/objectives";
import { finishObjective as finish, switchPlan, type PlanSwitchError, type Settle } from "@/domain/plan-switch";
import type { Objective, ObjectiveStatus, OdysseyPlan, Task } from "@/domain/types";
import * as schema from "./db/schema";
import { atomic, toObjective, toPlan, toTask } from "./rows";
import type { Db } from "./users";

/** Odyssey Plans and Objectives of one user. Every function takes `userId`. */

const { odysseyPlans: plans, objectives, tasks } = schema;

/** Every user has three plan slots from the start; slot 1 is the implicit Current Path. */
export async function ensurePlans(db: Db, userId: string): Promise<void> {
  await db
    .insert(plans)
    .values(([1, 2, 3] as const).map((slot) => ({ userId, slot })))
    .onConflictDoNothing();
}

export async function listPlans(db: Db, userId: string): Promise<OdysseyPlan[]> {
  const rows = await db.select().from(plans).where(eq(plans.userId, userId)).orderBy(plans.slot);
  return rows.map(toPlan);
}

export async function listObjectives(db: Db, userId: string): Promise<Objective[]> {
  const rows = await db.select().from(objectives).where(eq(objectives.userId, userId)).orderBy(objectives.createdAt);
  return rows.map(toObjective);
}

/** Title, questions and gauges. Which plan is active changes only through `setActivePlan`. */
export async function savePlan(db: Db, userId: string, p: OdysseyPlan): Promise<boolean> {
  const rows = await db
    .update(plans)
    .set({ title: p.title, questions: p.questions, ...p.gauges, updatedAt: new Date().toISOString() })
    .where(and(eq(plans.userId, userId), eq(plans.id, p.id)))
    .returning({ id: plans.id });
  return rows.length > 0;
}

export type ObjectiveError = "no_room" | "not_found" | "empty_title";

/** A new Objective this quarter, under the Active Plan or, until one is chosen, the Current Path. */
export async function addObjective(
  db: Db,
  userId: string,
  input: { id: string; title: string; quarter: string },
): Promise<{ ok: true } | { ok: false; error: ObjectiveError }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "empty_title" };
  const [all, ps] = await Promise.all([listObjectives(db, userId), listPlans(db, userId)]);
  if (all.some((o) => o.id === input.id)) return { ok: true };
  if (objectiveRoom(all, input.quarter) === 0) return { ok: false, error: "no_room" };
  const plan = ps.find((p) => p.isActive) ?? ps.find((p) => p.slot === 1);
  if (!plan) return { ok: false, error: "not_found" };
  await db.insert(objectives).values({ id: input.id, userId, planId: plan.id, title, quarter: input.quarter });
  return { ok: true };
}

/** Done, Dropped, or active again — reactivating only fits while there is room. */
export async function setObjectiveStatus(
  db: Db,
  userId: string,
  id: string,
  status: ObjectiveStatus,
): Promise<{ ok: true } | { ok: false; error: ObjectiveError }> {
  const all = await listObjectives(db, userId);
  const o = all.find((x) => x.id === id);
  if (!o) return { ok: false, error: "not_found" };
  if (status === "active" && o.status !== "active" && objectiveRoom(all, o.quarter) === 0) return { ok: false, error: "no_room" };
  // Done always settles the open tasks; closing them is the default.
  if (status === "done" && o.status === "active") {
    const r = await finishObjective(db, userId, id, "close", new Date().toISOString());
    return r.ok ? r : { ok: false, error: "not_found" };
  }
  await db.update(objectives).set({ status }).where(and(eq(objectives.userId, userId), eq(objectives.id, id)));
  return { ok: true };
}

const openTasks = (db: Db, userId: string) =>
  db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.doneAt), isNull(tasks.closedAt)))
    .then((rows) => rows.map(toTask));

type Change = { objectives: Objective[]; tasks: Task[] };

/** The writes that turn `before` into `after`: new or changed Objectives, closed and re-homed tasks. */
function writes(d: Db, userId: string, before: Change, after: Change, now: string): PromiseLike<unknown>[] {
  const was = <T extends { id: string }>(list: T[], x: T) => list.find((y) => y.id === x.id);
  const qs: PromiseLike<unknown>[] = [];
  for (const o of after.objectives) {
    const old = was(before.objectives, o);
    if (!old) qs.push(d.insert(objectives).values({ ...o, userId }));
    else if (old.planId !== o.planId || old.status !== o.status)
      qs.push(d.update(objectives).set({ planId: o.planId, status: o.status }).where(and(eq(objectives.userId, userId), eq(objectives.id, o.id))));
  }
  const closed = after.tasks.filter((t) => t.closedAt && !was(before.tasks, t)?.closedAt);
  if (closed.length)
    qs.push(d.update(tasks).set({ closedAt: now }).where(and(eq(tasks.userId, userId), inArray(tasks.id, closed.map((t) => t.id)))));
  // Re-homed (Prototype folded into an Objective, or moved to another Objective), grouped by destination.
  const moved = after.tasks.filter((t) => {
    const old = was(before.tasks, t);
    return !t.closedAt && old && (old.objectiveId !== t.objectiveId || old.kind !== t.kind);
  });
  for (const to of new Set(moved.map((t) => t.objectiveId))) {
    const ids = moved.filter((t) => t.objectiveId === to).map((t) => t.id);
    qs.push(d.update(tasks).set({ kind: "objective", objectiveId: to, prototypePlanId: null }).where(and(eq(tasks.userId, userId), inArray(tasks.id, ids))));
  }
  return qs;
}

/** Switch the Active Plan (see `switchPlan`), writing every change in one transaction. */
export async function setActivePlan(
  db: Db,
  userId: string,
  planId: string,
  settle: Settle,
  ctx: { quarter: string; now: string; newObjectiveId: string },
): Promise<{ ok: true } | { ok: false; error: PlanSwitchError }> {
  const [ps, os, open] = await Promise.all([listPlans(db, userId), listObjectives(db, userId), openTasks(db, userId)]);
  const before = { plans: ps, objectives: os, tasks: open };
  const r = switchPlan(before, planId, settle, ctx);
  if (!r.ok) return r;
  if (r.world === before) return { ok: true };
  await atomic(db, (d) => [
    // Off first, then on: at most one Active Plan holds at every step.
    d.update(plans).set({ isActive: false }).where(and(eq(plans.userId, userId), eq(plans.isActive, true))),
    d.update(plans).set({ isActive: true }).where(and(eq(plans.userId, userId), eq(plans.id, planId))),
    ...writes(d, userId, before, r.world, ctx.now),
  ]);
  return { ok: true };
}

/** Mark an Objective Done; its open tasks are closed or moved (see `finishObjective`), in one transaction. */
export async function finishObjective(
  db: Db,
  userId: string,
  id: string,
  then: "close" | { move: string },
  now: string,
): Promise<{ ok: true } | { ok: false; error: "objective_not_found" }> {
  const [os, open] = await Promise.all([listObjectives(db, userId), openTasks(db, userId)]);
  const before = { objectives: os, tasks: open };
  const r = finish(before, id, then, now);
  if (!r.ok) return r;
  await atomic(db, (d) => writes(d, userId, before, r.world, now));
  return { ok: true };
}
