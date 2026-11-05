import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { freshOnboarding } from "@/domain/onboarding";
import * as schema from "./db/schema";
import { recordOnboarding } from "./onboarding";
import { ensureUser } from "./users";

let db: ReturnType<typeof drizzle<typeof schema>>;
let userId: string;
const at = { today: "2026-11-05", now: "2026-11-05T01:00:00.000Z" };
beforeEach(async () => {
  db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  userId = (await ensureUser(db, "user_abc", "Asia/Ho_Chi_Minh")).id;
  await db.update(schema.users).set({ onboarding: freshOnboarding("2026-11-04") }).where(eq(schema.users.id, userId));
});
const stored = async (id = userId) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0].onboarding;

describe("recordOnboarding", () => {
  it("applies each device's change to what is stored, so neither undoes the other", async () => {
    // Phone and laptop both loaded the same state; each dismisses a different tip.
    await recordOnboarding(db, userId, { type: "tipSeen", tip: "top3" }, at);
    await recordOnboarding(db, userId, { type: "tipSeen", tip: "capture" }, at);
    expect((await stored())?.seenTips).toEqual(["top3", "capture"]);
  });

  it("returns the state it stored", async () => {
    const r = await recordOnboarding(db, userId, { type: "reminderAsked" }, at);
    expect(r).toEqual(await stored());
    expect(r?.reminderAskedAt).toBe(at.now);
  });

  it("only touches the given user's row", async () => {
    const other = (await ensureUser(db, "user_other", null)).id;
    await recordOnboarding(db, userId, { type: "tipSeen", tip: "life" }, at);
    expect((await stored(other))?.seenTips ?? []).toEqual([]);
  });
});
