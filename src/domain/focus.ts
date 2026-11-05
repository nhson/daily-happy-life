import { logicalDate } from "./logical-day";
import type { LogicalDate } from "./types";

/**
 * Focus Sessions (SPEC Phase 2 · 1): a timer attached to one Task. Only one runs at a time. When its
 * time is up it waits for an answer (done / another round / leave it); that answer, or stopping
 * early, ends it. Pure: the browser store and the server apply the same rules.
 */

export interface FocusSession {
  id: string;
  taskId: string;
  startedAt: string;
  plannedMinutes: number;
  /** When it was stopped or answered; null while it runs or waits for an answer. */
  endedAt: string | null;
}

/** The lengths offered; the last one picked is remembered on the device. */
export const FOCUS_MINUTES = [15, 25, 50] as const;
export const DEFAULT_FOCUS_MINUTES = 25;

/** A finished session stops asking for an answer this long after its end. */
const ASK_FOR_MS = 12 * 3600 * 1000;

export const isFocusMinutes = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 180;

export const endsAt = (s: FocusSession): Date => new Date(Date.parse(s.startedAt) + s.plannedMinutes * 60_000);

export type FocusPhase = "running" | "finished" | "ended";

export function phaseOf(s: FocusSession, now: Date): FocusPhase {
  if (s.endedAt) return "ended";
  return now < endsAt(s) ? "running" : "finished";
}

/** The session running, or finished and waiting for an answer (for at most 12 hours). */
export function currentFocus(sessions: FocusSession[], now: Date): FocusSession | null {
  let best: FocusSession | null = null;
  for (const s of sessions) {
    const phase = phaseOf(s, now);
    if (phase === "ended") continue;
    if (phase === "finished" && now.getTime() - endsAt(s).getTime() > ASK_FOR_MS) continue;
    if (!best || s.startedAt > best.startedAt) best = s;
  }
  return best;
}

/** Whole minutes focused: up to now, or to when it was stopped, never past its planned end. */
export function focusedMinutes(s: FocusSession, now: Date): number {
  const until = Math.min(s.endedAt ? Date.parse(s.endedAt) : now.getTime(), endsAt(s).getTime());
  return Math.max(0, Math.floor((until - Date.parse(s.startedAt)) / 60_000));
}

/** Minutes focused in sessions that started on one Logical Day. */
export function focusedOn(sessions: FocusSession[], date: LogicalDate, timeZone: string, dayEndHour: number, now: Date): number {
  return sessions
    .filter((s) => logicalDate(new Date(s.startedAt), timeZone, dayEndHour) === date)
    .reduce((sum, s) => sum + focusedMinutes(s, now), 0);
}

const endAt = (s: FocusSession, now: Date): string => new Date(Math.min(now.getTime(), endsAt(s).getTime())).toISOString();

/** End a session: now if it is still running, at its planned end if its time was already up. */
export function endFocus(sessions: FocusSession[], id: string, now: Date): FocusSession[] {
  const s = sessions.find((x) => x.id === id);
  if (!s || s.endedAt) return sessions;
  return sessions.map((x) => (x.id === id ? { ...x, endedAt: endAt(x, now) } : x));
}

/** Start a session; whichever one was running or waiting ends first. */
export function startFocus(sessions: FocusSession[], input: { id: string; taskId: string; minutes: number }, now: Date): FocusSession[] {
  const ended = sessions.map((x) => (x.endedAt ? x : { ...x, endedAt: endAt(x, now) }));
  return [...ended, { id: input.id, taskId: input.taskId, startedAt: now.toISOString(), plannedMinutes: input.minutes, endedAt: null }];
}
