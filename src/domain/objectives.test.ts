import { describe, expect, it } from "vitest";
import { MAX_ACTIVE_OBJECTIVES, objectiveRoom } from "./objectives";

const o = (status: "active" | "done" | "dropped", quarter = "2026-Q4") => ({ status, quarter });

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
