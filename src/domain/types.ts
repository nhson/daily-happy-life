/** Domain types — vocabulary follows GLOSSARY.md. Pure data, no I/O. */

export type TaskKind = "objective" | "maintenance" | "prototype";
export const TASK_KINDS: readonly TaskKind[] = ["objective", "maintenance", "prototype"];

export type MeaningSource = "wonder" | "coherence" | "flow" | "community";
export const MEANING_SOURCES: readonly MeaningSource[] = ["wonder", "coherence", "flow", "community"];

/** ISO calendar date of a Logical Day, e.g. "2026-11-03". */
export type LogicalDate = string;

export interface Compass {
  workview: string;
  lifeview: string;
}

export type GaugeKey = "resources" | "likability" | "confidence" | "coherence";
export const GAUGE_KEYS: readonly GaugeKey[] = ["resources", "likability", "confidence", "coherence"];
export type Gauges = Record<GaugeKey, number | null>;

export interface OdysseyPlan {
  id: string;
  slot: 1 | 2 | 3;
  /** Six-word title; empty while the plan is unwritten. */
  title: string;
  questions: string;
  gauges: Gauges;
  isActive: boolean;
}

/** "carried": moved into the next quarter at Quarter Close; the copy there is active. */
export type ObjectiveStatus = "active" | "done" | "dropped" | "carried";

export interface Objective {
  id: string;
  planId: string;
  title: string;
  /** "YYYY-Qn" */
  quarter: string;
  status: ObjectiveStatus;
}

export interface Task {
  id: string;
  kind: TaskKind;
  objectiveId: string | null;
  prototypePlanId: string | null;
  title: string;
  dueDate: LogicalDate | null;
  /** In Top 3 ⇔ top3Date equals today's Logical Date. */
  top3Date: LogicalDate | null;
  doneAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface DailyLog {
  date: LogicalDate;
  intention: { when: string; then: string } | null;
  energy: number | null;
  engagement: number | null;
  meaningSources: MeaningSource[];
  note: string;
  /** That day's Top 3 as it last stood — history for carry-over (tasks.top3Date only knows today). */
  top3TaskIds: string[];
  /** When the Morning Ritual was finished or skipped — it runs once per Logical Day. */
  morningAt: string | null;
  /** When the Evening Check-in was committed ("Close the day"). Counts toward the week dots. */
  closedAt: string | null;
}

export interface Decision {
  id: string;
  date: LogicalDate;
  decision: string;
  drivenBy: string;
  linkedPlanId: string | null;
}

export interface UserSettings {
  timeZone: string;
  reminderTime: string; // "HH:MM"
  eveningHour: number;
  dayEndHour: number;
  theme: "sky" | "light" | "dark";
  /** UI language; Vietnamese by default. */
  locale: "vi" | "en";
}
