import { describe, expect, it } from "vitest";
import { INK, luminance, skyAt, SKY_KEYS } from "./sky";

describe("skyAt", () => {
  it("names the phase from local minutes", () => {
    expect(skyAt(2 * 60).phase).toBe("night");
    expect(skyAt(6 * 60).phase).toBe("dawn");
    expect(skyAt(12 * 60).phase).toBe("day");
    expect(skyAt(18 * 60 + 30).phase).toBe("dusk");
    expect(skyAt(22 * 60).phase).toBe("night");
  });

  it("uses light ink by day and dark-surface ink at dusk and night", () => {
    expect(skyAt(12 * 60).ink).toBe("dark");
    expect(skyAt(6 * 60 + 30).ink).toBe("dark");
    expect(skyAt(19 * 60).ink).toBe("light");
    expect(skyAt(23 * 60).ink).toBe("light");
  });

  it("returns exactly the keyframe colours where no veil is needed (deep night)", () => {
    const a = skyAt(SKY_KEYS[0].at);
    expect(a.top).toBe(SKY_KEYS[0].top);
    expect(a.bottom).toBe(SKY_KEYS[0].bottom);
  });

  it("veils dawn only as much as contrast needs — the sky stays recognisably dawn", () => {
    const dawn = skyAt(6 * 60);
    expect(dawn.bottom).not.toBe(dawn.top);
    expect(luminance(dawn.bottom)).toBeGreaterThan(luminance(dawn.top) * 0.9);
  });

  it("interpolates smoothly between keyframes and wraps past midnight", () => {
    const before = skyAt(23 * 60 + 59);
    const after = skyAt(0);
    expect(before.top).toMatch(/^#[0-9a-f]{6}$/);
    expect(after.top).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is a pure function of minutes (same input, same output)", () => {
    expect(skyAt(500)).toEqual(skyAt(500));
  });
});

describe("contrast (WCAG AA on every part of the sky, all day)", () => {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const over = (fg: string, a: number, bg: string) => {
    const f = rgb(fg);
    const b = rgb(bg);
    return "#" + f.map((c, i) => Math.round(c * a + b[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it.each([
    ["ink", "primary", 4.5],
    ["ink2", "secondary", 4.5],
    ["ink3", "tertiary", 3],
  ] as const)("%s (%s text) ≥ %s:1", (key, _label, min) => {
    for (let m = 0; m < 1440; m += 15) {
      const s = skyAt(m);
      const t = INK[s.ink];
      for (const part of ["top", "mid", "bottom"] as const) {
        const r = ratio(over(t.color, t[key], s[part]), s[part]);
        expect(r, `${key} at ${Math.floor(m / 60)}:${m % 60} on ${part}`).toBeGreaterThanOrEqual(min);
      }
    }
  });
});
