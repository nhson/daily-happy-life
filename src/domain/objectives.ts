import type { Objective } from "./types";

/** Three is the ceiling: few enough that each one gets real attention this quarter. */
export const MAX_ACTIVE_OBJECTIVES = 3;

/** How many more Objectives can be active this quarter. */
export function objectiveRoom(objectives: Pick<Objective, "status" | "quarter">[], quarter: string): number {
  const active = objectives.filter((o) => o.status === "active" && o.quarter === quarter).length;
  return Math.max(0, MAX_ACTIVE_OBJECTIVES - active);
}

/**
 * What to do with a new Active Plan's open Prototypes: fold them into a new Objective,
 * into one already active this quarter (it then moves under the new plan), or close them.
 */
export type FoldResolution = { fold: string } | { into: string } | "close";

export function checkFold(
  resolution: FoldResolution,
  objectives: Pick<Objective, "id" | "status" | "quarter">[],
  quarter: string,
): "ok" | "no_room" | "objective_not_found" {
  if (resolution === "close") return "ok";
  if ("fold" in resolution) return objectiveRoom(objectives, quarter) > 0 ? "ok" : "no_room";
  const target = objectives.find((o) => o.id === resolution.into);
  return target && target.status === "active" && target.quarter === quarter ? "ok" : "objective_not_found";
}
