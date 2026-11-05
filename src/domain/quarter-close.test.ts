import { describe, expect, it } from "vitest";
import { leftovers, settleLeftover } from "./quarter-close";
import type { Objective, Task } from "./types";

const objective = (id: string, quarter: string, status: Objective["status"] = "active"): Objective => ({ id, planId: "p1", title: id, quarter, status });
const task = (id: string, objectiveId: string, v: Partial<Task> = {}): Task => ({
  id,
  kind: "objective",
  objectiveId,
  prototypePlanId: null,
  title: id,
  dueDate: null,
  top3Date: null,
  doneAt: null,
  closedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...v,
});
// 1 January: Q4's leftovers meet the new quarter.
const ctx = { quarter: "2027-Q1", now: "2027-01-01T02:00:00.000Z", newObjectiveId: "copy" };
const world = () => ({
  objectives: [objective("beta", "2026-Q4"), objective("old-done", "2026-Q4", "done"), objective("fresh", "2027-Q1"), objective("q3", "2026-Q3")],
  tasks: [task("open", "beta"), task("finished", "beta", { doneAt: "2026-12-20T00:00:00.000Z" }), task("let-go", "beta", { closedAt: "2026-12-21T00:00:00.000Z" })],
});

describe("leftovers", () => {
  it("are the still-active Objectives of any earlier quarter", () => {
    expect(leftovers(world().objectives, "2027-Q1").map((o) => o.id)).toEqual(["beta", "q3"]);
  });
  it("are none in the middle of a quarter", () => {
    expect(leftovers([objective("now", "2026-Q4")], "2026-Q4")).toEqual([]);
  });
});

describe("settleLeftover", () => {
  it("Done ends the Objective and closes its open tasks", () => {
    const r = settleLeftover(world(), "beta", "done", ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "beta")?.status).toBe("done");
    expect(r.world.tasks.find((t) => t.id === "open")?.closedAt).toBe(ctx.now);
    expect(r.world.tasks.find((t) => t.id === "finished")?.closedAt).toBeNull();
  });

  it("Drop ends it and closes its open tasks", () => {
    const r = settleLeftover(world(), "beta", "drop", ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "beta")?.status).toBe("dropped");
    expect(r.world.tasks.find((t) => t.id === "open")?.closedAt).toBe(ctx.now);
  });

  it("Carry forward copies it into the new quarter and moves only its open tasks", () => {
    const r = settleLeftover(world(), "beta", "carry", ctx);
    if (!r.ok) throw new Error(r.error);
    expect(r.world.objectives.find((o) => o.id === "beta")?.status).toBe("carried");
    expect(r.world.objectives.find((o) => o.id === "copy")).toEqual({ id: "copy", planId: "p1", title: "beta", quarter: "2027-Q1", status: "active" });
    expect(r.world.tasks.find((t) => t.id === "open")).toMatchObject({ objectiveId: "copy", closedAt: null });
    // Last quarter's history stays with last quarter's Objective.
    expect(r.world.tasks.find((t) => t.id === "finished")?.objectiveId).toBe("beta");
    expect(r.world.tasks.find((t) => t.id === "let-go")?.objectiveId).toBe("beta");
  });

  it("can't carry forward into a new quarter that already has three", () => {
    const w = world();
    w.objectives.push(objective("f2", "2027-Q1"), objective("f3", "2027-Q1"));
    expect(settleLeftover(w, "beta", "carry", ctx)).toEqual({ ok: false, error: "no_room" });
    expect(settleLeftover(w, "beta", "drop", ctx).ok).toBe(true);
  });

  it("only settles leftovers", () => {
    expect(settleLeftover(world(), "fresh", "drop", ctx)).toEqual({ ok: false, error: "objective_not_found" });
    expect(settleLeftover(world(), "old-done", "drop", ctx)).toEqual({ ok: false, error: "objective_not_found" });
    expect(settleLeftover(world(), "nope", "drop", ctx)).toEqual({ ok: false, error: "objective_not_found" });
  });
});
