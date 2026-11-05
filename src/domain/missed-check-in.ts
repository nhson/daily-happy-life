import { addDays } from "./logical-day";
import type { DailyLog, LogicalDate } from "./types";

/**
 * The previous Logical Day, if its Evening Check-in was never closed — the morning offers to
 * close it ("Close yesterday?"). Only yesterday, and only once there was a yesterday since setup.
 */
export function missedCheckIn(s: {
  logs: Record<LogicalDate, Pick<DailyLog, "closedAt">>;
  today: LogicalDate;
  setupDate: LogicalDate | null;
}): LogicalDate | null {
  const yesterday = addDays(s.today, -1);
  if (!s.setupDate || s.setupDate > yesterday) return null;
  return s.logs[yesterday]?.closedAt ? null : yesterday;
}
