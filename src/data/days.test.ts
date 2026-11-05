import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { carryOver } from "@/domain/carry-over";
import * as schema from "./db/schema";
import { listLogs, patchLog } from "./days";
import { addDecision, getCompass, listDecisions, saveCompass } from "./life";
import { completeOnboarding } from "./onboarding";
import { ensurePlans, listObjectives, listPlans } from "./plans";
import { closeTask, createTask, listTasks, replaceTop3, setTop3 } from "./tasks";
import { ensureUser, type Db } from "./users";

let db: Db;
let me: string;
const id = () => crypto.randomUUID();
const longAgo = "2000-01-01T00:00:00.000Z";

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  await ensurePlans(db, me);
});

const add = async (title: string) => {
  const taskId = id();
  await createTask(db, me, { id: taskId, title, choice: { kind: "maintenance" } });
  return taskId;
};

describe("daily logs", () => {
  it("are made on first write and patched after", async () => {
    await patchLog(db, me, "2026-11-05", { morningAt: "2026-11-05T00:40:00.000Z", intention: { when: "lunch ends", then: "write" } });
    await patchLog(db, me, "2026-11-05", { energy: 4, meaningSources: ["flow"] });
    const [log] = await listLogs(db, me, "2026-11-01");
    expect(log).toMatchObject({ date: "2026-11-05", morningAt: "2026-11-05T00:40:00.000Z", intention: { when: "lunch ends", then: "write" }, energy: 4, meaningSources: ["flow"] });
  });

  it("only come back from the asked-for date on", async () => {
    await patchLog(db, me, "2026-10-01", { note: "old" });
    await patchLog(db, me, "2026-11-04", { note: "new" });
    expect((await listLogs(db, me, "2026-10-22")).map((l) => l.note)).toEqual(["new"]);
  });
});

describe("the logged Top 3", () => {
  it("follows every change to a day's Top 3", async () => {
    const [a, b, c] = [await add("a"), await add("b"), await add("c")];
    await replaceTop3(db, me, "2026-11-04", [a, b]);
    expect((await listLogs(db, me, "2026-11-01"))[0].top3TaskIds).toEqual([a, b]);
    await setTop3(db, me, c, "2026-11-04");
    await setTop3(db, me, a, null);
    expect((await listLogs(db, me, "2026-11-01"))[0].top3TaskIds).toEqual([b, c]);
  });

  it("keeps yesterday's Top 3 when a task moves into today's", async () => {
    const [a, b] = [await add("a"), await add("b")];
    await replaceTop3(db, me, "2026-11-04", [a, b]);
    await setTop3(db, me, a, "2026-11-05");
    const logs = await listLogs(db, me, "2026-11-01");
    expect(logs.find((l) => l.date === "2026-11-04")?.top3TaskIds).toEqual([b]);
    expect(logs.find((l) => l.date === "2026-11-05")?.top3TaskIds).toEqual([a]);
  });

  it("feeds tomorrow morning's carry-over", async () => {
    const [a, b] = [await add("a"), await add("b")];
    await replaceTop3(db, me, "2026-11-04", [a, b]);
    await closeTask(db, me, b, new Date().toISOString());
    const offered = carryOver(await listLogs(db, me, "2026-10-29"), await listTasks(db, me, longAgo), "2026-11-05");
    expect(offered.map((t) => t.id)).toEqual([a]);
  });
});

describe("compass and decisions", () => {
  it("saves the Compass and replaces it on edit", async () => {
    expect(await getCompass(db, me)).toBeNull();
    await saveCompass(db, me, { workview: "w1", lifeview: "l1" });
    await saveCompass(db, me, { workview: "w2", lifeview: "l2" });
    expect(await getCompass(db, me)).toEqual({ workview: "w2", lifeview: "l2" });
  });

  it("records Decisions, newest first, linked only to the user's own plans", async () => {
    const [p1] = await listPlans(db, me);
    await addDecision(db, me, { id: id(), date: "2026-10-01", decision: "Keep the job", drivenBy: "", linkedPlanId: null });
    await addDecision(db, me, { id: id(), date: "2026-11-01", decision: "Try the studio", drivenBy: "A good weekend", linkedPlanId: p1.id });
    expect((await listDecisions(db, me)).map((d) => d.decision)).toEqual(["Try the studio", "Keep the job"]);
    const other = (await ensureUser(db, "user_other", "UTC")).id;
    expect(await addDecision(db, other, { id: id(), date: "2026-11-01", decision: "x", drivenBy: "", linkedPlanId: p1.id })).toEqual({ ok: false });
  });
});

describe("Day 1 setup", () => {
  const setup = () => {
    const objective = { id: id(), title: "Ship the beta" };
    const tasks = [
      { id: id(), title: "Write the landing page", today: true },
      { id: id(), title: "Call two testers", today: false },
    ];
    return { compass: { workview: "w", lifeview: "l" }, objective, tasks, today: "2026-11-05", quarter: "2026-Q4" };
  };

  it("saves everything at once and counts the morning as done", async () => {
    const input = setup();
    expect(await completeOnboarding(db, me, input)).toEqual({ ok: true });
    expect(await getCompass(db, me)).toEqual({ workview: "w", lifeview: "l" });
    const [o] = await listObjectives(db, me);
    expect(o).toMatchObject({ title: "Ship the beta", planId: (await listPlans(db, me))[0].id });
    const tasks = await listTasks(db, me, longAgo);
    expect(tasks).toHaveLength(2);
    const [log] = await listLogs(db, me, "2026-11-05");
    expect(log.morningAt).not.toBeNull();
    expect(log.top3TaskIds).toEqual([input.tasks[0].id]);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, me));
    expect(u.onboardedAt).not.toBeNull();
    expect(u.onboarding).toMatchObject({ setupDate: "2026-11-05", seenTips: [] });
  });

  it("runs once", async () => {
    await completeOnboarding(db, me, setup());
    await completeOnboarding(db, me, setup());
    expect(await listObjectives(db, me)).toHaveLength(1);
  });

});
