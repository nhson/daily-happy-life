import type { Objective } from "./types";

/** Three is the ceiling: few enough that each one gets real attention this quarter. */
export const MAX_ACTIVE_OBJECTIVES = 3;

/** How many more Objectives can be active this quarter. */
export function objectiveRoom(objectives: Pick<Objective, "status" | "quarter">[], quarter: string): number {
  const active = objectives.filter((o) => o.status === "active" && o.quarter === quarter).length;
  return Math.max(0, MAX_ACTIVE_OBJECTIVES - active);
}
