import type { LogicalDate } from "./types";

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: Date, timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(instant)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** The Logical Day an instant belongs to: before `dayEndHour` local time it is still yesterday. */
export function logicalDate(instant: Date, timeZone: string, dayEndHour: number): LogicalDate {
  const { date, hour } = wallClock(instant, timeZone);
  return hour < dayEndHour ? addDays(date, -1) : date;
}

/** Minutes since local midnight in the given zone. */
export function localMinutes(instant: Date, timeZone: string): number {
  const { hour, minute } = wallClock(instant, timeZone);
  return hour * 60 + minute;
}

export function addDays(date: LogicalDate, n: number): LogicalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01. */
export function dayIndex(date: LogicalDate): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export function quarterOf(date: LogicalDate): string {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
}

/** How far into its quarter a Logical Day is: week N of 13, and the share of the quarter's days gone by. */
export function quarterProgress(date: LogicalDate): { week: number; weeks: 13; fraction: number } {
  const y = Number(date.slice(0, 4));
  const q = Math.ceil(Number(date.slice(5, 7)) / 3);
  const start = Date.UTC(y, (q - 1) * 3, 1);
  const end = Date.UTC(y, q * 3, 1);
  const day = Date.UTC(y, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const elapsed = Math.round((day - start) / 86_400_000);
  const total = Math.round((end - start) / 86_400_000);
  return { week: Math.min(13, Math.floor(elapsed / 7) + 1), weeks: 13, fraction: elapsed / total };
}
