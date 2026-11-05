import { asc, eq } from "drizzle-orm";
import type { OnboardingState } from "@/domain/onboarding";
import type { UserSettings } from "@/domain/types";
import * as schema from "./db/schema";
import { atomic } from "./rows";
import { settingsOf, type Db } from "./users";

/**
 * Export all (SPEC: Settings → Export all, JSON). Every table the user owns, field names as in the
 * schema — they never change with the language. No ids that point at the account itself (user id,
 * Clerk id) and no push subscription. `importAll` writes it back, which is what proves it complete.
 */

const { users, compass, odysseyPlans, objectives, tasks, dailyLogs, decisions, focusSessions, weeklyReviews, quarterlyReviews, compassVersions } = schema;

type Owned<T> = Omit<T, "userId">;
export interface Export {
  format: "daily-happy-life";
  version: 1;
  exportedAt: string;
  settings: UserSettings;
  onboardedAt: string | null;
  onboarding: OnboardingState | null;
  compass: Owned<typeof compass.$inferSelect> | null;
  odysseyPlans: Owned<typeof odysseyPlans.$inferSelect>[];
  objectives: Owned<typeof objectives.$inferSelect>[];
  tasks: Owned<typeof tasks.$inferSelect>[];
  dailyLogs: Owned<typeof dailyLogs.$inferSelect>[];
  decisions: Owned<typeof decisions.$inferSelect>[];
  /** Without the queued-push id, which means nothing outside this account. Older exports have none. */
  focusSessions?: Omit<Owned<typeof focusSessions.$inferSelect>, "pushMessageId">[];
  /** Older exports have none. */
  weeklyReviews?: Owned<typeof weeklyReviews.$inferSelect>[];
  /** Older exports have none. */
  quarterlyReviews?: Owned<typeof quarterlyReviews.$inferSelect>[];
  /** Older exports have none. */
  compassVersions?: Owned<typeof compassVersions.$inferSelect>[];
}

const owned = <T extends { userId: string }>(rows: T[]): Owned<T>[] =>
  rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "userId")) as Owned<T>);

export async function exportAll(db: Db, userId: string): Promise<Export> {
  const [[user], [c], ps, os, ts, ls, ds, fs, ws, qs, cvs] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(compass).where(eq(compass.userId, userId)),
    db.select().from(odysseyPlans).where(eq(odysseyPlans.userId, userId)).orderBy(asc(odysseyPlans.slot)),
    db.select().from(objectives).where(eq(objectives.userId, userId)).orderBy(asc(objectives.createdAt), asc(objectives.id)),
    db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.createdAt), asc(tasks.id)),
    db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId)).orderBy(asc(dailyLogs.date)),
    db.select().from(decisions).where(eq(decisions.userId, userId)).orderBy(asc(decisions.createdAt), asc(decisions.id)),
    db.select().from(focusSessions).where(eq(focusSessions.userId, userId)).orderBy(asc(focusSessions.startedAt), asc(focusSessions.id)),
    db.select().from(weeklyReviews).where(eq(weeklyReviews.userId, userId)).orderBy(asc(weeklyReviews.weekEnd)),
    db.select().from(quarterlyReviews).where(eq(quarterlyReviews.userId, userId)).orderBy(asc(quarterlyReviews.quarter)),
    db.select().from(compassVersions).where(eq(compassVersions.userId, userId)).orderBy(asc(compassVersions.replacedAt), asc(compassVersions.id)),
  ]);
  if (!user) throw new Error("No such user");
  return {
    format: "daily-happy-life",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settingsOf(user),
    onboardedAt: user.onboardedAt,
    onboarding: user.onboarding,
    compass: c ? owned([c])[0] : null,
    odysseyPlans: owned(ps),
    objectives: owned(os),
    tasks: owned(ts),
    dailyLogs: owned(ls),
    decisions: owned(ds),
    focusSessions: owned(fs).map((f) => ({ id: f.id, taskId: f.taskId, startedAt: f.startedAt, plannedMinutes: f.plannedMinutes, endedAt: f.endedAt })),
    weeklyReviews: owned(ws),
    quarterlyReviews: owned(qs),
    compassVersions: owned(cvs),
  };
}

/**
 * Restore an export into `userId`'s account, replacing what is there, in one transaction. Not in
 * the app's UI (SPEC: no imports); it exists for recovery and to prove the export is whole.
 */
export async function importAll(db: Db, userId: string, x: Export): Promise<void> {
  if (x?.format !== "daily-happy-life" || x.version !== 1) throw new Error("Not a daily-happy-life export (version 1)");
  const mine = <T>(rows: T[]) => rows.map((r) => ({ ...r, userId }));
  await atomic(db, (d) => {
    const qs: PromiseLike<unknown>[] = [
      // Children first; every table hangs off the user.
      d.delete(focusSessions).where(eq(focusSessions.userId, userId)),
      d.delete(weeklyReviews).where(eq(weeklyReviews.userId, userId)),
      d.delete(quarterlyReviews).where(eq(quarterlyReviews.userId, userId)),
      d.delete(compassVersions).where(eq(compassVersions.userId, userId)),
      d.delete(decisions).where(eq(decisions.userId, userId)),
      d.delete(dailyLogs).where(eq(dailyLogs.userId, userId)),
      d.delete(tasks).where(eq(tasks.userId, userId)),
      d.delete(objectives).where(eq(objectives.userId, userId)),
      d.delete(odysseyPlans).where(eq(odysseyPlans.userId, userId)),
      d.delete(compass).where(eq(compass.userId, userId)),
    ];
    if (x.odysseyPlans.length) qs.push(d.insert(odysseyPlans).values(mine(x.odysseyPlans)));
    if (x.objectives.length) qs.push(d.insert(objectives).values(mine(x.objectives)));
    if (x.tasks.length) qs.push(d.insert(tasks).values(mine(x.tasks)));
    if (x.dailyLogs.length) qs.push(d.insert(dailyLogs).values(mine(x.dailyLogs)));
    if (x.decisions.length) qs.push(d.insert(decisions).values(mine(x.decisions)));
    if (x.focusSessions?.length) qs.push(d.insert(focusSessions).values(mine(x.focusSessions)));
    if (x.weeklyReviews?.length) qs.push(d.insert(weeklyReviews).values(mine(x.weeklyReviews)));
    if (x.quarterlyReviews?.length) qs.push(d.insert(quarterlyReviews).values(mine(x.quarterlyReviews)));
    if (x.compassVersions?.length) qs.push(d.insert(compassVersions).values(mine(x.compassVersions)));
    if (x.compass) qs.push(d.insert(compass).values({ ...x.compass, userId }));
    const s = x.settings;
    qs.push(
      d
        .update(users)
        .set({
          timezone: s.timeZone,
          reminderTime: s.reminderTime,
          eveningHour: s.eveningHour,
          dayEndHour: s.dayEndHour,
          theme: s.theme,
          locale: s.locale,
          onboardedAt: x.onboardedAt,
          onboarding: x.onboarding,
        })
        .where(eq(users.id, userId)),
    );
    return qs;
  });
}
