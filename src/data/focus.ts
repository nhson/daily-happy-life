import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { en } from "@/copy/en";
import { vi } from "@/copy/vi";
import { endsAt, isFocusMinutes, type FocusSession } from "@/domain/focus";
import * as schema from "./db/schema";
import type { Pusher } from "./reminders";
import { atomic, iso } from "./rows";
import { settingsOf, type Db } from "./users";

/**
 * Focus Sessions of one user (rules in `src/domain/focus.ts`). When the user gets pushes, starting a
 * session queues one push for its end (`Later`, QStash in production); stopping early cancels it,
 * and `/api/remind` checks again before sending, so a stopped session never rings.
 */

/** Send one message after a delay, or cancel it. */
export interface Later {
  at(delaySeconds: number, body: string): Promise<string>;
  cancel(id: string): Promise<void>;
}

const { focusSessions: focus, tasks } = schema;
const mine = (userId: string, id: string) => and(eq(focus.userId, userId), eq(focus.id, id));
/** Now, or the planned end if that came first. */
const endAt = (now: Date) => sql`least(${now.toISOString()}::timestamptz, ${focus.startedAt} + ${focus.plannedMinutes} * interval '1 minute')`;

export type FocusResult = { ok: true } | { ok: false; error: "bad_minutes" | "not_found" };

function toFocus(r: typeof focus.$inferSelect): FocusSession {
  return { id: r.id, taskId: r.taskId, startedAt: iso(r.startedAt), plannedMinutes: r.plannedMinutes, endedAt: iso(r.endedAt) };
}

/** Sessions started since `since`: today's total and the one running. */
export async function listFocus(db: Db, userId: string, since: string): Promise<FocusSession[]> {
  const rows = await db.select().from(focus).where(and(eq(focus.userId, userId), gt(focus.startedAt, since)));
  return rows.map(toFocus);
}

async function cancelAll(later: Later | null, ids: (string | null)[]) {
  if (!later) return;
  // A push that can't be cancelled still finds its session ended and stays quiet.
  await Promise.all(ids.filter((id): id is string => !!id).map((id) => later.cancel(id).catch(() => {})));
}

/** Start one on an open task of this user; whichever was running ends first. */
export async function startFocus(
  db: Db,
  userId: string,
  input: { id: string; taskId: string; minutes: number },
  now: Date,
  later: Later | null,
): Promise<FocusResult> {
  if (!isFocusMinutes(input.minutes)) return { ok: false, error: "bad_minutes" };
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, input.taskId), isNull(tasks.doneAt), isNull(tasks.closedAt)));
  if (!task) return { ok: false, error: "not_found" };
  const [again] = await db.select({ id: focus.id }).from(focus).where(mine(userId, input.id));
  if (again) return { ok: true };

  const open = await db.select({ push: focus.pushMessageId }).from(focus).where(and(eq(focus.userId, userId), isNull(focus.endedAt)));
  await atomic(db, (d) => [
    d.update(focus).set({ endedAt: endAt(now), pushMessageId: null }).where(and(eq(focus.userId, userId), isNull(focus.endedAt))),
    d.insert(focus).values({ id: input.id, userId, taskId: input.taskId, startedAt: now.toISOString(), plannedMinutes: input.minutes }),
  ]);
  await cancelAll(later, open.map((o) => o.push));

  const [user] = await db.select({ push: schema.users.pushSubscription }).from(schema.users).where(eq(schema.users.id, userId));
  if (later && user?.push) {
    const messageId = await later.at(input.minutes * 60, JSON.stringify({ userId, focusId: input.id }));
    await db.update(focus).set({ pushMessageId: messageId }).where(mine(userId, input.id));
  }
  return { ok: true };
}

/** Stop it (now) or answer it (its time was up: it ends at the planned end). */
export async function endFocus(db: Db, userId: string, id: string, now: Date, later: Later | null): Promise<FocusResult> {
  const [s] = await db.select().from(focus).where(mine(userId, id));
  if (!s) return { ok: false, error: "not_found" };
  if (s.endedAt) return { ok: true };
  await db.update(focus).set({ endedAt: endAt(now), pushMessageId: null }).where(and(mine(userId, id), isNull(focus.endedAt)));
  await cancelAll(later, [s.pushMessageId]);
  return { ok: true };
}

/**
 * Called by the queued push. Sends only if the session is still waiting for its answer and its
 * time is up (a minute of slack for the queue), naming the task in the user's language.
 */
export async function sendFocusEnd(db: Db, userId: string, focusId: string, pusher: Pusher, now: Date): Promise<"sent" | "gone" | "off" | "stale"> {
  const [row] = await db
    .select({ s: focus, title: tasks.title, user: schema.users })
    .from(focus)
    .innerJoin(tasks, eq(tasks.id, focus.taskId))
    .innerJoin(schema.users, eq(schema.users.id, focus.userId))
    .where(mine(userId, focusId));
  if (!row || row.s.endedAt) return "stale";
  if (now.getTime() < endsAt(toFocus(row.s)).getTime() - 60_000) return "stale";
  const sub = row.user.pushSubscription as Parameters<Pusher["send"]>[0] | null;
  if (!sub?.endpoint) return "off";
  const copy = settingsOf(row.user).locale === "en" ? en : vi;
  return pusher.send(sub, JSON.stringify({ title: copy.focus.pushTitle, body: row.title, url: "/today", tag: "focus-end" }));
}
