import { localMinutes } from "./logical-day";

export type RitualMode = "morning" | "day" | "evening" | "night";

/**
 * Where the Logical Day stands. Hours are read in the user's timezone, never the device clock:
 * evening runs from `eveningHour` until `dayEndHour` the next morning; a closed day is night.
 */
export function ritualMode(
  now: Date,
  s: { timeZone: string; eveningHour: number; dayEndHour: number; morningAt: string | null; closedAt: string | null },
): RitualMode {
  if (s.closedAt) return "night";
  const hour = Math.floor(localMinutes(now, s.timeZone) / 60);
  if (hour >= s.eveningHour || hour < s.dayEndHour) return "evening";
  return s.morningAt ? "day" : "morning";
}
