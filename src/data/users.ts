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

/** Settings the user changed; anything that isn't a real value for its setting is ignored. */
export async function saveSettings(db: Db, userId: string, patch: Partial<UserSettings>): Promise<void> {
  const set: Partial<typeof schema.users.$inferInsert> = {};
  const hour = (h: unknown, lo: number, hi: number): h is number => Number.isInteger(h) && (h as number) >= lo && (h as number) <= hi;
  if (typeof patch.timeZone === "string" && validTimeZone(patch.timeZone) === patch.timeZone) set.timezone = patch.timeZone;
  if (typeof patch.reminderTime === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(patch.reminderTime)) set.reminderTime = patch.reminderTime;
  if (hour(patch.eveningHour, 0, 23)) set.eveningHour = patch.eveningHour;
  // The Logical Day ends between midnight and 06:00 (Settings offers those hours).
  if (hour(patch.dayEndHour, 0, 6)) set.dayEndHour = patch.dayEndHour;
  if (patch.theme === "sky" || patch.theme === "light" || patch.theme === "dark") set.theme = patch.theme;
  if (patch.locale === "vi" || patch.locale === "en") set.locale = patch.locale;
  if (Object.keys(set).length) await db.update(schema.users).set(set).where(eq(schema.users.id, userId));
}
