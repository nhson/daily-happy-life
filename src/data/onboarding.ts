import { and, eq } from "drizzle-orm";
import { freshOnboarding, type OnboardingState } from "@/domain/onboarding";
import type { Compass, LogicalDate } from "@/domain/types";
import * as schema from "./db/schema";
import { patchLog, snapshotTop3 } from "./days";
import { saveCompass } from "./life";
import { atomic } from "./rows";
import type { Db } from "./users";

/** Tips seen, nudges snoozed, reminder asked — UI progress only, following the user across devices. */
export async function saveOnboarding(db: Db, userId: string, state: OnboardingState): Promise<void> {
  await db.update(schema.users).set({ onboarding: state }).where(eq(schema.users.id, userId));
}

/**
 * Day 1 setup, all at once: Compass, one Objective under the Current Path, the first tasks, the
 * user's own picks as today's Top 3, and the Morning Ritual counted as done.
 */
export async function completeOnboarding(
  db: Db,
  userId: string,
  input: {
    compass: Compass;
    objective: { id: string; title: string };
    tasks: { id: string; title: string; today: boolean }[];
    today: LogicalDate;
    quarter: string;
  },
): Promise<{ ok: boolean }> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return { ok: false };
  if (user.onboardedAt) return { ok: true };
  const [plan] = await db
    .select({ id: schema.odysseyPlans.id })
    .from(schema.odysseyPlans)
    .where(and(eq(schema.odysseyPlans.userId, userId), eq(schema.odysseyPlans.slot, 1)));
  const title = input.objective.title.trim();
  if (!plan || !title || !input.compass.workview.trim() || !input.compass.lifeview.trim()) return { ok: false };
  const firsts = input.tasks.filter((t) => t.title.trim()).slice(0, 3);
  const now = new Date().toISOString();

  await atomic(db, (d) => [
    saveCompass(d, userId, input.compass),
    d.insert(schema.objectives).values({ id: input.objective.id, userId, planId: plan.id, title, quarter: input.quarter }),
    ...(firsts.length
      ? [
          d.insert(schema.tasks).values(
            firsts.map((t) => ({
              id: t.id,
              userId,
              kind: "objective" as const,
              objectiveId: input.objective.id,
              title: t.title.trim(),
              top3Date: t.today ? input.today : null,
            })),
          ),
        ]
      : []),
    // Day 1 counts as the Morning Ritual done: setup asked enough.
    patchLog(d, userId, input.today, { morningAt: now }),
    snapshotTop3(d, userId, input.today),
    d.update(schema.users).set({ onboardedAt: now, onboarding: freshOnboarding(input.today) }).where(eq(schema.users.id, userId)),
  ]);
  return { ok: true };
}
