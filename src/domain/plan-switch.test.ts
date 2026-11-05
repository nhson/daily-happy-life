import { describe, expect, it } from "vitest";
import { switchPlan, type World } from "./plan-switch";
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

describe("switchPlan", () => {
  it("makes exactly the chosen plan active", () => {
    const r = switchPlan(world(), "p2", "close", ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.plans.map((p) => p.isActive)).toEqual([false, true, false]);
  });

  it("folds the new plan's open Prototypes into a new Objective under it", () => {
    const r = switchPlan(world(), "p2", { fold: "Try the studio for real" }, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.at(-1)).toEqual({ id: "o-new", planId: "p2", title: "Try the studio for real", quarter: "2026-Q4", status: "active" });
    expect(r.world.tasks.find((t) => t.id === "proto-open")).toMatchObject({ kind: "objective", objectiveId: "o-new", prototypePlanId: null });
    // Finished prototypes stay history; other plans' prototypes are untouched.
    expect(r.world.tasks.find((t) => t.id === "proto-done")).toMatchObject({ kind: "prototype", prototypePlanId: "p2" });
    expect(r.world.tasks.find((t) => t.id === "other-proto")).toMatchObject({ kind: "prototype", prototypePlanId: "p3" });
  });

  it("folds into an existing active Objective, which moves under the new plan", () => {
    const r = switchPlan(world(), "p2", { into: "o1" }, ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "o1")?.planId).toBe("p2");
    expect(r.world.tasks.find((t) => t.id === "proto-open")).toMatchObject({ kind: "objective", objectiveId: "o1" });
  });

  it("closes the open Prototypes when asked", () => {
    const r = switchPlan(world(), "p2", "close", ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.tasks.find((t) => t.id === "proto-open")?.closedAt).toBe(ctx.now);
    expect(r.world.objectives).toHaveLength(1);
  });

  it("needs a resolution when there are open Prototypes, and none otherwise", () => {
    expect(switchPlan(world(), "p2", null, ctx)).toEqual({ ok: false, error: "resolution_required" });
    expect(switchPlan(world(), "p3", null, ctx).ok).toBe(false);
    const empty = { ...world(), tasks: [] };
    expect(switchPlan(empty, "p3", null, ctx).ok).toBe(true);
  });

  it("won't fold into a new Objective when three are already active", () => {
    const full = world([objective("o1"), objective("o2"), objective("o3")]);
    expect(switchPlan(full, "p2", { fold: "x" }, ctx)).toEqual({ ok: false, error: "no_room" });
  });

  it("refuses an unknown plan", () => {
    expect(switchPlan(world(), "nope", "close", ctx)).toEqual({ ok: false, error: "plan_not_found" });
  });
});
