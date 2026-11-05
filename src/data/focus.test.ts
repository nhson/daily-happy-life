import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { endFocus, listFocus, sendFocusEnd, startFocus, type Later } from "./focus";
import type { Pusher } from "./reminders";
import { createTask } from "./tasks";
import { ensureUser, type Db } from "./users";

let db: Db;
let me: string;
let other: string;
let queued: Map<string, { delay: number; body: string }>;
let sent: string[];
let n = 0;

const later: Later = {
  at: async (delay, body) => {
    const id = `msg_${++n}`;
    queued.set(id, { delay, body });
    return id;
  },
  cancel: async (id) => void queued.delete(id),
};
const pusher: Pusher = { send: async (_sub, payload) => (sent.push(payload), "sent") };
const sub = { endpoint: "https://push.example.com/1", keys: { p256dh: "BPk", auth: "AuT" } };
const T1 = "00000000-0000-4000-8000-000000000001";
const T2 = "00000000-0000-4000-8000-000000000002";
const F1 = "00000000-0000-4000-8000-0000000000f1";
const F2 = "00000000-0000-4000-8000-0000000000f2";
const at = (iso: string) => new Date(iso);
const rows = async (userId = me) => db.select().from(schema.focusSessions).where(eq(schema.focusSessions.userId, userId));

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  other = (await ensureUser(db, "user_other", "Asia/Ho_Chi_Minh")).id;
  await createTask(db, me, { id: T1, title: "Viết trang giới thiệu", choice: { kind: "maintenance" } });
  await createTask(db, me, { id: T2, title: "Gọi hai người dùng thử", choice: { kind: "maintenance" } });
  queued = new Map();
  sent = [];
});

describe("starting a Focus Session", () => {
  it("is recorded with the server's time, and a push is queued for its end when this user gets pushes", async () => {
    await db.update(schema.users).set({ pushSubscription: sub }).where(eq(schema.users.id, me));
    expect(await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), later)).toEqual({ ok: true });
    expect(await listFocus(db, me, "2026-11-04T00:00:00Z")).toEqual([
      { id: F1, taskId: T1, startedAt: "2026-11-05T02:00:00.000Z", plannedMinutes: 25, endedAt: null },
    ]);
    expect([...queued.values()]).toEqual([{ delay: 25 * 60, body: JSON.stringify({ userId: me, focusId: F1 }) }]);
  });

  it("queues no push when the user has none", async () => {
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), later);
    expect(queued.size).toBe(0);
  });

  it("ends the one before (and its push), so only one runs", async () => {
    await db.update(schema.users).set({ pushSubscription: sub }).where(eq(schema.users.id, me));
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), later);
    await startFocus(db, me, { id: F2, taskId: T2, minutes: 50 }, at("2026-11-05T02:10:00Z"), later);
    const [a, b] = (await listFocus(db, me, "2026-11-04T00:00:00Z")).sort((x, y) => x.startedAt.localeCompare(y.startedAt));
    expect(a.endedAt).toBe("2026-11-05T02:10:00.000Z");
    expect(b.endedAt).toBeNull();
    expect([...queued.values()].map((q) => JSON.parse(q.body).focusId)).toEqual([F2]);
  });

  it("refuses a length out of range, a task that is not open, or someone else's task", async () => {
    expect(await startFocus(db, me, { id: F1, taskId: T1, minutes: 0 }, new Date(), null)).toEqual({ ok: false, error: "bad_minutes" });
    expect(await startFocus(db, other, { id: F1, taskId: T1, minutes: 25 }, new Date(), null)).toEqual({ ok: false, error: "not_found" });
    await db.update(schema.tasks).set({ doneAt: new Date().toISOString() }).where(eq(schema.tasks.id, T1));
    expect(await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, new Date(), null)).toEqual({ ok: false, error: "not_found" });
    expect(await rows()).toHaveLength(0);
  });

  it("a retried start (same id) is a no-op", async () => {
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), null);
    expect(await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:05Z"), null)).toEqual({ ok: true });
    expect(await rows()).toHaveLength(1);
  });
});

describe("ending a Focus Session", () => {
  it("early: ends now and cancels its push", async () => {
    await db.update(schema.users).set({ pushSubscription: sub }).where(eq(schema.users.id, me));
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), later);
    expect(await endFocus(db, me, F1, at("2026-11-05T02:12:00Z"), later)).toEqual({ ok: true });
    expect((await rows())[0].endedAt).not.toBeNull();
    expect((await listFocus(db, me, "2026-11-04T00:00:00Z"))[0].endedAt).toBe("2026-11-05T02:12:00.000Z");
    expect(queued.size).toBe(0);
  });

  it("after its time: ends at the planned end", async () => {
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), null);
    await endFocus(db, me, F1, at("2026-11-05T09:00:00Z"), null);
    expect((await listFocus(db, me, "2026-11-04T00:00:00Z"))[0].endedAt).toBe("2026-11-05T02:25:00.000Z");
  });

  it("only the owner can end it", async () => {
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), null);
    expect(await endFocus(db, other, F1, at("2026-11-05T02:12:00Z"), null)).toEqual({ ok: false, error: "not_found" });
    expect((await rows())[0].endedAt).toBeNull();
  });

  it("goes when its task is deleted", async () => {
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), null);
    await db.delete(schema.tasks).where(eq(schema.tasks.id, T1));
    expect(await rows()).toHaveLength(0);
  });
});

describe("the end-of-focus push", () => {
  beforeEach(async () => {
    await db.update(schema.users).set({ pushSubscription: sub }).where(eq(schema.users.id, me));
    await startFocus(db, me, { id: F1, taskId: T1, minutes: 25 }, at("2026-11-05T02:00:00Z"), later);
  });

  it("names the task, in the user's language, once its time is up", async () => {
    expect(await sendFocusEnd(db, me, F1, pusher, at("2026-11-05T02:25:01Z"))).toBe("sent");
    expect(JSON.parse(sent[0])).toEqual({ title: "Hết giờ tập trung", body: "Viết trang giới thiệu", url: "/today", tag: "focus-end" });
  });

  it("stays quiet if the session was stopped, is not due yet, or is someone else's", async () => {
    expect(await sendFocusEnd(db, me, F1, pusher, at("2026-11-05T02:10:00Z"))).toBe("stale");
    expect(await sendFocusEnd(db, other, F1, pusher, at("2026-11-05T02:25:01Z"))).toBe("stale");
    await endFocus(db, me, F1, at("2026-11-05T02:12:00Z"), later);
    expect(await sendFocusEnd(db, me, F1, pusher, at("2026-11-05T02:25:01Z"))).toBe("stale");
    expect(sent).toEqual([]);
  });
});
