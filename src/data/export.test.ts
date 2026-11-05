import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { patchLog } from "./days";
import * as schema from "./db/schema";
import { exportAll, importAll, type Export } from "./export";
import { addDecision } from "./life";
import { completeOnboarding } from "./onboarding";
import { addObjective, ensurePlans, listPlans, savePlan } from "./plans";
import { createTask, setDone } from "./tasks";
import { ensureUser, saveSettings, type Db } from "./users";

const id = () => crypto.randomUUID();

async function freshDb(): Promise<Db> {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  return pg as unknown as Db;
}

/** An account that has lived a little: every table has rows, including a Daily Log months old. */
async function livedIn(db: Db): Promise<string> {
  const me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  await ensurePlans(db, me);
  await completeOnboarding(db, me, {
    compass: { workview: "Công việc là cách mình giúp người khác.", lifeview: "Cuộc sống dành cho người mình thương." },
    objective: { id: id(), title: "Ra mắt bản beta" },
    tasks: [
      { id: id(), title: "Viết trang giới thiệu", today: true },
      { id: id(), title: "Gọi hai người dùng thử", today: false },
    ],
    today: "2026-11-05",
    quarter: "2026-Q4",
  });
  const [, p2] = await listPlans(db, me);
  await savePlan(db, me, { ...p2, title: "Mở một studio nhỏ", gauges: { resources: 4, likability: 8, confidence: 5, coherence: 7 } });
  const done = id();
  await createTask(db, me, { id: done, title: "Cà phê với chủ studio", choice: { kind: "prototype", planId: p2.id } });
  await setDone(db, me, done, "2026-11-05T09:00:00.000Z");
  await addObjective(db, me, { id: id(), title: "Khỏe hơn", quarter: "2026-Q4" });
  await patchLog(db, me, "2026-06-01", { energy: 4, engagement: 5, meaningSources: ["flow", "community"], note: "Một ngày dài, vui.", closedAt: "2026-06-01T15:00:00.000Z" });
  await addDecision(db, me, { id: id(), date: "2026-11-05", decision: "Thử studio", drivenBy: "Ba buổi cà phê.", linkedPlanId: p2.id });
  await saveSettings(db, me, { reminderTime: "06:45", eveningHour: 20, dayEndHour: 3, theme: "dark", locale: "en" });
  return me;
}

const withoutStamp = (x: Export) => ({ ...x, exportedAt: "" });

// Each test builds one or two databases from the migrations: slower than most under a full run.
describe("export", { timeout: 30_000 }, () => {
  it("covers every table the user owns, with nothing of anyone else's", async () => {
    const db = await freshDb();
    const me = await livedIn(db);
    const other = (await ensureUser(db, "user_other", null)).id;
    await ensurePlans(db, other);
    const x = await exportAll(db, me);

    expect(x.format).toBe("daily-happy-life");
    expect(x.version).toBe(1);
    expect(x.settings).toEqual({ timeZone: "Asia/Ho_Chi_Minh", reminderTime: "06:45", eveningHour: 20, dayEndHour: 3, theme: "dark", locale: "en" });
    expect(x.compass?.workview).toContain("giúp người khác");
    expect(x.odysseyPlans).toHaveLength(3);
    expect(x.objectives).toHaveLength(2);
    expect(x.tasks).toHaveLength(3);
    expect(x.dailyLogs.map((l) => l.date).sort()).toEqual(["2026-06-01", "2026-11-05"]);
    expect(x.decisions).toHaveLength(1);
    expect(x.onboarding?.setupDate).toBe("2026-11-05");
    // No user ids, no Clerk id, no push secrets.
    expect(JSON.stringify(x)).not.toContain(me);
    expect(JSON.stringify(x)).not.toContain("user_me");
    expect(JSON.stringify(x)).not.toContain(other);
  });

  it("round-trips: restored into an empty account elsewhere, it exports the same", async () => {
    const src = await freshDb();
    const before = await exportAll(src, await livedIn(src));
    const dst = await freshDb();
    const fresh = (await ensureUser(dst, "user_new", null)).id;
    await ensurePlans(dst, fresh); // what signing in creates
    await importAll(dst, fresh, JSON.parse(JSON.stringify(before)));
    expect(withoutStamp(await exportAll(dst, fresh))).toEqual(withoutStamp(before));
  });

  it("restoring into the same account replaces what is there", async () => {
    const db = await freshDb();
    const me = await livedIn(db);
    const before = await exportAll(db, me);
    await db.update(schema.tasks).set({ title: "đã sửa" }).where(eq(schema.tasks.userId, me));
    await importAll(db, me, before);
    expect(withoutStamp(await exportAll(db, me))).toEqual(withoutStamp(before));
  });

  it("refuses something that isn't an export", async () => {
    const db = await freshDb();
    const me = await livedIn(db);
    await expect(importAll(db, me, { format: "other" } as never)).rejects.toThrow();
  });
});
