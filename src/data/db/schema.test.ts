import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";

/** The real migrations, run on an in-memory Postgres: the database itself must refuse bad shapes. */
let db: ReturnType<typeof drizzle<typeof schema>>;
let userId: string;
let objectiveId: string;
let planB: string;

beforeEach(async () => {
  db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  [{ id: userId }] = await db.insert(schema.users).values({ clerkId: "user_1", timezone: "Asia/Ho_Chi_Minh" }).returning();
  const plans = await db
    .insert(schema.odysseyPlans)
    .values([1, 2, 3].map((slot) => ({ userId, slot, isActive: slot === 1 })))
    .returning();
  planB = plans[1].id;
  [{ id: objectiveId }] = await db
    .insert(schema.objectives)
    .values({ userId, planId: plans[0].id, title: "Run three mornings a week", quarter: "2026-Q4" })
    .returning();
});

/** Postgres error code of a failed write (23514 check, 23505 unique), unwrapped from Drizzle's error. */
async function rejects(write: Promise<unknown>): Promise<string> {
  try {
    await write;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code ?? "unknown";
  }
  throw new Error("write was accepted");
}

describe("users", () => {
  it("gets the defaults: Vietnamese, sky theme, day ends at 4, evening at 19", async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(u).toMatchObject({ locale: "vi", theme: "sky", dayEndHour: 4, eveningHour: 19, reminderTime: "07:00" });
  });

  it("is one row per Clerk user", async () => {
    expect(await rejects(db.insert(schema.users).values({ clerkId: "user_1", timezone: "UTC" }))).toBe("23505");
  });

  it("refuses an unknown locale, theme, hour or reminder time", async () => {
    const u = (v: Partial<typeof schema.users.$inferInsert>) =>
      rejects(db.insert(schema.users).values({ clerkId: crypto.randomUUID(), timezone: "UTC", ...v }));
    expect(await u({ locale: "fr" as "vi" })).toBe("23514");
    expect(await u({ theme: "neon" as "sky" })).toBe("23514");
    expect(await u({ eveningHour: 24 })).toBe("23514");
    expect(await u({ dayEndHour: -1 })).toBe("23514");
    expect(await u({ reminderTime: "7am" })).toBe("23514");
  });
});

describe("odyssey_plans", () => {
  it("has slots 1–3 only, one per slot", async () => {
    expect(await rejects(db.insert(schema.odysseyPlans).values({ userId, slot: 4 }))).toBe("23514");
    expect(await rejects(db.insert(schema.odysseyPlans).values({ userId, slot: 2 }))).toBe("23505");
  });

  it("allows at most one Active Plan", async () => {
    expect(await rejects(db.update(schema.odysseyPlans).set({ isActive: true }).where(eq(schema.odysseyPlans.id, planB)))).toBe("23505");
  });

  it("keeps Gauges between 0 and 10", async () => {
    expect(await rejects(db.update(schema.odysseyPlans).set({ likability: 11 }).where(eq(schema.odysseyPlans.id, planB)))).toBe("23514");
  });
});

describe("objectives", () => {
  it("needs a 'YYYY-Qn' quarter and a known status", async () => {
    const o = (v: Partial<typeof schema.objectives.$inferInsert>) =>
      rejects(db.insert(schema.objectives).values({ userId, planId: planB, title: "x", quarter: "2026-Q4", ...v }));
    expect(await o({ quarter: "Q4 2026" })).toBe("23514");
    expect(await o({ status: "paused" as "active" })).toBe("23514");
  });
});

describe("tasks: exactly one why", () => {
  const task = (v: Partial<typeof schema.tasks.$inferInsert>) =>
    db.insert(schema.tasks).values({ userId, title: "t", kind: "maintenance", ...v });

  it("accepts each valid shape", async () => {
    await task({ kind: "maintenance" });
    await task({ kind: "objective", objectiveId });
    await task({ kind: "prototype", prototypePlanId: planB });
    expect(await db.$count(schema.tasks)).toBe(3);
  });

  it("refuses a missing or extra link", async () => {
    expect(await rejects(task({ kind: "objective" }))).toBe("23514");
    expect(await rejects(task({ kind: "prototype" }))).toBe("23514");
    expect(await rejects(task({ kind: "maintenance", objectiveId }))).toBe("23514");
    expect(await rejects(task({ kind: "objective", objectiveId, prototypePlanId: planB }))).toBe("23514");
  });
});

describe("daily_logs", () => {
  const log = (v: Partial<typeof schema.dailyLogs.$inferInsert>) =>
    db.insert(schema.dailyLogs).values({ userId, date: "2026-11-04", ...v });

  it("keeps Energy and Engagement on 1–5", async () => {
    expect(await rejects(log({ energy: 0 }))).toBe("23514");
    expect(await rejects(log({ engagement: 6 }))).toBe("23514");
  });

  it("only knows the four Sources of Meaning, and a Top 3 of at most three", async () => {
    expect(await rejects(log({ meaningSources: ["joy"] }))).toBe("23514");
    expect(await rejects(log({ top3TaskIds: ["a", "b", "c", "d"] }))).toBe("23514");
    await log({ meaningSources: ["flow", "community"], top3TaskIds: ["a", "b", "c"] });
  });

  it("is one log per Logical Day", async () => {
    await log({});
    expect(await rejects(log({}))).toBe("23505");
  });
});

describe("deleting a user", () => {
  it("removes everything they own", async () => {
    await db.insert(schema.tasks).values({ userId, title: "t", kind: "objective", objectiveId });
    await db.insert(schema.compass).values({ userId, workview: "w", lifeview: "l" });
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    expect(await db.$count(schema.tasks)).toBe(0);
    expect(await db.$count(schema.odysseyPlans)).toBe(0);
    expect(await db.$count(schema.compass)).toBe(0);
  });
});
