import { and, desc, eq, isNull } from "drizzle-orm";
import { ratedPlans, type Dashboard, type QuarterlyReview } from "@/domain/quarterly-review";
import type { Gauges } from "@/domain/types";
import * as schema from "./db/schema";
import { listPlans } from "./plans";
import { iso } from "./rows";
import type { Db } from "./users";

/**
 * Quarterly Reviews of one user (rules in `src/domain/quarterly-review.ts`), saved step by step:
 * the dashboard starts the row, the plans step snapshots the Gauges and the Active Plan, and the
 * end marks it complete. The caller (a Server Action) decides which quarter is being reviewed.
 */

const { quarterlyReviews: reviews } = schema;
const mine = (userId: string, quarter: string) => and(eq(reviews.userId, userId), eq(reviews.quarter, quarter));
type Result = { ok: true } | { ok: false; error: "not_started" };

function toReview(r: typeof reviews.$inferSelect): QuarterlyReview {
  return {
    quarter: r.quarter,
    dashboard: { health: r.health, work: r.work, play: r.play, love: r.love },
    plans: r.plans ?? null,
    activePlanId: r.activePlanId,
    plansReviewedAt: iso(r.plansReviewedAt),
    completedAt: iso(r.completedAt),
    createdAt: iso(r.createdAt),
  };
}

/** The latest reviews, newest quarter first. */
export async function listQuarterReviews(db: Db, userId: string, limit = 8): Promise<QuarterlyReview[]> {
  const rows = await db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.quarter)).limit(limit);
  return rows.map(toReview);
}

/** The Life Dashboard: starts the review, or changes its ratings. */
export async function saveDashboard(db: Db, userId: string, quarter: string, d: Dashboard): Promise<Result> {
  await db
    .insert(reviews)
    .values({ userId, quarter, ...d })
    .onConflictDoUpdate({ target: [reviews.userId, reviews.quarter], set: { ...d } });
  return { ok: true };
}

/**
 * The plans step is passed: the re-rated Gauges are saved first, then the written plans' Gauges as
 * they now stand and the Active Plan are kept with the review.
 */
export async function finishQuarterPlans(
  db: Db,
  userId: string,
  quarter: string,
  now: string,
  rerated: { planId: string; gauges: Gauges }[] = [],
): Promise<Result> {
  const [found] = await db.select({ q: reviews.quarter }).from(reviews).where(mine(userId, quarter));
  if (!found) return { ok: false, error: "not_started" };
  for (const r of rerated)
    await db
      .update(schema.odysseyPlans)
      .set({ ...r.gauges, updatedAt: now })
      .where(and(eq(schema.odysseyPlans.userId, userId), eq(schema.odysseyPlans.id, r.planId)));
  const plans = await listPlans(db, userId);
  const rows = await db
    .update(reviews)
    .set({ plans: ratedPlans(plans), activePlanId: plans.find((p) => p.isActive)?.id ?? null, plansReviewedAt: now })
    .where(mine(userId, quarter))
    .returning({ q: reviews.quarter });
  return rows.length ? { ok: true } : { ok: false, error: "not_started" };
}

/** The end of the review. Finishing again keeps the first time. */
export async function completeQuarterReview(db: Db, userId: string, quarter: string, now: string): Promise<Result> {
  const [found] = await db.select().from(reviews).where(mine(userId, quarter));
  if (!found?.plansReviewedAt) return { ok: false, error: "not_started" };
  await db
    .update(reviews)
    .set({ completedAt: now })
    .where(and(mine(userId, quarter), isNull(reviews.completedAt)));
  return { ok: true };
}
