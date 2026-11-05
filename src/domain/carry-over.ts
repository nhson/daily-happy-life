import { addDays } from "./logical-day";
import type { LogicalDate, Task } from "./types";

/** How far back the morning looks for an unfinished Top 3. */
export const CARRY_OVER_DAYS = 7;

/** The earliest Logical Day carry-over can reach back to. */
export const carryOverSince = (today: LogicalDate): LogicalDate => addDays(today, -CARRY_OVER_DAYS);

/**
 * The morning's "carry over" chips: the still-open tasks of the most recent Logical Day before
 * today that had a Top 3, looking back at most seven days. In that day's order.
 */
export function carryOver(
  logs: { date: LogicalDate; top3TaskIds: string[] }[],
  tasks: Task[],
  today: LogicalDate,
): Task[] {
  const from = carryOverSince(today);
  const last = logs
    .filter((l) => l.date < today && l.date >= from && l.top3TaskIds.length)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!last) return [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return last.top3TaskIds
    .map((id) => byId.get(id))
    .filter((t): t is Task => !!t && !t.doneAt && !t.closedAt && t.top3Date !== today);
}
