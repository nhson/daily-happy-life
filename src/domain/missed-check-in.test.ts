import { describe, expect, it } from "vitest";
import { missedCheckIn } from "./missed-check-in";

const today = "2026-11-05";
const closed = { closedAt: "2026-11-04T14:00:00Z" };

describe("missedCheckIn", () => {
  it("offers yesterday when it was never closed", () => {
    expect(missedCheckIn({ logs: { "2026-11-04": { closedAt: null } }, today, setupDate: "2026-11-01" })).toBe("2026-11-04");
    // A day the app wasn't even opened counts as not closed.
    expect(missedCheckIn({ logs: {}, today, setupDate: "2026-11-01" })).toBe("2026-11-04");
  });

  it("offers nothing when yesterday was closed", () => {
    expect(missedCheckIn({ logs: { "2026-11-04": closed }, today, setupDate: "2026-11-01" })).toBeNull();
  });

  it("only ever looks at yesterday, never further back", () => {
    expect(missedCheckIn({ logs: { "2026-11-04": closed, "2026-11-03": { closedAt: null } }, today, setupDate: "2026-11-01" })).toBeNull();
  });

  it("offers nothing before there was a yesterday to close", () => {
    expect(missedCheckIn({ logs: {}, today, setupDate: today })).toBeNull();
    expect(missedCheckIn({ logs: {}, today, setupDate: null })).toBeNull();
    // Setup day itself can be closed the morning after.
    expect(missedCheckIn({ logs: {}, today, setupDate: "2026-11-04" })).toBe("2026-11-04");
  });
});
