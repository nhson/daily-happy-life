import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { ensureUser, saveSettings, settingsOf } from "./users";

let db: ReturnType<typeof drizzle<typeof schema>>;
beforeEach(async () => {
  db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
});

describe("ensureUser", () => {
  it("creates the user row on first sign-in, with their timezone", async () => {
    const u = await ensureUser(db, "user_abc", "Asia/Ho_Chi_Minh");
    expect(u).toMatchObject({ clerkId: "user_abc", timezone: "Asia/Ho_Chi_Minh", locale: "vi" });
    expect(await db.$count(schema.users)).toBe(1);
  });

  it("returns the same row on every later visit and keeps the saved timezone", async () => {
    const first = await ensureUser(db, "user_abc", "Asia/Ho_Chi_Minh");
    const again = await ensureUser(db, "user_abc", "Europe/Paris");
    expect(again.id).toBe(first.id);
    expect(again.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(await db.$count(schema.users)).toBe(1);
  });

  it("falls back to Ho Chi Minh City when the timezone is missing or not a real zone", async () => {
    expect((await ensureUser(db, "a", null)).timezone).toBe("Asia/Ho_Chi_Minh");
    expect((await ensureUser(db, "b", "Mars/Olympus")).timezone).toBe("Asia/Ho_Chi_Minh");
  });
});

describe("saveSettings", () => {
  it("saves what Settings changes, and ignores values that aren't real settings", async () => {
    const me = (await ensureUser(db, "user_abc", "Asia/Ho_Chi_Minh")).id;
    await saveSettings(db, me, { reminderTime: "06:30", eveningHour: 21, dayEndHour: 2, theme: "light", locale: "en", timeZone: "Europe/Paris" });
    const ok = settingsOf((await db.select().from(schema.users).where(eq(schema.users.id, me)))[0]);
    expect(ok).toMatchObject({ reminderTime: "06:30", eveningHour: 21, dayEndHour: 2, theme: "light", locale: "en", timeZone: "Europe/Paris" });

    await saveSettings(db, me, { reminderTime: "25:00", eveningHour: 30, dayEndHour: 9, theme: "neon" as never, locale: "fr" as never, timeZone: "Mars/Olympus" });
    const still = settingsOf((await db.select().from(schema.users).where(eq(schema.users.id, me)))[0]);
    expect(still).toEqual(ok);
  });
});
