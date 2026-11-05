import { and, desc, eq, isNull } from "drizzle-orm";
import { asksCompass, ratedPlans, type CompassVersion, type Dashboard, type QuarterlyReview } from "@/domain/quarterly-review";
import type { Compass, Gauges } from "@/domain/types";
import * as schema from "./db/schema";
import { listPlans } from "./plans";
import { atomic, iso } from "./rows";
import type { Db } from "./users";

/**
 * Quarterly Reviews of one user (rules in `src/domain/quarterly-review.ts`), saved step by step:
 * the dashboard starts the row, the plans step snapshots the Gauges and the Active Plan, and the
 * end marks it complete. The caller (a Server Action) decides which quarter is being reviewed.
 */

const { quarterlyReviews: reviews, compass, compassVersions } = schema;
const mine = (userId: string, quarter: string) => and(eq(reviews.userId, userId), eq(reviews.quarter, quarter));
type Result = { ok: true } | { ok: false; error: "not_started" };

function toReview(r: typeof reviews.$inferSelect): QuarterlyReview {
  return {
    quarter: r.quarter,
    dashboard: { health: r.health, work: r.work, play: r.play, love: r.love },
    plans: r.plans ?? null,
    activePlanId: r.activePlanId,
    compassReviewedAt: iso(r.compassReviewedAt),
    dashboardAt: iso(r.dashboardAt),
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
export async function saveDashboard(db: Db, userId: string, quarter: string, d: Dashboard, now = new Date().toISOString()): Promise<Result> {
  await db
    .insert(reviews)
    .values({ userId, quarter, ...d, dashboardAt: now })
    .onConflictDoUpdate({ target: [reviews.userId, reviews.quarter], set: { ...d, dashboardAt: now } });
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
  const [found] = await db.select({ at: reviews.dashboardAt }).from(reviews).where(mine(userId, quarter));
  if (!found?.at) return { ok: false, error: "not_started" };
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

/** Past Compasses, the latest replaced first. */
export async function listCompassVersions(db: Db, userId: string): Promise<CompassVersion[]> {
  const rows = await db.select().from(compassVersions).where(eq(compassVersions.userId, userId)).orderBy(desc(compassVersions.replacedAt));
  return rows.map((r) => ({ workview: r.workview, lifeview: r.lifeview, writtenAt: iso(r.writtenAt), replacedAt: iso(r.replacedAt) }));
}

/**
 * The yearly Compass, first step of the review of Q4: `next` rewrites it (the old pair is kept as a
 * past version), null keeps it ("Still true"). Once per review; a repeat changes nothing.
 */
export async function reviewCompass(
  db: Db,
  userId: string,
  quarter: string,
  now: string,
  next: Compass | null,
): Promise<{ ok: true } | { ok: false; error: "not_now" | "empty" }> {
  if (!asksCompass(quarter)) return { ok: false, error: "not_now" };
  const fresh = next && { workview: next.workview.trim(), lifeview: next.lifeview.trim() };
  if (fresh && (!fresh.workview || !fresh.lifeview)) return { ok: false, error: "empty" };
  const [[found], [old]] = await Promise.all([
    db.select({ at: reviews.compassReviewedAt }).from(reviews).where(mine(userId, quarter)),
    db.select().from(compass).where(eq(compass.userId, userId)),
  ]);
  if (found?.at) return { ok: true };
  await atomic(db, (d) => {
    const qs: PromiseLike<unknown>[] = [];
    if (fresh) {
      if (old) qs.push(d.insert(compassVersions).values({ userId, workview: old.workview, lifeview: old.lifeview, writtenAt: old.updatedAt, replacedAt: now }));
      qs.push(
        d.insert(compass).values({ userId, ...fresh, updatedAt: now }).onConflictDoUpdate({ target: compass.userId, set: { ...fresh, updatedAt: now } }),
      );
    }
    qs.push(
      d
        .insert(reviews)
        .values({ userId, quarter, compassReviewedAt: now })
        .onConflictDoUpdate({ target: [reviews.userId, reviews.quarter], set: { compassReviewedAt: now } }),
    );
    return qs;
  });
  return { ok: true };
}
