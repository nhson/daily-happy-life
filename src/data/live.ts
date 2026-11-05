import type { Objective, OdysseyPlan, Task, UserSettings } from "@/domain/types";
import { ensurePlans, listObjectives, listPlans } from "./plans";
import { listTasks } from "./tasks";
import { settingsOf, type Db, type User } from "./users";

/** What the signed-in app reads from the database; the rest is still sample data until its slice. */
export interface LiveData {
  userId: string;
  settings: UserSettings;
  plans: OdysseyPlan[];
  objectives: Objective[];
  tasks: Task[];
}

/** Done tasks of the last week and a bit: the Done tab and Life Share look back 7 Logical Days. */
const DONE_LOOKBACK_MS = 9 * 24 * 3600 * 1000;

export async function loadLive(db: Db, user: User): Promise<LiveData> {
  await ensurePlans(db, user.id);
  const [plans, objectives, tasks] = await Promise.all([
    listPlans(db, user.id),
    listObjectives(db, user.id),
    listTasks(db, user.id, new Date(Date.now() - DONE_LOOKBACK_MS).toISOString()),
  ]);
  return { userId: user.id, settings: settingsOf(user), plans, objectives, tasks };
}
