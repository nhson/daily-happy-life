import { describe, expect, it } from "vitest";
import { dueStatus, promotionEffects, validateTaskLink } from "./task-rules";
import type { Task } from "./types";

const plans = [
  { id: "p1", isActive: true },
  { id: "p2", isActive: false },
];
const objectives = [{ id: "o1", status: "active" as const }];

describe("validateTaskLink", () => {
  it("accepts an objective task linked to an active objective", () => {
    expect(validateTaskLink({ kind: "objective", objectiveId: "o1", prototypePlanId: null }, { plans, objectives })).toEqual({ ok: true });
  });

  it("rejects an objective task without an objective", () => {
    expect(validateTaskLink({ kind: "objective", objectiveId: null, prototypePlanId: null }, { plans, objectives })).toEqual({ ok: false, error: "objective_required" });
  });

  it("rejects an objective task pointing at an unknown objective", () => {
    expect(validateTaskLink({ kind: "objective", objectiveId: "nope", prototypePlanId: null }, { plans, objectives })).toEqual({ ok: false, error: "objective_not_found" });
  });

  it("rejects an objective task that also has a prototype plan", () => {
    expect(validateTaskLink({ kind: "objective", objectiveId: "o1", prototypePlanId: "p2" }, { plans, objectives })).toEqual({ ok: false, error: "extra_link" });
  });

  it("accepts maintenance with no links and rejects maintenance with any link", () => {
    expect(validateTaskLink({ kind: "maintenance", objectiveId: null, prototypePlanId: null }, { plans, objectives })).toEqual({ ok: true });
    expect(validateTaskLink({ kind: "maintenance", objectiveId: "o1", prototypePlanId: null }, { plans, objectives })).toEqual({ ok: false, error: "extra_link" });
  });

  it("accepts a prototype on a non-active plan", () => {
    expect(validateTaskLink({ kind: "prototype", objectiveId: null, prototypePlanId: "p2" }, { plans, objectives })).toEqual({ ok: true });
  });

  it("rejects a prototype on the active plan", () => {
    expect(validateTaskLink({ kind: "prototype", objectiveId: null, prototypePlanId: "p1" }, { plans, objectives })).toEqual({ ok: false, error: "prototype_on_active_plan" });
  });

  it("rejects a prototype without a plan", () => {
    expect(validateTaskLink({ kind: "prototype", objectiveId: null, prototypePlanId: null }, { plans, objectives })).toEqual({ ok: false, error: "plan_required" });
  });
});

describe("promotionEffects", () => {
  const base: Omit<Task, "id" | "kind" | "prototypePlanId"> = {
    objectiveId: null, title: "t", dueDate: null, top3Date: null, doneAt: null, closedAt: null, createdAt: "2026-11-01T00:00:00Z",
  };
  const tasks: Task[] = [
    { ...base, id: "a", kind: "prototype", prototypePlanId: "p2" },
    { ...base, id: "b", kind: "prototype", prototypePlanId: "p2", doneAt: "2026-11-02T00:00:00Z" },
    { ...base, id: "c", kind: "prototype", prototypePlanId: "p3" },
    { ...base, id: "d", kind: "maintenance", prototypePlanId: null },
  ];

  it("lists only open prototypes of the plan being promoted", () => {
    expect(promotionEffects("p2", tasks).map((t) => t.id)).toEqual(["a"]);
  });

  it("is empty when the plan has no open prototypes", () => {
    expect(promotionEffects("p9", tasks)).toEqual([]);
  });
});

describe("dueStatus", () => {
  const today = "2026-11-05";
  const open = { doneAt: null, closedAt: null };

  it("is overdue before today, due today on the day, upcoming after", () => {
    expect(dueStatus({ ...open, dueDate: "2026-11-04" }, today)).toBe("overdue");
    expect(dueStatus({ ...open, dueDate: "2026-11-05" }, today)).toBe("today");
    expect(dueStatus({ ...open, dueDate: "2026-11-20" }, today)).toBe("upcoming");
  });

  it("is nothing without a due date, or once the task has ended", () => {
    expect(dueStatus({ ...open, dueDate: null }, today)).toBeNull();
    expect(dueStatus({ dueDate: "2026-11-01", doneAt: "2026-11-02T00:00:00Z", closedAt: null }, today)).toBeNull();
    expect(dueStatus({ dueDate: "2026-11-01", doneAt: null, closedAt: "2026-11-02T00:00:00Z" }, today)).toBeNull();
  });
});
