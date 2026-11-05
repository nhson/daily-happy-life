import { desc, eq } from "drizzle-orm";
import type { Compass, Decision, LogicalDate } from "@/domain/types";
import * as schema from "./db/schema";
import type { Db } from "./users";

/** The Compass and Decisions of one user. */

const { compass, decisions } = schema;

export async function getCompass(db: Db, userId: string): Promise<Compass | null> {
  const [c] = await db.select().from(compass).where(eq(compass.userId, userId));
  return c ? { workview: c.workview, lifeview: c.lifeview } : null;
}

export function saveCompass(db: Db, userId: string, c: Compass) {
  const now = new Date().toISOString();
  return db
    .insert(compass)
    .values({ userId, workview: c.workview.trim(), lifeview: c.lifeview.trim() })
    .onConflictDoUpdate({ target: compass.userId, set: { workview: c.workview.trim(), lifeview: c.lifeview.trim(), updatedAt: now } });
}

export async function listDecisions(db: Db, userId: string): Promise<Decision[]> {
  const rows = await db.select().from(decisions).where(eq(decisions.userId, userId)).orderBy(desc(decisions.date), desc(decisions.createdAt));
  return rows.map((r) => ({ id: r.id, date: r.date, decision: r.decision, drivenBy: r.drivenBy, linkedPlanId: r.linkedPlanId }));
}

export async function addDecision(
  db: Db,
  userId: string,
  d: { id: string; date: LogicalDate; decision: string; drivenBy: string; linkedPlanId: string | null },
): Promise<{ ok: boolean }> {
  if (!d.decision.trim()) return { ok: false };
  if (d.linkedPlanId) {
    const [p] = await db.select({ userId: schema.odysseyPlans.userId }).from(schema.odysseyPlans).where(eq(schema.odysseyPlans.id, d.linkedPlanId));
    if (p?.userId !== userId) return { ok: false };
  }
  await db.insert(decisions).values({ ...d, userId, decision: d.decision.trim(), drivenBy: d.drivenBy.trim() }).onConflictDoNothing();
  return { ok: true };
}
