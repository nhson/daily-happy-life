import { describe, expect, it } from "vitest";
import { checkFold, MAX_ACTIVE_OBJECTIVES, objectiveRoom } from "./objectives";

const o = (status: "active" | "done" | "dropped", quarter = "2026-Q4", id = "x") => ({ id, status, quarter });

describe("objectiveRoom", () => {
  it("allows at most three active Objectives a quarter", () => {
    expect(MAX_ACTIVE_OBJECTIVES).toBe(3);
    expect(objectiveRoom([], "2026-Q4")).toBe(3);
    expect(objectiveRoom([o("active"), o("active")], "2026-Q4")).toBe(1);
    expect(objectiveRoom([o("active"), o("active"), o("active")], "2026-Q4")).toBe(0);
  });
  it("counts only active Objectives of this quarter", () => {
    expect(objectiveRoom([o("done"), o("dropped"), o("active", "2026-Q3"), o("active")], "2026-Q4")).toBe(2);
  });
  it("never goes below zero when older data has more", () => {
    expect(objectiveRoom([o("active"), o("active"), o("active"), o("active"), o("active")], "2026-Q4")).toBe(0);
  });
});

describe("checkFold (Active Plan switch with open Prototypes)", () => {
  const full = [o("active", "2026-Q4", "a"), o("active", "2026-Q4", "b"), o("active", "2026-Q4", "c")];
  it("folds into a new Objective while there is room", () => {
    expect(checkFold({ fold: "Studio" }, [o("active", "2026-Q4", "a")], "2026-Q4")).toBe("ok");
  });
  it("refuses a new Objective when three are already active", () => {
    expect(checkFold({ fold: "Studio" }, full, "2026-Q4")).toBe("no_room");
  });
  it("can always fold into an Objective that is active this quarter", () => {
    expect(checkFold({ into: "b" }, full, "2026-Q4")).toBe("ok");
  });
  it("refuses to fold into one that is done, dropped, past or missing", () => {
    const mixed = [o("done", "2026-Q4", "d"), o("active", "2026-Q3", "p")];
    expect(checkFold({ into: "d" }, mixed, "2026-Q4")).toBe("objective_not_found");
    expect(checkFold({ into: "p" }, mixed, "2026-Q4")).toBe("objective_not_found");
    expect(checkFold({ into: "zzz" }, mixed, "2026-Q4")).toBe("objective_not_found");
  });
  it("closing them always works", () => {
    expect(checkFold("close", full, "2026-Q4")).toBe("ok");
  });
});
