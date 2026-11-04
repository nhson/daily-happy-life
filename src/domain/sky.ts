/**
 * The living sky: a gradient that follows local time of day.
 * Colours are interpolated in OKLab between keyframes so dawn and dusk stay luminous instead of muddy.
 */

export type SkyPhase = "night" | "dawn" | "day" | "dusk";

export interface Sky {
  phase: SkyPhase;
  /** Which ink reads on this sky: "dark" text on a bright sky, "light" text on a dark one. */
  ink: "dark" | "light";
  top: string;
  mid: string;
  bottom: string;
  /** 0 (night) … 1 (full day) — drives sun height and glow. */
  light: number;
}

interface Key {
  at: number; // minutes since midnight
  top: string;
  mid: string;
  bottom: string;
}

export const SKY_KEYS: readonly Key[] = [
  { at: 0, top: "#060a18", mid: "#0d1430", bottom: "#191d40" },
  { at: 4 * 60 + 30, top: "#0a0f27", mid: "#1c2246", bottom: "#3a2e57" },
  { at: 6 * 60, top: "#2b3a6c", mid: "#b8768c", bottom: "#f0b088" },
  { at: 7 * 60 + 30, top: "#86b2df", mid: "#d6e2ef", bottom: "#fbe2c2" },
  { at: 12 * 60, top: "#6aa4dc", mid: "#b7d4ef", bottom: "#eaf2f9" },
  { at: 16 * 60 + 30, top: "#77a2d4", mid: "#c6d5e6", bottom: "#f4dfc2" },
  { at: 18 * 60 + 15, top: "#393d78", mid: "#ad5f7a", bottom: "#f0986a" },
  { at: 19 * 60 + 30, top: "#1a1e4e", mid: "#463264", bottom: "#874c69" },
  { at: 21 * 60, top: "#090e23", mid: "#131a38", bottom: "#242447" },
];

/** Text colours and the opacities of the three text levels. Mirrored in globals.css. */
export const INK = {
  dark: { color: "#0b1230", ink: 1, ink2: 0.78, ink3: 0.64 },
  light: { color: "#f6f2ea", ink: 1, ink2: 0.8, ink3: 0.66 },
} as const;

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function phaseAt(minutes: number): SkyPhase {
  if (minutes < 5 * 60) return "night";
  if (minutes < 8 * 60) return "dawn";
  if (minutes < 17 * 60 + 30) return "day";
  if (minutes < 20 * 60 + 30) return "dusk";
  return "night";
}

export function skyAt(minutes: number): Sky {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  let i = SKY_KEYS.length - 1;
  for (let k = 0; k < SKY_KEYS.length; k++) if (SKY_KEYS[k].at <= m) i = k;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[(i + 1) % SKY_KEYS.length];
  const span = ((b.at - a.at + 1440) % 1440) || 1440;
  const t = ((m - a.at + 1440) % 1440) / span;
  const raw = { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), bottom: mix(a.bottom, b.bottom, t) };
  const lum = (luminance(raw.mid) + luminance(raw.bottom)) / 2;

  // Choose the ink that needs the lightest atmospheric veil to keep every text level AA.
  const dark = veilFor("dark", raw);
  const light = veilFor("light", raw);
  const pick = dark.alpha <= light.alpha ? dark : light;
  return {
    phase: phaseAt(m),
    ink: pick.ink,
    ...pick.colors,
    light: Math.min(1, Math.max(0, (lum - 0.02) / 0.6)),
  };
}

type Parts = { top: string; mid: string; bottom: string };

/** Haze colour for each ink: pale mist behind dark text, deep dusk behind light text. */
const VEIL = { dark: "#f4f1ec", light: "#0b1033" } as const;

function passes(ink: keyof typeof INK, parts: Parts): boolean {
  const t = INK[ink];
  return (["top", "mid", "bottom"] as const).every(
    (p) => contrast(blend(t.color, t.ink2, parts[p]), parts[p]) >= 4.5 && contrast(blend(t.color, t.ink3, parts[p]), parts[p]) >= 3,
  );
}

/** Smallest veil (0–0.9) that keeps this ink readable everywhere on the gradient. */
function veilFor(ink: keyof typeof INK, raw: Parts): { ink: keyof typeof INK; alpha: number; colors: Parts } {
  for (let alpha = 0; alpha <= 0.9001; alpha += 0.02) {
    const colors = {
      top: blend(VEIL[ink], alpha, raw.top),
      mid: blend(VEIL[ink], alpha, raw.mid),
      bottom: blend(VEIL[ink], alpha, raw.bottom),
    };
    if (passes(ink, colors)) return { ink, alpha, colors };
  }
  return { ink, alpha: 1, colors: raw };
}

/** `fg` at opacity `a` over `bg`, in sRGB (how the browser composites). */
export function blend(fg: string, a: number, bg: string): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return "#" + f.map((c, i) => Math.round((c * a + b[i] * (1 - a)) * 255).toString(16).padStart(2, "0")).join("");
}

/** Sky every `step` minutes — embedded in the page so the first paint is already correct. */
export function skyTable(step = 15): [string, string, string, 0 | 1][] {
  const rows: [string, string, string, 0 | 1][] = [];
  for (let m = 0; m < 1440; m += step) {
    const s = skyAt(m);
    rows.push([s.top, s.mid, s.bottom, s.ink === "light" ? 1 : 0]);
  }
  return rows;
}

// --- colour maths (sRGB ↔ OKLab) ---

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [number, number, number];
}
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: [number, number, number]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    rgb
      .map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const x = toOklab(a);
  const y = toOklab(b);
  return fromOklab([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
