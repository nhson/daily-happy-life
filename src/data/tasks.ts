import { and, desc, eq, gt, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import { validateTaskLink, type TaskLinkError } from "@/domain/task-rules";
import type { Task } from "@/domain/types";
import * as schema from "./db/schema";
import { snapshotTop3 } from "./days";
import { atomic, toObjective, toPlan, toTask } from "./rows";
import type { KindChoice } from "./state";
import type { Db } from "./users";

/**
 * Tasks of one user. Every function takes `userId` and touches only that user's rows; the
 * kind/link shape is checked here (domain rules) and again by the database itself.
 */

const { tasks } = schema;
const mine = (userId: string, id: string) => and(eq(tasks.userId, userId), eq(tasks.id, id));

export type TaskError = TaskLinkError | "not_found" | "empty_title" | "top3_full";
export type Result = { ok: true } | { ok: false; error: TaskError };

export function linkOf(choice: KindChoice) {
  return {
    kind: choice.kind,
    objectiveId: choice.kind === "objective" ? choice.objectiveId : null,
    prototypePlanId: choice.kind === "prototype" ? choice.planId : null,
  };
}

async function checkLink(db: Db, userId: string, choice: KindChoice): Promise<Result> {
  const [plans, objectives] = await Promise.all([
    db.select().from(schema.odysseyPlans).where(eq(schema.odysseyPlans.userId, userId)),
    db.select().from(schema.objectives).where(eq(schema.objectives.userId, userId)),
  ]);
  return validateTaskLink(linkOf(choice), { plans: plans.map(toPlan), objectives: objectives.map(toObjective) });
}

/** Open tasks, plus those finished since `doneSince` (the Done tab and Life Share need a week). */
export async function listTasks(db: Db, userId: string, doneSince: string): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), or(and(isNull(tasks.doneAt), isNull(tasks.closedAt)), gt(tasks.doneAt, doneSince))))
    .orderBy(desc(tasks.createdAt));
  return rows.map(toTask);
}

export async function createTask(db: Db, userId: string, input: { id: string; title: string; choice: KindChoice }): Promise<Result> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "empty_title" };
  const link = await checkLink(db, userId, input.choice);
  if (!link.ok) return link;
  // A retried request (same client id) is a no-op, not a duplicate.
  await db.insert(tasks).values({ id: input.id, userId, title, ...linkOf(input.choice) }).onConflictDoNothing();
  return { ok: true };
}

export async function editTask(
  db: Db,
  userId: string,
  id: string,
  patch: { title?: string; choice?: KindChoice; dueDate?: string | null },
): Promise<Result> {
  const set: Partial<typeof tasks.$inferInsert> = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) return { ok: false, error: "empty_title" };
    set.title = patch.title.trim();
  }
  if (patch.choice) {
    const link = await checkLink(db, userId, patch.choice);
    if (!link.ok) return link;
    Object.assign(set, linkOf(patch.choice));
  }
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
  if (!Object.keys(set).length) return { ok: true };
  return found(await db.update(tasks).set(set).where(mine(userId, id)).returning({ id: tasks.id }));
}

export async function setDone(db: Db, userId: string, id: string, doneAt: string | null): Promise<Result> {
  return found(await db.update(tasks).set({ doneAt }).where(mine(userId, id)).returning({ id: tasks.id }));
}

/** Put a task in (date) or out (null) of the Top 3 of a Logical Day; three at most. */
export async function setTop3(db: Db, userId: string, id: string, date: string | null): Promise<Result> {
  if (date) {
    const taken = await db.$count(tasks, and(eq(tasks.userId, userId), eq(tasks.top3Date, date), isNull(tasks.closedAt), ne(tasks.id, id)));
    if (taken >= 3) return { ok: false, error: "top3_full" };
  }
  const [t] = await db.select({ top3Date: tasks.top3Date }).from(tasks).where(mine(userId, id));
  if (!t) return { ok: false, error: "not_found" };
  // Both the day it leaves and the day it joins keep their logged Top 3 current.
  const days = [...new Set([t.top3Date, date].filter((d): d is string => !!d))];
  await atomic(db, (d) => [
    d.update(tasks).set({ top3Date: date }).where(mine(userId, id)),
    ...days.map((day) => snapshotTop3(d, userId, day)),
  ]);
  return { ok: true };
}

/** The morning's picks become the day's whole Top 3, in one go. */
export async function replaceTop3(db: Db, userId: string, date: string, ids: string[]): Promise<Result> {
  if (ids.length > 3) return { ok: false, error: "top3_full" };
  const owned = ids.length ? await db.$count(tasks, and(eq(tasks.userId, userId), inArray(tasks.id, ids))) : 0;
  if (owned !== ids.length) return { ok: false, error: "not_found" };
  await atomic(db, (d) => {
    const qs: PromiseLike<unknown>[] = [
      d
        .update(tasks)
        .set({ top3Date: null })
        .where(and(eq(tasks.userId, userId), eq(tasks.top3Date, date), ids.length ? notInArray(tasks.id, ids) : undefined)),
    ];
    if (ids.length) qs.push(d.update(tasks).set({ top3Date: date }).where(and(eq(tasks.userId, userId), inArray(tasks.id, ids))));
    qs.push(snapshotTop3(d, userId, date));
    return qs;
  });
  return { ok: true };
}

/** Let a task go: it ends without being done and stays as history. */
export async function closeTask(db: Db, userId: string, id: string, closedAt: string): Promise<Result> {
  return found(
    await db
      .update(tasks)
      .set({ closedAt })
      .where(and(mine(userId, id), isNull(tasks.doneAt), isNull(tasks.closedAt)))
      .returning({ id: tasks.id }),
  );
}

/** Only for mistakes (a typo, a duplicate): leaves no trace. */
export async function deleteTask(db: Db, userId: string, id: string): Promise<Result> {
  return found(await db.delete(tasks).where(mine(userId, id)).returning({ id: tasks.id }));
}

const found = (rows: unknown[]): Result => (rows.length ? { ok: true } : { ok: false, error: "not_found" });
