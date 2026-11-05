import { and, eq, gte, sql } from "drizzle-orm";
import type { DailyLog, LogicalDate } from "@/domain/types";
import * as schema from "./db/schema";
import { iso } from "./rows";
import type { Db } from "./users";

/** Daily Logs of one user: one row per Logical Day, made on first write. */

const { dailyLogs: logs, tasks } = schema;

export type LogPatch = Partial<Omit<DailyLog, "date" | "top3TaskIds">>;

export function toLog(r: typeof logs.$inferSelect): DailyLog {
  return {
    date: r.date,
    intention: r.intention ?? null,
    energy: r.energy,
    engagement: r.engagement,
    meaningSources: r.meaningSources as DailyLog["meaningSources"],
    note: r.note,
    top3TaskIds: r.top3TaskIds,
    morningAt: iso(r.morningAt),
    closedAt: iso(r.closedAt),
  };
}

export async function listLogs(db: Db, userId: string, since: LogicalDate): Promise<DailyLog[]> {
  const rows = await db
    .select()
    .from(logs)
    .where(and(eq(logs.userId, userId), gte(logs.date, since)))
    .orderBy(logs.date);
  return rows.map(toLog);
}

/** Change some fields of one day's log, creating it if needed. */
export function patchLog(db: Db, userId: string, date: LogicalDate, patch: LogPatch) {
  const set: Partial<typeof logs.$inferInsert> = {};
  for (const k of ["intention", "energy", "engagement", "meaningSources", "note", "morningAt", "closedAt"] as const)
    if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = patch[k];
  return db
    .insert(logs)
    .values({ userId, date, ...set })
    .onConflictDoUpdate({ target: [logs.userId, logs.date], set: Object.keys(set).length ? set : { date } });
}

/**
 * Write the day's Top 3, as it stands now, into its log: whenever the Top 3 changes, the log
 * keeps up, so it holds the final Top 3 once the day is over. One statement, so it can join a batch.
 */
export function snapshotTop3(db: Db, userId: string, date: LogicalDate) {
  return db.execute(sql`
    insert into ${logs} (user_id, date, top3_task_ids)
    values (${userId}, ${date}, coalesce((
      select array_agg(${tasks.id}::text order by ${tasks.createdAt})
      from ${tasks}
      where ${tasks.userId} = ${userId} and ${tasks.top3Date} = ${date} and ${tasks.closedAt} is null
    ), '{}'))
    on conflict (user_id, date) do update set top3_task_ids = excluded.top3_task_ids`);
}
