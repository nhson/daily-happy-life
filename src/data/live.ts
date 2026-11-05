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
  const [found, objectives, tasks] = await Promise.all([
    listPlans(db, user.id),
    listObjectives(db, user.id),
    listTasks(db, user.id, new Date(Date.now() - DONE_LOOKBACK_MS).toISOString()),
  ]);
  // Plan slots are made once, on the first load; after that this costs no write.
  let plans = found;
  if (plans.length < 3) {
    await ensurePlans(db, user.id);
    plans = await listPlans(db, user.id);
  }
  return { userId: user.id, settings: settingsOf(user), plans, objectives, tasks };
}
