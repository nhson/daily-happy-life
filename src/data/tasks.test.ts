import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { addObjective, ensurePlans, listPlans, setActivePlan } from "./plans";
import { iso } from "./rows";
import { closeTask, createTask, deleteTask, editTask, listTasks, replaceTop3, setDone, setTop3 } from "./tasks";
import { ensureUser, type Db } from "./users";

let db: Db;
let me: string;
let other: string;
let objectiveId: string;
let plan2: string;
const id = () => crypto.randomUUID();
const longAgo = "2000-01-01T00:00:00.000Z";

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  other = (await ensureUser(db, "user_other", "UTC")).id;
  await ensurePlans(db, me);
  await ensurePlans(db, other);
  objectiveId = id();
  await addObjective(db, me, { id: objectiveId, title: "Ship the beta", quarter: "2026-Q4" });
  plan2 = (await listPlans(db, me)).find((p) => p.slot === 2)!.id;
});

const add = (title: string, choice: Parameters<typeof createTask>[2]["choice"] = { kind: "maintenance" }) => {
  const taskId = id();
  return createTask(db, me, { id: taskId, title, choice }).then((r) => ({ ...r, taskId }));
};

describe("createTask", () => {
  it("saves each kind with its one why", async () => {
    expect((await add("Groceries")).ok).toBe(true);
    expect((await add("Write the landing page", { kind: "objective", objectiveId })).ok).toBe(true);
    expect((await add("Coffee with a studio owner", { kind: "prototype", planId: plan2 })).ok).toBe(true);
    const list = await listTasks(db, me, longAgo);
    expect(list.map((t) => t.kind).sort()).toEqual(["maintenance", "objective", "prototype"]);
  });

  it("refuses a why that isn't the user's own", async () => {
    const theirs = (await listPlans(db, other))[1].id;
    expect(await add("x", { kind: "prototype", planId: theirs })).toMatchObject({ ok: false, error: "plan_not_found" });
    expect(await add("x", { kind: "objective", objectiveId: id() })).toMatchObject({ ok: false, error: "objective_not_found" });
  });

  it("refuses a Prototype of the Active Plan, and an empty title", async () => {
    await setActivePlan(db, me, plan2, { objectives: {}, prototypes: null }, { quarter: "2026-Q4", now: new Date().toISOString(), newObjectiveId: id() });
    expect(await add("x", { kind: "prototype", planId: plan2 })).toMatchObject({ ok: false, error: "prototype_on_active_plan" });
    expect(await add("   ")).toMatchObject({ ok: false, error: "empty_title" });
  });

  it("is a no-op when the same request arrives twice", async () => {
    const taskId = id();
    await createTask(db, me, { id: taskId, title: "Once", choice: { kind: "maintenance" } });
    await createTask(db, me, { id: taskId, title: "Once", choice: { kind: "maintenance" } });
    expect(await listTasks(db, me, longAgo)).toHaveLength(1);
  });
});

describe("the database itself", () => {
  it("rejects a kind/link mismatch even if the app code is wrong", async () => {
    await expect(db.insert(schema.tasks).values({ userId: me, title: "x", kind: "objective" })).rejects.toThrow();
  });
});

describe("editing", () => {
  it("changes title, why and due date", async () => {
    const { taskId } = await add("Taxes");
    expect(await editTask(db, me, taskId, { title: "File taxes", choice: { kind: "objective", objectiveId }, dueDate: "2026-11-20" })).toEqual({ ok: true });
    const [t] = await listTasks(db, me, longAgo);
    expect(t).toMatchObject({ title: "File taxes", kind: "objective", objectiveId, dueDate: "2026-11-20" });
    await editTask(db, me, taskId, { dueDate: null });
    expect((await listTasks(db, me, longAgo))[0].dueDate).toBeNull();
  });

  it("can't touch another user's task", async () => {
    const theirs = id();
    await createTask(db, other, { id: theirs, title: "Theirs", choice: { kind: "maintenance" } });
    expect(await editTask(db, me, theirs, { title: "Mine now" })).toEqual({ ok: false, error: "not_found" });
    expect(await deleteTask(db, me, theirs)).toEqual({ ok: false, error: "not_found" });
    expect(await setDone(db, me, theirs, new Date().toISOString())).toEqual({ ok: false, error: "not_found" });
  });
});

describe("ending a task", () => {
  it("Done keeps it for a week of history; un-done brings it back", async () => {
    const { taskId } = await add("Run");
    const at = new Date().toISOString();
    await setDone(db, me, taskId, at);
    const [t] = await listTasks(db, me, "2026-01-01T00:00:00.000Z");
    expect(t.doneAt).toBe(at);
    expect(await listTasks(db, me, new Date(Date.now() + 60_000).toISOString())).toHaveLength(0);
    await setDone(db, me, taskId, null);
    expect((await listTasks(db, me, longAgo))[0].doneAt).toBeNull();
  });

  it("Closed leaves the open list but stays in the database", async () => {
    const { taskId } = await add("Learn the cello");
    await closeTask(db, me, taskId, new Date().toISOString());
    expect(await listTasks(db, me, longAgo)).toHaveLength(0);
    expect(await db.$count(schema.tasks)).toBe(1);
  });

  it("Delete leaves no trace", async () => {
    const { taskId } = await add("Typo tsak");
    await deleteTask(db, me, taskId);
    expect(await db.$count(schema.tasks)).toBe(0);
  });
});

describe("Top 3", () => {
  it("holds three tasks a day at most", async () => {
    const ids = [];
    for (const n of [1, 2, 3, 4]) ids.push((await add(`t${n}`)).taskId);
    for (const t of ids.slice(0, 3)) expect(await setTop3(db, me, t, "2026-11-05")).toEqual({ ok: true });
    expect(await setTop3(db, me, ids[3], "2026-11-05")).toEqual({ ok: false, error: "top3_full" });
    // Another day has its own three.
    expect(await setTop3(db, me, ids[3], "2026-11-06")).toEqual({ ok: true });
    await setTop3(db, me, ids[0], null);
    expect(await setTop3(db, me, ids[3], "2026-11-05")).toEqual({ ok: true });
  });
});

describe("replaceTop3", () => {
  it("makes the morning's picks the whole Top 3 of the day", async () => {
    const ids = [];
    for (const n of [1, 2, 3, 4]) ids.push((await add(`t${n}`)).taskId);
    await setTop3(db, me, ids[0], "2026-11-05");
    expect(await replaceTop3(db, me, "2026-11-05", [ids[1], ids[2], ids[3]])).toEqual({ ok: true });
    const top = (await listTasks(db, me, longAgo)).filter((t) => t.top3Date === "2026-11-05").map((t) => t.id);
    expect(top.sort()).toEqual([ids[1], ids[2], ids[3]].sort());
  });

  it("refuses four picks, or a task that isn't the user's", async () => {
    expect(await replaceTop3(db, me, "2026-11-05", [id(), id(), id(), id()])).toEqual({ ok: false, error: "top3_full" });
    expect(await replaceTop3(db, me, "2026-11-05", [id()])).toEqual({ ok: false, error: "not_found" });
  });
});

describe("iso", () => {
  it("reads Postgres timestamps as ISO strings", () => {
    expect(iso("2026-11-05 00:33:59.47+00")).toBe("2026-11-05T00:33:59.470Z");
    expect(iso("2026-11-05 07:33:59+07")).toBe("2026-11-05T00:33:59.000Z");
    expect(iso(null)).toBeNull();
  });
});
