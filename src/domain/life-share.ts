import { addDays, logicalDate } from "./logical-day";
import type { LogicalDate, TaskKind } from "./types";

export interface LifeShare {
  counts: Record<TaskKind, number>;
  percent: Record<TaskKind, number>;
  total: number;
}

const KINDS: TaskKind[] = ["objective", "maintenance", "prototype"];

/** Completed-task split over the last 7 Logical Days (today included). Percentages sum to 100. */
export function lifeShare(
  tasks: { kind: TaskKind; doneAt: string | null }[],
  opts: { today: LogicalDate; timeZone: string; dayEndHour: number },
): LifeShare {
  const from = addDays(opts.today, -6);
  const counts: Record<TaskKind, number> = { objective: 0, maintenance: 0, prototype: 0 };
  for (const t of tasks) {
    if (!t.doneAt) continue;
    const d = logicalDate(new Date(t.doneAt), opts.timeZone, opts.dayEndHour);
    if (d >= from && d <= opts.today) counts[t.kind]++;
  }
  const total = counts.objective + counts.maintenance + counts.prototype;
  return { counts, total, percent: roundTo100(counts, total) };
}

/** Largest-remainder rounding so the parts always add up to 100. */
function roundTo100(counts: Record<TaskKind, number>, total: number): Record<TaskKind, number> {
  const out: Record<TaskKind, number> = { objective: 0, maintenance: 0, prototype: 0 };
  if (total === 0) return out;
  const raw = KINDS.map((k) => ({ k, v: (counts[k] / total) * 100 }));
  for (const r of raw) out[r.k] = Math.floor(r.v);
  let rest = 100 - KINDS.reduce((s, k) => s + out[k], 0);
  for (const r of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (rest-- <= 0) break;
    out[r.k]++;
  }
  return out;
}

/** The last 7 Logical Days, oldest first, marking which had a closed check-in. */
export function weekDots(checkedInDates: LogicalDate[], today: LogicalDate) {
  const set = new Set(checkedInDates);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, checkedIn: set.has(date) };
  });
}
