import { checkFold, type FoldResolution } from "./objectives";
import { promotionEffects } from "./task-rules";
import type { Objective, OdysseyPlan, Task } from "./types";

export interface World {
  plans: OdysseyPlan[];
  objectives: Objective[];
  tasks: Task[];
}

export type PlanSwitchError = "plan_not_found" | "resolution_required" | "no_room" | "objective_not_found";

/**
 * Make `planId` the Active Plan. Its open Prototypes are folded into a new Objective (only while
 * there is room), into an active one (which moves under the new plan), or closed. Pure: the
 * browser store and the server apply the same result.
 */
export function switchPlan(
  world: World,
  planId: string,
  resolution: FoldResolution | null,
  ctx: { quarter: string; now: string; newObjectiveId: string },
): { ok: true; world: World } | { ok: false; error: PlanSwitchError } {
  if (!world.plans.some((p) => p.id === planId)) return { ok: false, error: "plan_not_found" };
  const affected = new Set(promotionEffects(planId, world.tasks).map((t) => t.id));
  if (affected.size && !resolution) return { ok: false, error: "resolution_required" };

  let objectives = world.objectives;
  let foldId: string | null = null;
  if (affected.size && resolution) {
    const check = checkFold(resolution, world.objectives, ctx.quarter);
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
        if (!affected.has(t.id)) return t;
        return foldId ? { ...t, kind: "objective", objectiveId: foldId, prototypePlanId: null } : { ...t, closedAt: ctx.now };
      }),
    },
  };
}
