import { and, desc, eq, gte, lte } from "drizzle-orm";
import { addDays, logicalDate } from "@/domain/logical-day";
import { parseReview, reviewPrompt, weekStats, type WeeklyReview } from "@/domain/weekly-review";
import * as schema from "./db/schema";
import { listLogs } from "./days";
import { listFocus } from "./focus";
import { listObjectives, listPlans } from "./plans";
import { iso, toTask } from "./rows";
import { settingsOf, type Db } from "./users";

/**
 * Weekly Reviews of one user (rules in `src/domain/weekly-review.ts`). The numbers are computed
 * here from the database; the AI (`Reviewer`, OpenRouter in production) is asked once per week,
 * and again only if it failed, at most 5 times. Without an AI the review is numbers only.
 */

export interface Reviewer {
  review(prompt: { system: string; user: string }): Promise<{ text: string; model: string }>;
}

const { weeklyReviews: reviews, tasks } = schema;
const MAX_ATTEMPTS = 5;
const mine = (userId: string, weekEnd: string) => and(eq(reviews.userId, userId), eq(reviews.weekEnd, weekEnd));

export type ReviewResult = { ok: true; review: WeeklyReview } | { ok: false; error: "bad_week" | "not_found" };

function toReview(r: typeof reviews.$inferSelect): WeeklyReview {
  return { weekEnd: r.weekEnd, stats: r.stats, notes: r.notes ?? null, model: r.model, takeaway: r.takeaway, createdAt: iso(r.createdAt) };
}

/** The latest reviews, newest first. */
export async function listReviews(db: Db, userId: string, limit = 12): Promise<WeeklyReview[]> {
  const rows = await db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.weekEnd)).limit(limit);
  return rows.map(toReview);
}

/** Open the review of the week ending `weekEnd` (a Sunday already begun, at most two weeks back). */
export async function startReview(db: Db, userId: string, weekEnd: string, now: Date, reviewer: Reviewer | null): Promise<ReviewResult> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return { ok: false, error: "not_found" };
  const { timeZone, dayEndHour, locale } = settingsOf(user);
  const today = logicalDate(now, timeZone, dayEndHour);
  const sunday = /^\d{4}-\d{2}-\d{2}$/.test(weekEnd) && new Date(`${weekEnd}T00:00:00Z`).getUTCDay() === 0;
  if (!sunday || weekEnd > today || weekEnd < addDays(today, -15)) return { ok: false, error: "bad_week" };

  const [found] = await db.select().from(reviews).where(mine(userId, weekEnd));
  if (found?.notes || (found && (found.attempts >= MAX_ATTEMPTS || !reviewer))) return { ok: true, review: toReview(found) };

  // The week's rows, with a day of slack on each side for Logical Days and time zones.
  const from = addDays(weekEnd, -7);
  const [done, logs, focus, objectives, plans] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), gte(tasks.doneAt, `${from}T00:00:00Z`), lte(tasks.doneAt, `${addDays(weekEnd, 2)}T00:00:00Z`))),
    listLogs(db, userId, from),
    listFocus(db, userId, `${from}T00:00:00Z`),
    listObjectives(db, userId),
    listPlans(db, userId),
  ]);
  const stats = weekStats({ tasks: done.map(toTask), logs, focus, objectives, plans }, weekEnd, timeZone, dayEndHour, now);

  let notes = null;
  let model: string | null = null;
  if (reviewer) {
    try {
      const answer = await reviewer.review(reviewPrompt(stats, locale));
      notes = parseReview(answer.text);
      model = notes ? answer.model : null;
    } catch {
      // The numbers are saved anyway; the next open asks again.
    }
  }
  const attempts = (found?.attempts ?? 0) + (reviewer ? 1 : 0);
  await db
    .insert(reviews)
    .values({ userId, weekEnd, stats, notes, model, attempts })
    .onConflictDoUpdate({ target: [reviews.userId, reviews.weekEnd], set: { stats, notes, model, attempts } });
  const [row] = await db.select().from(reviews).where(mine(userId, weekEnd));
  return { ok: true, review: toReview(row) };
}

/** The user's one line about the week. */
export async function saveTakeaway(db: Db, userId: string, weekEnd: string, text: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const rows = await db
    .update(reviews)
    .set({ takeaway: text.trim().slice(0, 280) })
    .where(mine(userId, weekEnd))
    .returning({ w: reviews.weekEnd });
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}
