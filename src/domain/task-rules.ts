import type { Objective, OdysseyPlan, Task, TaskKind } from "./types";

export type TaskLinkError =
  | "objective_required"
  | "objective_not_found"
  | "plan_required"
  | "plan_not_found"
  | "prototype_on_active_plan"
  | "extra_link";

export type TaskLinkResult = { ok: true } | { ok: false; error: TaskLinkError };

interface Link {
  kind: TaskKind;
  objectiveId: string | null;
  prototypePlanId: string | null;
}

interface Context {
  plans: Pick<OdysseyPlan, "id" | "isActive">[];
  objectives: Pick<Objective, "id" | "status">[];
}

/** Every task has exactly one "why": an Objective, Maintenance, or a Prototype of a non-active plan. */
export function validateTaskLink(link: Link, ctx: Context): TaskLinkResult {
  const fail = (error: TaskLinkError): TaskLinkResult => ({ ok: false, error });
  switch (link.kind) {
    case "objective":
      if (link.prototypePlanId) return fail("extra_link");
      if (!link.objectiveId) return fail("objective_required");
      if (!ctx.objectives.some((o) => o.id === link.objectiveId)) return fail("objective_not_found");
      return { ok: true };
    case "maintenance":
      if (link.objectiveId || link.prototypePlanId) return fail("extra_link");
      return { ok: true };
    case "prototype": {
      if (link.objectiveId) return fail("extra_link");
      if (!link.prototypePlanId) return fail("plan_required");
      const plan = ctx.plans.find((p) => p.id === link.prototypePlanId);
      if (!plan) return fail("plan_not_found");
      if (plan.isActive) return fail("prototype_on_active_plan");
      return { ok: true };
    }
  }
}

/** Open Prototype tasks that must be converted or closed when `planId` becomes the Active Plan. */
export function promotionEffects(planId: string, tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => t.kind === "prototype" && t.prototypePlanId === planId && !t.doneAt && !t.closedAt,
  );
}
