import type { Compass, DailyLog, Decision, LogicalDate, Objective, OdysseyPlan, Task, UserSettings } from "@/domain/types";

/** The "why" chosen in capture. */
export type KindChoice =
  | { kind: "objective"; objectiveId: string }
  | { kind: "maintenance" }
  | { kind: "prototype"; planId: string };

export interface AppState {
  version: 1;
  userId: string;
  onboarded: boolean;
  settings: UserSettings & { sound: boolean };
  compass: Compass | null;
  /** Always three slots. */
  plans: OdysseyPlan[];
  objectives: Objective[];
  tasks: Task[];
  logs: Record<LogicalDate, DailyLog>;
  decisions: Decision[];
  lastKind: KindChoice | null;
}

export type RitualMode = "morning" | "day" | "evening" | "night";
