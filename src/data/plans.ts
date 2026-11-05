import { and, eq, inArray, isNull } from "drizzle-orm";
import { objectiveRoom, type FoldResolution } from "@/domain/objectives";
import { switchPlan, type PlanSwitchError } from "@/domain/plan-switch";
import type { Objective, ObjectiveStatus, OdysseyPlan } from "@/domain/types";
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
  await db.update(objectives).set({ status }).where(and(eq(objectives.userId, userId), eq(objectives.id, id)));
  return { ok: true };
}

/** Switch the Active Plan (see `switchPlan`), writing every change in one transaction. */
export async function setActivePlan(
  db: Db,
  userId: string,
  planId: string,
  resolution: FoldResolution | null,
  ctx: { quarter: string; now: string; newObjectiveId: string },
): Promise<{ ok: true } | { ok: false; error: PlanSwitchError }> {
  const [ps, os, open] = await Promise.all([
    listPlans(db, userId),
    listObjectives(db, userId),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNull(tasks.doneAt), isNull(tasks.closedAt))),
  ]);
  const before = { plans: ps, objectives: os, tasks: open.map(toTask) };
  const r = switchPlan(before, planId, resolution, ctx);
  if (!r.ok) return r;

  const after = r.world;
  const was = <T extends { id: string }>(list: T[], x: T) => list.find((y) => y.id === x.id);
  await atomic(db, (d) => {
    const qs: PromiseLike<unknown>[] = [
      // Off first, then on: at most one Active Plan holds at every step.
      d.update(plans).set({ isActive: false }).where(and(eq(plans.userId, userId), eq(plans.isActive, true))),
      d.update(plans).set({ isActive: true }).where(and(eq(plans.userId, userId), eq(plans.id, planId))),
    ];
    for (const o of after.objectives) {
      const old = was(before.objectives, o);
      if (!old) qs.push(d.insert(objectives).values({ ...o, userId }));
      else if (old.planId !== o.planId)
        qs.push(d.update(objectives).set({ planId: o.planId }).where(and(eq(objectives.userId, userId), eq(objectives.id, o.id))));
    }
    const converted = after.tasks.filter((t) => t.kind === "objective" && was(before.tasks, t)?.kind === "prototype");
    const closed = after.tasks.filter((t) => t.closedAt && !was(before.tasks, t)?.closedAt);
    if (converted.length)
      qs.push(
        d
          .update(tasks)
          .set({ kind: "objective", objectiveId: converted[0].objectiveId, prototypePlanId: null })
          .where(and(eq(tasks.userId, userId), inArray(tasks.id, converted.map((t) => t.id)))),
      );
    if (closed.length)
      qs.push(
        d
          .update(tasks)
          .set({ closedAt: ctx.now })
          .where(and(eq(tasks.userId, userId), inArray(tasks.id, closed.map((t) => t.id)))),
      );
    return qs;
  });
  return { ok: true };
}
