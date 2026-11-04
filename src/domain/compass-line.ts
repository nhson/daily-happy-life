import { dayIndex } from "./logical-day";
import { MINDSET_KEYS, type MindsetKey } from "./mindsets";
import type { Compass, LogicalDate } from "./types";

export type CompassLineSource = "workview" | "lifeview" | "plan" | "mindset";

/** The user's own words, or a Mindset key the screen renders in the user's language. */
export type CompassLine =
  | { source: Exclude<CompassLineSource, "mindset">; text: string }
  | { source: "mindset"; mindset: MindsetKey };

interface Input {
  userId: string;
  date: LogicalDate;
  compass: Compass | null;
  activePlanTitle: string | null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Today's Compass Line. Rotates Workview → Lifeview → Active Plan → Mindset,
 * skipping sources that are empty, offset per user, deterministic per date.
 */
export function compassLineFor({ userId, date, compass, activePlanTitle }: Input): CompassLine {
  const sources: CompassLineSource[] = [];
  if (compass?.workview.trim()) sources.push("workview");
  if (compass?.lifeview.trim()) sources.push("lifeview");
  if (activePlanTitle?.trim()) sources.push("plan");
  sources.push("mindset");

  const step = dayIndex(date) + (hash(userId) % 1000);
  const source = sources[step % sources.length];

  switch (source) {
    case "workview":
      return { source, text: compass!.workview.trim() };
    case "lifeview":
      return { source, text: compass!.lifeview.trim() };
    case "plan":
      return { source, text: activePlanTitle!.trim() };
    case "mindset": {
      return { source, mindset: MINDSET_KEYS[Math.floor(step / sources.length) % MINDSET_KEYS.length] };
    }
  }
}
