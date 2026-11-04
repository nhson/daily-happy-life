import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./db/schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type User = typeof schema.users.$inferSelect;

const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

function validTimeZone(tz: string | null): string {
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
