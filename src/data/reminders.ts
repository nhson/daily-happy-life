import { eq } from "drizzle-orm";
import { en } from "@/copy/en";
import { vi } from "@/copy/vi";
import { compassLineFor } from "@/domain/compass-line";
import { logicalDate } from "@/domain/logical-day";
import { reminderCron } from "@/domain/reminder-schedule";
import type { Compass, LogicalDate } from "@/domain/types";
import * as schema from "./db/schema";
import { getCompass } from "./life";
import { listPlans } from "./plans";
import { settingsOf, type Db } from "./users";

/**
 * The daily reminder (SPEC "Reminder", ADR 0001): one web push per day at the user's chosen local
 * time, carrying the day's Compass line. A per-user QStash schedule calls `/api/remind`, which
 * sends the push. Both services sit behind these two small interfaces.
 */

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
/** Creates or replaces a daily schedule, and removes one. */
export interface Scheduler {
  upsert(id: string, cron: string, body: string): Promise<void>;
  remove(id: string): Promise<void>;
}
/** "gone": the push service says this subscription no longer exists. */
export interface Pusher {
  send(sub: PushSubscriptionJSON, payload: string): Promise<"sent" | "gone">;
}

const isSubscription = (s: unknown): s is PushSubscriptionJSON => {
  const v = s as PushSubscriptionJSON | null;
  return (
    !!v &&
    typeof v.endpoint === "string" &&
    v.endpoint.startsWith("https://") &&
    v.endpoint.length < 1000 &&
    typeof v.keys?.p256dh === "string" &&
    typeof v.keys?.auth === "string"
  );
};

const scheduleId = (userId: string) => `remind-${userId}`;
const user = async (db: Db, userId: string) => (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];

/** Keep the user's schedule in step with their subscription, reminder time and zone. */
export async function syncReminder(db: Db, userId: string, scheduler: Scheduler): Promise<void> {
  const u = await user(db, userId);
  if (!u) return;
  if (u.pushSubscription) {
    const id = scheduleId(userId);
    await scheduler.upsert(id, reminderCron(u.reminderTime, u.timezone), JSON.stringify({ userId }));
    if (u.reminderScheduleId !== id) await db.update(schema.users).set({ reminderScheduleId: id }).where(eq(schema.users.id, userId));
  } else if (u.reminderScheduleId) {
    await scheduler.remove(u.reminderScheduleId);
    await db.update(schema.users).set({ reminderScheduleId: null }).where(eq(schema.users.id, userId));
  }
}

/** Turn reminders on for this device (a subscription) or off (null). */
export async function savePush(db: Db, userId: string, sub: PushSubscriptionJSON | null, scheduler: Scheduler): Promise<{ ok: boolean }> {
  if (sub !== null && !isSubscription(sub)) return { ok: false };
  const value = sub && { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  await db.update(schema.users).set({ pushSubscription: value }).where(eq(schema.users.id, userId));
  await syncReminder(db, userId, scheduler);
  return { ok: true };
}

/** The notification: the day's Compass line, in the user's language. */
export function reminderMessage(input: {
  userId: string;
  locale: "vi" | "en";
  date: LogicalDate;
  compass: Compass | null;
  activePlanTitle: string | null;
}): { title: string; body: string; url: "/today"; tag: "daily-reminder" } {
  const copy = input.locale === "en" ? en : vi;
  const line = compassLineFor(input);
  const body = line.source === "mindset" ? copy.mindsets[line.mindset].line : line.text;
  return { title: copy.reminderPush.title, body, url: "/today", tag: "daily-reminder" };
}

/** Called by the schedule. A device that is gone is forgotten, and so is its schedule. */
export async function sendReminder(db: Db, userId: string, pusher: Pusher, scheduler: Scheduler, now: Date): Promise<"sent" | "gone" | "off"> {
  const u = await user(db, userId);
  if (!u?.pushSubscription || !isSubscription(u.pushSubscription)) return "off";
  const { timeZone, dayEndHour, locale } = settingsOf(u);
  const [compass, plans] = await Promise.all([getCompass(db, userId), listPlans(db, userId)]);
  const message = reminderMessage({
    userId,
    locale,
    date: logicalDate(now, timeZone, dayEndHour),
    compass,
    activePlanTitle: plans.find((p) => p.isActive)?.title || null,
  });
  const r = await pusher.send(u.pushSubscription, JSON.stringify(message));
  if (r === "gone") await savePush(db, userId, null, scheduler);
  return r;
}
