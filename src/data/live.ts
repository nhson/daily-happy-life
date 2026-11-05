import { carryOverSince } from "@/domain/carry-over";
import { freshOnboarding, type OnboardingState } from "@/domain/onboarding";
import { logicalDate } from "@/domain/logical-day";
import type { FocusSession } from "@/domain/focus";
import type { CompassVersion, QuarterlyReview } from "@/domain/quarterly-review";
import type { WeeklyReview } from "@/domain/weekly-review";
import type { Compass, DailyLog, Decision, Objective, OdysseyPlan, Task, UserSettings } from "@/domain/types";
import { listLogs } from "./days";
import { listFocus } from "./focus";
import { listReviews } from "./weekly-review";
import { listCompassVersions, listQuarterReviews } from "./quarterly-review";
import { getCompass, listDecisions } from "./life";
import { ensurePlans, listObjectives, listPlans } from "./plans";
import { listTasks } from "./tasks";
import { settingsOf, type Db, type User } from "./users";

/** Everything the signed-in app reads from the database. */
export interface LiveData {
  userId: string;
  onboarded: boolean;
  onboarding: OnboardingState;
  settings: UserSettings;
  compass: Compass | null;
  plans: OdysseyPlan[];
  objectives: Objective[];
  tasks: Task[];
  logs: DailyLog[];
  decisions: Decision[];
  focus: FocusSession[];
  reviews: WeeklyReview[];
  quarterReviews: QuarterlyReview[];
  pastCompasses: CompassVersion[];
}

/** Done tasks of the last week and a bit: the Done tab and Life Share look back 7 Logical Days. */
const DONE_LOOKBACK_MS = 9 * 24 * 3600 * 1000;
/** Focus Sessions of the last day and a half: today's total and the one running or waiting. */
const FOCUS_LOOKBACK_MS = 36 * 3600 * 1000;

export async function loadLive(db: Db, user: User): Promise<LiveData> {
  const today = logicalDate(new Date(), user.timezone, user.dayEndHour);
  const [found, objectives, tasks, logs, compass, decisions, focus, reviews, quarterReviews, pastCompasses] = await Promise.all([
    listPlans(db, user.id),
    listObjectives(db, user.id),
    listTasks(db, user.id, new Date(Date.now() - DONE_LOOKBACK_MS).toISOString()),
    // Week dots and Life Share need 7 days; carry-over looks back 7 before today.
    listLogs(db, user.id, carryOverSince(today)),
    getCompass(db, user.id),
    listDecisions(db, user.id),
    listFocus(db, user.id, new Date(Date.now() - FOCUS_LOOKBACK_MS).toISOString()),
    listReviews(db, user.id),
    listQuarterReviews(db, user.id),
    listCompassVersions(db, user.id),
  ]);
  // Plan slots are made once, on the first load; after that this costs no write.
  let plans = found;
  if (plans.length < 3) {
    await ensurePlans(db, user.id);
    plans = await listPlans(db, user.id);
  }
  return {
    userId: user.id,
    onboarded: user.onboardedAt !== null,
    onboarding: user.onboarding ?? freshOnboarding(null),
    settings: settingsOf(user),
    compass,
    plans,
    objectives,
    tasks,
    logs,
    decisions,
    focus,
    reviews,
    quarterReviews,
    pastCompasses,
  };
}
