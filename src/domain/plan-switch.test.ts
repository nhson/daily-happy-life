import { describe, expect, it } from "vitest";
import { finishObjective, switchPlan, type Settle, type World } from "./plan-switch";
import type { Objective, OdysseyPlan, Task } from "./types";

const plan = (slot: 1 | 2 | 3, isActive = false): OdysseyPlan => ({
  id: `p${slot}`,
  slot,
  title: `Plan ${slot}`,
  questions: "",
  gauges: { resources: null, likability: null, confidence: null, coherence: null },
  isActive,
});
const objective = (id: string, planId = "p1", status: Objective["status"] = "active"): Objective => ({
  id,
  planId,
  title: id,
  quarter: "2026-Q4",
  status,
});
const task = (id: string, v: Partial<Task>): Task => ({
  id,
  kind: "maintenance",
  objectiveId: null,
  prototypePlanId: null,
  title: id,
  dueDate: null,
  top3Date: null,
  doneAt: null,
  closedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  ...v,
});

const world = (objectives: Objective[] = [objective("o1")]): World => ({
  plans: [plan(1, true), plan(2), plan(3)],
  objectives,
  tasks: [
    task("proto-open", { kind: "prototype", prototypePlanId: "p2" }),
    task("proto-done", { kind: "prototype", prototypePlanId: "p2", doneAt: "2026-11-02T00:00:00.000Z" }),
    task("other-proto", { kind: "prototype", prototypePlanId: "p3" }),
    task("chores", {}),
  ],
});
const ctx = { quarter: "2026-Q4", now: "2026-11-05T01:00:00.000Z", newObjectiveId: "o-new" };
/** The old plan's Objectives are kept unless a test says otherwise. */
const s = (prototypes: Settle["prototypes"], objectives: Settle["objectives"] = { o1: "keep" }): Settle => ({ prototypes, objectives });

describe("switchPlan", () => {
  it("makes exactly the chosen plan active", () => {
    const r = switchPlan(world(), "p2", s("close"), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.plans.map((p) => p.isActive)).toEqual([false, true, false]);
  });

  it("folds the new plan's open Prototypes into a new Objective under it", () => {
    const r = switchPlan(world(), "p2", s({ fold: "Try the studio for real" }), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.at(-1)).toEqual({ id: "o-new", planId: "p2", title: "Try the studio for real", quarter: "2026-Q4", status: "active" });
    expect(r.world.tasks.find((t) => t.id === "proto-open")).toMatchObject({ kind: "objective", objectiveId: "o-new", prototypePlanId: null });
    // Finished prototypes stay history; other plans' prototypes are untouched.
    expect(r.world.tasks.find((t) => t.id === "proto-done")).toMatchObject({ kind: "prototype", prototypePlanId: "p2" });
    expect(r.world.tasks.find((t) => t.id === "other-proto")).toMatchObject({ kind: "prototype", prototypePlanId: "p3" });
  });

  it("folds into an existing active Objective, which moves under the new plan", () => {
    const r = switchPlan(world(), "p2", s({ into: "o1" }), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "o1")?.planId).toBe("p2");
    expect(r.world.tasks.find((t) => t.id === "proto-open")).toMatchObject({ kind: "objective", objectiveId: "o1" });
  });

  it("closes the open Prototypes when asked", () => {
    const r = switchPlan(world(), "p2", s("close"), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.tasks.find((t) => t.id === "proto-open")?.closedAt).toBe(ctx.now);
    expect(r.world.objectives).toHaveLength(1);
  });

  it("needs a resolution when there are open Prototypes, and none otherwise", () => {
    expect(switchPlan(world(), "p2", s(null), ctx)).toEqual({ ok: false, error: "resolution_required" });
    expect(switchPlan(world(), "p3", s(null), ctx).ok).toBe(false);
    const empty = { ...world(), tasks: [] };
    expect(switchPlan(empty, "p3", s(null), ctx).ok).toBe(true);
  });

  it("won't fold into a new Objective when three are already active", () => {
    const full = world([objective("o1"), objective("o2"), objective("o3")]);
    expect(switchPlan(full, "p2", s({ fold: "x" }, { o1: "keep", o2: "keep", o3: "keep" }), ctx)).toEqual({ ok: false, error: "no_room" });
  });

  it("refuses an unknown plan", () => {
    expect(switchPlan(world(), "nope", s("close"), ctx)).toEqual({ ok: false, error: "plan_not_found" });
  });

  it("settles each still-active Objective of the old plan: Keep moves it under the new plan", () => {
    const r = switchPlan({ ...world(), tasks: [] }, "p3", s(null, { o1: "keep" }), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "o1")).toMatchObject({ planId: "p3", status: "active" });
  });

  it("Drop ends the Objective and closes its open tasks, leaving finished ones as history", () => {
    const w = {
      ...world(),
      tasks: [task("open", { kind: "objective", objectiveId: "o1" }), task("done", { kind: "objective", objectiveId: "o1", doneAt: "2026-11-02T00:00:00.000Z" })],
    };
    const r = switchPlan(w, "p3", s(null, { o1: "drop" }), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "o1")).toMatchObject({ planId: "p1", status: "dropped" });
    expect(r.world.tasks.find((t) => t.id === "open")?.closedAt).toBe(ctx.now);
    expect(r.world.tasks.find((t) => t.id === "done")?.closedAt).toBeNull();
  });

  it("needs a choice for every still-active Objective of the old plan", () => {
    const w = { ...world([objective("o1"), objective("o2"), objective("gone", "p1", "done"), objective("theirs", "p3")]), tasks: [] };
    expect(switchPlan(w, "p2", s(null, { o1: "keep" }), ctx)).toEqual({ ok: false, error: "objectives_unsettled" });
    expect(switchPlan(w, "p2", s(null, { o1: "keep", o2: "drop" }), ctx).ok).toBe(true);
  });

  it("dropping an old Objective makes room for the new one", () => {
    const full = world([objective("o1"), objective("o2"), objective("o3")]);
    const r = switchPlan(full, "p2", s({ fold: "Studio" }, { o1: "drop", o2: "keep", o3: "keep" }), ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.filter((o) => o.status === "active").map((o) => o.id)).toEqual(["o2", "o3", "o-new"]);
  });

  it("won't fold Prototypes into an Objective that is being dropped", () => {
    expect(switchPlan(world(), "p2", s({ into: "o1" }, { o1: "drop" }), ctx)).toEqual({ ok: false, error: "objective_not_found" });
  });

  it("does nothing when the plan is already active", () => {
    const w = world();
    expect(switchPlan(w, "p1", s(null, {}), ctx)).toEqual({ ok: true, world: w });
  });
});

describe("finishObjective", () => {
  const w = {
    objectives: [objective("o1"), objective("o2"), objective("old", "p1", "dropped")],
    tasks: [
      task("open", { kind: "objective", objectiveId: "o1" }),
      task("done", { kind: "objective", objectiveId: "o1", doneAt: "2026-11-02T00:00:00.000Z" }),
      task("elsewhere", { kind: "objective", objectiveId: "o2" }),
    ],
  };

  it("marks it Done and closes its open tasks by default", () => {
    const r = finishObjective(w, "o1", "close", ctx.now);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "o1")?.status).toBe("done");
    expect(r.world.tasks.find((t) => t.id === "open")?.closedAt).toBe(ctx.now);
    expect(r.world.tasks.find((t) => t.id === "done")?.closedAt).toBeNull();
    expect(r.world.tasks.find((t) => t.id === "elsewhere")?.closedAt).toBeNull();
  });

  it("or moves its open tasks to another active Objective", () => {
    const r = finishObjective(w, "o1", { move: "o2" }, ctx.now);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.tasks.find((t) => t.id === "open")).toMatchObject({ objectiveId: "o2", closedAt: null });
    // History stays with the Objective it was done for.
    expect(r.world.tasks.find((t) => t.id === "done")?.objectiveId).toBe("o1");
  });

  it("refuses to move tasks to itself, to an inactive Objective, or to finish one that isn't active", () => {
    expect(finishObjective(w, "o1", { move: "o1" }, ctx.now)).toEqual({ ok: false, error: "objective_not_found" });
    expect(finishObjective(w, "o1", { move: "old" }, ctx.now)).toEqual({ ok: false, error: "objective_not_found" });
    expect(finishObjective(w, "old", "close", ctx.now)).toEqual({ ok: false, error: "objective_not_found" });
    expect(finishObjective(w, "nope", "close", ctx.now)).toEqual({ ok: false, error: "objective_not_found" });
  });
});
