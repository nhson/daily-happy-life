import { describe, expect, it } from "vitest";
import { carryOver } from "./carry-over";
import type { Task } from "./types";

const today = "2026-11-05";
const task = (id: string, v: Partial<Task> = {}): Task => ({
  id,
  kind: "maintenance",
  objectiveId: null,
  prototypePlanId: null,
  title: id,
  dueDate: null,
  top3Date: null,
  doneAt: null,
  closedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...v,
});
const log = (date: string, top3TaskIds: string[]) => ({ date, top3TaskIds });

describe("carryOver", () => {
  it("offers yesterday's unfinished Top 3", () => {
    const tasks = [task("a"), task("b", { doneAt: "2026-11-04T10:00:00Z" }), task("c")];
    expect(carryOver([log("2026-11-04", ["a", "b", "c"])], tasks, today).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("looks back to the most recent day that had a Top 3, skipping empty days", () => {
    const logs = [log("2026-11-01", ["a"]), log("2026-11-02", ["b"]), log("2026-11-04", [])];
    expect(carryOver(logs, [task("a"), task("b")], today).map((t) => t.id)).toEqual(["b"]);
  });

  it("looks back seven days at most", () => {
    expect(carryOver([log("2026-10-28", ["a"])], [task("a")], today)).toEqual([]);
    expect(carryOver([log("2026-10-29", ["a"])], [task("a")], today).map((t) => t.id)).toEqual(["a"]);
  });

  it("never offers today's own Top 3, closed or deleted tasks", () => {
    const tasks = [task("a", { closedAt: "2026-11-04T10:00:00Z" }), task("b")];
    expect(carryOver([log(today, ["b"]), log("2026-11-04", ["a", "gone"])], tasks, today)).toEqual([]);
  });

  it("keeps the order the day had", () => {
    const tasks = [task("c"), task("a"), task("b")];
    expect(carryOver([log("2026-11-04", ["b", "c", "a"])], tasks, today).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});
