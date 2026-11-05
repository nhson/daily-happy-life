import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { vi as viCopy } from "@/copy/vi";
import * as schema from "./db/schema";
import { saveCompass } from "./life";
import { reminderMessage, savePush, sendReminder, syncReminder, type Pusher, type Scheduler } from "./reminders";
import { ensureUser, saveSettings, type Db } from "./users";

let db: Db;
let me: string;
let schedules: Map<string, { cron: string; body: string }>;
let sent: { endpoint: string; payload: string }[];
let gone: Set<string>;

const scheduler: Scheduler = {
  upsert: async (id, cron, body) => void schedules.set(id, { cron, body }),
  remove: async (id) => void schedules.delete(id),
};
const pusher: Pusher = {
  send: async (sub, payload) => {
    if (gone.has(sub.endpoint)) return "gone";
    sent.push({ endpoint: sub.endpoint, payload });
    return "sent";
  },
};
const sub = (n = 1) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: "BPk", auth: "AuT" } });
const row = async () => (await db.select().from(schema.users).where(eq(schema.users.id, me)))[0];

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  schedules = new Map();
  sent = [];
  gone = new Set();
});

describe("reminder schedule", () => {
  it("turning reminders on stores this device and schedules the chosen minute in the user's zone", async () => {
    await saveSettings(db, me, { reminderTime: "06:45" });
    expect(await savePush(db, me, sub(), scheduler)).toEqual({ ok: true });
    expect((await row()).pushSubscription).toEqual(sub());
    expect([...schedules.values()]).toEqual([{ cron: "CRON_TZ=Asia/Ho_Chi_Minh 45 6 * * *", body: JSON.stringify({ userId: me }) }]);
    expect((await row()).reminderScheduleId).toBe([...schedules.keys()][0]);
  });

  it("follows a new time or zone, and stops when turned off", async () => {
    await savePush(db, me, sub(), scheduler);
    await saveSettings(db, me, { reminderTime: "21:05", timeZone: "Europe/Paris" });
    await syncReminder(db, me, scheduler);
    expect([...schedules.values()].map((s) => s.cron)).toEqual(["CRON_TZ=Europe/Paris 5 21 * * *"]);

    await savePush(db, me, null, scheduler);
    expect(schedules.size).toBe(0);
    expect(await row()).toMatchObject({ pushSubscription: null, reminderScheduleId: null });
  });

  it("refuses something that isn't a push subscription", async () => {
    expect(await savePush(db, me, { endpoint: "http://x" } as never, scheduler)).toEqual({ ok: false });
    expect(await savePush(db, me, { endpoint: "javascript:alert(1)", keys: { p256dh: "a", auth: "b" } } as never, scheduler)).toEqual({ ok: false });
    expect(schedules.size).toBe(0);
  });
});

describe("sending the reminder", () => {
  it("carries the day's Compass line in the user's language", async () => {
    await saveCompass(db, me, { workview: "Công việc là cách mình giúp người khác.", lifeview: "Cuộc sống dành cho người mình thương." });
    await savePush(db, me, sub(), scheduler);
    expect(await sendReminder(db, me, pusher, scheduler, new Date("2026-11-06T00:00:00Z"))).toBe("sent");
    const p = JSON.parse(sent[0].payload);
    expect(p.title).toBe(viCopy.reminderPush.title);
    expect(["Công việc là cách mình giúp người khác.", "Cuộc sống dành cho người mình thương."].concat(Object.values(viCopy.mindsets).map((m) => m.line))).toContain(p.body);
    expect(p.url).toBe("/today");
  });

  it("forgets a device the push service says is gone, and its schedule", async () => {
    await savePush(db, me, sub(7), scheduler);
    gone.add(sub(7).endpoint);
    expect(await sendReminder(db, me, pusher, scheduler, new Date())).toBe("gone");
    expect(await row()).toMatchObject({ pushSubscription: null, reminderScheduleId: null });
    expect(schedules.size).toBe(0);
  });

  it("does nothing for a user who turned reminders off", async () => {
    expect(await sendReminder(db, me, pusher, scheduler, new Date())).toBe("off");
    expect(sent).toHaveLength(0);
  });
});

describe("reminderMessage", () => {
  it("is deterministic per user and day, like the Compass line on Today", () => {
    const input = { userId: "u", locale: "en" as const, date: "2026-11-06", compass: { workview: "Work is how I help.", lifeview: "Life is for people." }, activePlanTitle: null };
    expect(reminderMessage(input)).toEqual(reminderMessage(input));
    expect(reminderMessage({ ...input, compass: null }).body.length).toBeGreaterThan(0);
  });
});
