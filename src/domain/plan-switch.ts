import { checkFold, type FoldResolution } from "./objectives";
import { promotionEffects } from "./task-rules";
import type { Objective, OdysseyPlan, Task } from "./types";

export interface World {
  plans: OdysseyPlan[];
  objectives: Objective[];
  tasks: Task[];
}

export type PlanSwitchError = "plan_not_found" | "resolution_required" | "objectives_unsettled" | "no_room" | "objective_not_found";

/**
 * How one sheet settles both sides of a plan switch (SPEC "Promoting a plan"):
 * - `objectives`: each still-active Objective of the old plan → keep (moves under the new plan) or
 *   drop (ends; its open tasks are closed);
 * - `prototypes`: the new plan's open Prototypes → folded into a new Objective, into an active
 *   one, or closed.
 */
export interface Settle {
  objectives: Record<string, "keep" | "drop">;
  prototypes: FoldResolution | null;
}

/** The still-active Objectives of the current Active Plan, which a switch away has to settle. */
export function objectivesToSettle(world: Pick<World, "plans" | "objectives">): Objective[] {
  const old = world.plans.find((p) => p.isActive);
  return old ? world.objectives.filter((o) => o.planId === old.id && o.status === "active") : [];
}

/**
 * Make `planId` the Active Plan, settling the old plan's Objectives first (dropping one makes room)
 * and then the new plan's Prototypes. Pure: the browser store and the server apply the same result.
 */
export function switchPlan(
  world: World,
  planId: string,
  settle: Settle,
  ctx: { quarter: string; now: string; newObjectiveId: string },
): { ok: true; world: World } | { ok: false; error: PlanSwitchError } {
  const target = world.plans.find((p) => p.id === planId);
  if (!target) return { ok: false, error: "plan_not_found" };
  if (target.isActive) return { ok: true, world };

  const toSettle = objectivesToSettle(world);
  if (toSettle.some((o) => !settle.objectives[o.id])) return { ok: false, error: "objectives_unsettled" };
  const dropped = new Set(toSettle.filter((o) => settle.objectives[o.id] === "drop").map((o) => o.id));
  const kept = new Set(toSettle.filter((o) => settle.objectives[o.id] === "keep").map((o) => o.id));
  let objectives = world.objectives.map((o) =>
    dropped.has(o.id) ? { ...o, status: "dropped" as const } : kept.has(o.id) ? { ...o, planId } : o,
  );

  const affected = new Set(promotionEffects(planId, world.tasks).map((t) => t.id));
  const resolution = settle.prototypes;
  if (affected.size && !resolution) return { ok: false, error: "resolution_required" };
  let foldId: string | null = null;
  if (affected.size && resolution) {
    const check = checkFold(resolution, objectives, ctx.quarter);
    if (check !== "ok") return { ok: false, error: check };
    if (resolution !== "close") {
      if ("fold" in resolution) {
        foldId = ctx.newObjectiveId;
        objectives = [...objectives, { id: foldId, planId, title: resolution.fold.trim(), quarter: ctx.quarter, status: "active" }];
      } else {
        foldId = resolution.into;
        objectives = objectives.map((o) => (o.id === foldId ? { ...o, planId } : o));
      }
    }
  }

  return {
    ok: true,
    world: {
      plans: world.plans.map((p) => (p.isActive === (p.id === planId) ? p : { ...p, isActive: p.id === planId })),
      objectives,
      tasks: world.tasks.map((t) => {
        if (affected.has(t.id))
          return foldId ? { ...t, kind: "objective", objectiveId: foldId, prototypePlanId: null } : { ...t, closedAt: ctx.now };
        if (t.objectiveId && dropped.has(t.objectiveId) && !t.doneAt && !t.closedAt) return { ...t, closedAt: ctx.now };
        return t;
      }),
    },
  };
}

/**
 * Mark an Objective Done mid-quarter. Its open tasks are closed (the default) or moved to another
 * active Objective; finished tasks stay with the Objective they were done for.
 */
export function finishObjective(
  world: Pick<World, "objectives" | "tasks">,
  id: string,
  then: "close" | { move: string },
  now: string,
): { ok: true; world: Pick<World, "objectives" | "tasks"> } | { ok: false; error: "objective_not_found" } {
  const o = world.objectives.find((x) => x.id === id);
  if (!o || o.status !== "active") return { ok: false, error: "objective_not_found" };
  if (then !== "close") {
    const to = world.objectives.find((x) => x.id === then.move);
    if (!to || to.id === id || to.status !== "active") return { ok: false, error: "objective_not_found" };
  }
  return {
    ok: true,
    world: {
      objectives: world.objectives.map((x) => (x.id === id ? { ...x, status: "done" } : x)),
      tasks: world.tasks.map((t) => {
        if (t.objectiveId !== id || t.doneAt || t.closedAt) return t;
        return then === "close" ? { ...t, closedAt: now } : { ...t, objectiveId: then.move };
      }),
    },
  };
}
