import { eq, sql } from "drizzle-orm";
import type { UserSettings } from "@/domain/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./db/schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type User = typeof schema.users.$inferSelect;

const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function validTimeZone(tz: string | null): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * The user row for a signed-in Clerk user, created on first sign-in. The timezone is only
 * a first guess (from the request); once saved it belongs to the user and Settings changes it.
 */
export async function ensureUser(db: Db, clerkId: string, timeZone: string | null): Promise<User> {
  const [user] = await db
    .insert(schema.users)
    .values({ clerkId, timezone: validTimeZone(timeZone) })
    // A no-op update so the existing row comes back in one round trip.
    .onConflictDoUpdate({ target: schema.users.clerkId, set: { clerkId: sql`excluded.clerk_id` } })
    .returning();
  return user;
}

/** The parts of Settings that live on the user row. */
export function settingsOf(u: User): UserSettings {
  return {
    timeZone: u.timezone,
    reminderTime: u.reminderTime,
    eveningHour: u.eveningHour,
    dayEndHour: u.dayEndHour,
    theme: u.theme,
    locale: u.locale,
  };
}

export async function saveSettings(db: Db, userId: string, patch: Partial<UserSettings>): Promise<void> {
  const set: Partial<typeof schema.users.$inferInsert> = {};
  if (patch.timeZone !== undefined) set.timezone = validTimeZone(patch.timeZone);
  if (patch.reminderTime !== undefined) set.reminderTime = patch.reminderTime;
  if (patch.eveningHour !== undefined) set.eveningHour = patch.eveningHour;
  if (patch.dayEndHour !== undefined) set.dayEndHour = patch.dayEndHour;
  if (patch.theme !== undefined) set.theme = patch.theme;
  if (patch.locale !== undefined) set.locale = patch.locale;
  if (Object.keys(set).length) await db.update(schema.users).set(set).where(eq(schema.users.id, userId));
}
