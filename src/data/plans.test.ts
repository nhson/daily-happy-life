import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { addObjective, ensurePlans, listObjectives, listPlans, savePlan, setActivePlan, setObjectiveStatus } from "./plans";
import { createTask, listTasks } from "./tasks";
import { ensureUser, type Db } from "./users";

let db: Db;
let me: string;
const id = () => crypto.randomUUID();
const Q = "2026-Q4";
const ctx = () => ({ quarter: Q, now: new Date().toISOString(), newObjectiveId: id() });

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  await ensurePlans(db, me);
});

describe("plans", () => {
  it("gives every user three empty slots, once", async () => {
    await ensurePlans(db, me);
    const ps = await listPlans(db, me);
    expect(ps.map((p) => [p.slot, p.title, p.isActive])).toEqual([
      [1, "", false],
      [2, "", false],
      [3, "", false],
    ]);
  });

  it("saves a plan's words and gauges", async () => {
    const [p] = await listPlans(db, me);
    await savePlan(db, me, { ...p, title: "Lead a calm AI team", gauges: { ...p.gauges, likability: 8 } });
    expect((await listPlans(db, me))[0]).toMatchObject({ title: "Lead a calm AI team", gauges: { likability: 8 } });
  });
});

describe("objectives", () => {
  it("hang under the Current Path until a plan is active, and stop at three", async () => {
    const [p1] = await listPlans(db, me);
    for (const t of ["a", "b", "c"]) expect(await addObjective(db, me, { id: id(), title: t, quarter: Q })).toEqual({ ok: true });
    expect(await addObjective(db, me, { id: id(), title: "d", quarter: Q })).toEqual({ ok: false, error: "no_room" });
    expect((await listObjectives(db, me)).every((o) => o.planId === p1.id)).toBe(true);
  });

  it("can be finished, dropped, and reactivated only while there is room", async () => {
    const ids = [id(), id(), id()];
    for (const oid of ids) await addObjective(db, me, { id: oid, title: oid, quarter: Q });
    await setObjectiveStatus(db, me, ids[0], "done");
    await addObjective(db, me, { id: id(), title: "fourth", quarter: Q });
    expect(await setObjectiveStatus(db, me, ids[0], "active")).toEqual({ ok: false, error: "no_room" });
    await setObjectiveStatus(db, me, ids[1], "dropped");
    expect(await setObjectiveStatus(db, me, ids[0], "active")).toEqual({ ok: true });
  });
});

describe("switching the Active Plan", () => {
  it("folds open Prototypes into a new Objective, in one go", async () => {
    const p2 = (await listPlans(db, me))[1];
    const taskId = id();
    await createTask(db, me, { id: taskId, title: "Try a weekend market stall", choice: { kind: "prototype", planId: p2.id } });
    const c = ctx();
    expect(await setActivePlan(db, me, p2.id, { fold: "Open the studio" }, c)).toEqual({ ok: true });

    expect((await listPlans(db, me)).map((p) => p.isActive)).toEqual([false, true, false]);
    expect((await listObjectives(db, me)).find((o) => o.id === c.newObjectiveId)).toMatchObject({ planId: p2.id, title: "Open the studio" });
    expect((await listTasks(db, me, c.now)).find((t) => t.id === taskId)).toMatchObject({ kind: "objective", objectiveId: c.newObjectiveId });
  });

  it("closes them when asked, and moves on to another plan later", async () => {
    const [p1, p2, p3] = await listPlans(db, me);
    const taskId = id();
    await createTask(db, me, { id: taskId, title: "Call a teacher", choice: { kind: "prototype", planId: p3.id } });
    await setActivePlan(db, me, p1.id, null, ctx());
    await setActivePlan(db, me, p3.id, "close", ctx());
    expect((await listPlans(db, me)).map((p) => p.isActive)).toEqual([false, false, true]);
    expect(await listTasks(db, me, new Date().toISOString())).toHaveLength(0);
    expect(p2.isActive).toBe(false);
  });

  it("refuses without a resolution when Prototypes are open", async () => {
    const p2 = (await listPlans(db, me))[1];
    await createTask(db, me, { id: id(), title: "x", choice: { kind: "prototype", planId: p2.id } });
    expect(await setActivePlan(db, me, p2.id, null, ctx())).toEqual({ ok: false, error: "resolution_required" });
    expect((await listPlans(db, me)).some((p) => p.isActive)).toBe(false);
  });
});
