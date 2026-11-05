import { objectiveRoom } from "./objectives";
import type { Objective, Task } from "./types";

/**
 * Quarter Close (SPEC "Quarter Close", GLOSSARY): at the start of a new quarter each still-active
 * Objective of an earlier one is marked Done, Dropped or Carried Forward. Until then it stays in use.
 */
export type LeftoverChoice = "done" | "drop" | "carry";

/** Still-active Objectives of any earlier quarter. Quarter labels ("2026-Q4") sort as text. */
export function leftovers<T extends Pick<Objective, "status" | "quarter">>(objectives: T[], quarter: string): T[] {
  return objectives.filter((o) => o.status === "active" && o.quarter < quarter);
}

type World = { objectives: Objective[]; tasks: Task[] };

/**
 * Done and Drop end the Objective and close its open tasks. Carry forward copies it into the new
 * quarter (room permitting) and moves its open tasks to the copy; the old one is kept as history.
 */
export function settleLeftover(
  world: World,
  id: string,
  choice: LeftoverChoice,
  ctx: { quarter: string; now: string; newObjectiveId: string },
): { ok: true; world: World } | { ok: false; error: "objective_not_found" | "no_room" } {
  const o = world.objectives.find((x) => x.id === id);
  if (!o || !leftovers([o], ctx.quarter).length) return { ok: false, error: "objective_not_found" };
  const isOpen = (t: Task) => t.objectiveId === id && !t.doneAt && !t.closedAt;

  if (choice === "carry") {
    if (objectiveRoom(world.objectives, ctx.quarter) === 0) return { ok: false, error: "no_room" };
    const copy: Objective = { id: ctx.newObjectiveId, planId: o.planId, title: o.title, quarter: ctx.quarter, status: "active" };
    return {
      ok: true,
      world: {
        objectives: [...world.objectives.map((x) => (x.id === id ? { ...x, status: "carried" as const } : x)), copy],
        tasks: world.tasks.map((t) => (isOpen(t) ? { ...t, objectiveId: copy.id } : t)),
      },
    };
  }
  const status = choice === "done" ? ("done" as const) : ("dropped" as const);
  return {
    ok: true,
    world: {
      objectives: world.objectives.map((x) => (x.id === id ? { ...x, status } : x)),
      tasks: world.tasks.map((t) => (isOpen(t) ? { ...t, closedAt: ctx.now } : t)),
    },
  };
}
