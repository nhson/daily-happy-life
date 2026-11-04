import { describe, expect, it } from "vitest";
import { compassLineFor } from "./compass-line";
import { addDays } from "./logical-day";
import { MINDSET_KEYS } from "./mindsets";

const full = {
  userId: "user_1",
  compass: { workview: "Work is how I make useful things for people I respect.", lifeview: "Life is for curiosity, family, and leaving places better." },
  activePlanTitle: "Small studio, big outdoors, slow mornings",
};

describe("compassLineFor", () => {
  it("is deterministic for the same user and date", () => {
    const a = compassLineFor({ ...full, date: "2026-11-03" });
    const b = compassLineFor({ ...full, date: "2026-11-03" });
    expect(a).toEqual(b);
  });

  it("rotates Workview → Lifeview → Plan → Mindset over four consecutive days", () => {
    const days = [0, 1, 2, 3].map((n) => compassLineFor({ ...full, date: addDays("2026-11-03", n) }).source);
    const order = ["workview", "lifeview", "plan", "mindset"];
    const start = order.indexOf(days[0]);
    expect(days).toEqual([0, 1, 2, 3].map((n) => order[(start + n) % 4]));
  });

  it("never repeats the same source on consecutive days when ≥2 sources exist", () => {
    for (let n = 0; n < 30; n++) {
      const d = addDays("2026-11-03", n);
      expect(compassLineFor({ ...full, date: d }).source).not.toBe(
        compassLineFor({ ...full, date: addDays(d, 1) }).source,
      );
    }
  });

  it("skips the plan when there is no active plan title", () => {
    const sources = new Set(
      Array.from({ length: 12 }, (_, n) =>
        compassLineFor({ ...full, activePlanTitle: null, date: addDays("2026-11-03", n) }).source,
      ),
    );
    expect(sources).toEqual(new Set(["workview", "lifeview", "mindset"]));
  });

  it("cycles through all five mindsets over time", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 40; n++) {
      const line = compassLineFor({ ...full, date: addDays("2026-11-03", n) });
      if (line.source === "mindset") seen.add(line.mindset);
    }
    expect(seen.size).toBe(MINDSET_KEYS.length);
  });

  it("falls back to mindsets when the Compass is still empty", () => {
    const line = compassLineFor({ userId: "u", compass: null, activePlanTitle: null, date: "2026-11-03" });
    // A key, not words: the screen shows it in the user's language.
    expect(line.source === "mindset" && MINDSET_KEYS.includes(line.mindset)).toBe(true);
  });

  it("offsets the rotation per user", () => {
    const users = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const sources = new Set(users.map((userId) => compassLineFor({ ...full, userId, date: "2026-11-03" }).source));
    expect(sources.size).toBeGreaterThan(1);
  });
});
