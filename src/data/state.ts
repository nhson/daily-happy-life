import type { FocusSession } from "@/domain/focus";
import type { OnboardingState } from "@/domain/onboarding";
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
  /** Tips seen, nudges snoozed, reminder asked — UI progress only (users.onboarding in prod). */
  onboarding: OnboardingState;
  settings: UserSettings & { sound: boolean };
  compass: Compass | null;
  /** Always three slots. */
  plans: OdysseyPlan[];
  objectives: Objective[];
  tasks: Task[];
  logs: Record<LogicalDate, DailyLog>;
  decisions: Decision[];
  /** Recent Focus Sessions: the one running or waiting, and today's. */
  focus: FocusSession[];
  lastKind: KindChoice | null;
}

export type { RitualMode } from "@/domain/ritual-mode";
