import type { Objective, OdysseyPlan, Task } from "@/domain/types";
import type { Db } from "./users";
import type * as schema from "./db/schema";

/** Postgres text timestamps ("2026-11-05 00:33:59.47+00") as ISO strings, like the rest of the app. */
export function iso(ts: string): string;
export function iso(ts: string | null): string | null;
export function iso(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return d.toISOString();
}

export function toTask(r: typeof schema.tasks.$inferSelect): Task {
  return {
    id: r.id,
    kind: r.kind,
    objectiveId: r.objectiveId,
    prototypePlanId: r.prototypePlanId,
    title: r.title,
    dueDate: r.dueDate,
    top3Date: r.top3Date,
    doneAt: iso(r.doneAt),
    closedAt: iso(r.closedAt),
    createdAt: iso(r.createdAt),
  };
}

export function toPlan(r: typeof schema.odysseyPlans.$inferSelect): OdysseyPlan {
  return {
    id: r.id,
    slot: r.slot as OdysseyPlan["slot"],
    title: r.title,
    questions: r.questions,
    gauges: { resources: r.resources, likability: r.likability, confidence: r.confidence, coherence: r.coherence },
    isActive: r.isActive,
  };
}

export function toObjective(r: typeof schema.objectives.$inferSelect): Objective {
  return { id: r.id, planId: r.planId, title: r.title, quarter: r.quarter, status: r.status };
}

/**
 * Run writes as one unit. Neon's HTTP driver has no interactive transactions, but `batch` runs
 * its statements in one; other drivers (PGlite in tests) use a plain transaction.
 */
export async function atomic(db: Db, build: (d: Db) => PromiseLike<unknown>[]): Promise<void> {
  const withBatch = db as Db & { batch?: (qs: PromiseLike<unknown>[]) => Promise<unknown> };
  if (typeof withBatch.batch === "function") {
    const qs = build(db);
    if (qs.length) await withBatch.batch(qs);
    return;
  }
  await db.transaction(async (tx) => {
    for (const q of build(tx as unknown as Db)) await q;
  });
}
