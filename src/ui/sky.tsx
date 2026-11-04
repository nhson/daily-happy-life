"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { skyAt, type Sky } from "@/domain/sky";
import { useClock } from "./clock";

interface SkyState {
  sky: Sky;
  minutes: number;
  /** Force the sky to a time of day (first-run sunrise, day-closed sunset). null = follow the clock. */
  setOverride: (minutes: number | null) => void;
  /** Brief brightening — all Top 3 done. */
  celebrate: () => void;
}

const SkyContext = createContext<SkyState | null>(null);

export function SkyProvider({
  theme,
  settled = false,
  children,
}: {
  theme: "sky" | "light" | "dark";
  /** The day is closed: an evening sky settles into night. */
  settled?: boolean;
  children: ReactNode;
}) {
  const { now } = useClock();
  const [override, setOverride] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);

  const clockMinutes = now.getHours() * 60 + now.getMinutes();
  const followed = settled && clockMinutes >= 12 * 60 && clockMinutes < 21 * 60 + 30 ? 21 * 60 + 30 : clockMinutes;
  const minutes = override ?? (theme === "light" ? 720 : theme === "dark" ? 1350 : followed);
  const sky = useMemo(() => skyAt(minutes), [minutes]);

  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--sky-top", sky.top);
    el.style.setProperty("--sky-mid", sky.mid);
    el.style.setProperty("--sky-bottom", sky.bottom);
    el.dataset.ink = sky.ink;
    el.dataset.phase = sky.phase;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sky.top);
  }, [sky]);

  useEffect(() => {
    try {
      localStorage.setItem("dhl:theme", theme);
    } catch {}
  }, [theme]);

  const celebrate = useCallback(() => setPulse((p) => p + 1), []);

  return (
    <SkyContext value={{ sky, minutes, setOverride, celebrate }}>
      <SkyBackdrop sky={sky} minutes={minutes} pulse={pulse} />
      {children}
    </SkyContext>
  );
}

export function useSky(): SkyState {
  const s = useContext(SkyContext);
  if (!s) throw new Error("useSky outside SkyProvider");
  return s;
}

// ── Backdrop ────────────────────────────────────────────────

function seeded(n: number) {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STARS = (() => {
  const r = seeded(7);
  return Array.from({ length: 64 }, () => ({ x: r() * 100, y: r() * 62, s: 0.6 + r() * 1.6, d: r() * 4 }));
})();

/** Layered ridgelines with contour hatching — the topographic texture. */
const RIDGES = (() => {
  const r = seeded(42);
  return [0, 1, 2, 3].map((layer) => {
    const base = 120 + layer * 34;
    const amp = 46 - layer * 8;
    const f1 = 0.004 + r() * 0.003;
    const f2 = 0.011 + r() * 0.006;
    const p1 = r() * 6;
    const p2 = r() * 6;
    const y = (x: number) => base - amp * (0.6 * Math.sin(x * f1 + p1) + 0.4 * Math.sin(x * f2 + p2));
    const pts: string[] = [];
    for (let x = 0; x <= 1440; x += 24) pts.push(`${x},${y(x).toFixed(1)}`);
    const ridge = `M${pts.join(" L")}`;
    const contours = [10, 22, 36].map((off) => {
      const c: string[] = [];
      for (let x = 0; x <= 1440; x += 24) c.push(`${x},${(y(x) + off * (1 - layer * 0.15)).toFixed(1)}`);
      return `M${c.join(" L")}`;
    });
    return { fill: `${ridge} L1440,320 L0,320 Z`, ridge, contours, layer };
  });
})();

function SkyBackdrop({ sky, minutes, pulse }: { sky: Sky; minutes: number; pulse: number }) {
  const reduce = useReducedMotion();
  // Sun travels an arc from 05:30 to 19:30.
  const p = (minutes - 330) / 840;
  const sunUp = p > -0.02 && p < 1.02;
  const sunX = 8 + 84 * Math.min(1, Math.max(0, p));
  const sunY = 70 - Math.sin(Math.PI * Math.min(1, Math.max(0, p))) * 52;
  const warm = 1 - Math.sin(Math.PI * Math.min(1, Math.max(0, p))); // warmer near horizon
  const night = sky.phase === "night" || (sky.phase === "dusk" && minutes > 19 * 60 + 40) || minutes < 5 * 60 + 20;
  const starOpacity = Math.max(0, 1 - sky.light * 2.4);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-bottom) 100%)" }}
      />

      {/* Stars */}
      <div className="absolute inset-0 transition-opacity duration-[2400ms]" style={{ opacity: starOpacity }}>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              opacity: 0.35 + (i % 5) * 0.12,
              animation: reduce ? undefined : `twinkle ${3 + s.d}s ease-in-out ${s.d}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Sun */}
      {sunUp && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[2400ms] ease-out"
          style={{ left: `${sunX}%`, top: `${sunY}%` }}
        >
          <div
            className="size-[46vmin] rounded-full opacity-70 blur-2xl"
            style={{
              background: `radial-gradient(circle, rgb(255 ${Math.round(236 - warm * 70)} ${Math.round(190 - warm * 110)} / ${0.55 + warm * 0.25}) 0%, transparent 62%)`,
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 size-[9vmin] max-h-24 max-w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: `radial-gradient(circle at 40% 38%, #fffaf0, rgb(255 ${Math.round(226 - warm * 60)} ${Math.round(170 - warm * 90)}))`,
              boxShadow: `0 0 60px 12px rgb(255 ${Math.round(220 - warm * 70)} ${Math.round(160 - warm * 90)} / .55)`,
            }}
          />
        </div>
      )}

      {/* Moon */}
      <div
        className="absolute right-[14%] top-[13%] size-[7vmin] max-h-16 max-w-16 rounded-full transition-opacity duration-[2400ms] lg:left-[3.5%] lg:right-auto lg:top-[16%]"
        style={{
          opacity: night ? 0.9 : 0,
          background: "radial-gradient(circle at 35% 35%, #fbf8ef, #d9d6cc 70%)",
          boxShadow: "0 0 40px 8px rgb(220 225 255 / .18), inset -8px -6px 0 0 rgb(0 0 0 / .08)",
        }}
      />

      {/* Ridges + contour lines */}
      <svg className="absolute inset-x-0 bottom-0 h-[42vh] w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
        {RIDGES.map((r) => (
          <g key={r.layer}>
            <path d={r.fill} fill="var(--sky-top)" opacity={0.1 + r.layer * 0.07} />
            <path d={r.ridge} fill="none" stroke="var(--ink)" strokeOpacity={0.1} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {r.contours.map((c, i) => (
              <path key={i} d={c} fill="none" stroke="var(--ink)" strokeOpacity={0.045} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        ))}
      </svg>

      {/* Celebration: the sky brightens briefly */}
      <AnimatePresence>
        {pulse > 0 && (
          <motion.div
            key={pulse}
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 30%, rgb(255 236 190 / .55), transparent 65%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: reduce ? 0.6 : 2.6, times: [0, 0.3, 1], ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
      <style>{`@keyframes twinkle{0%,100%{opacity:.25}50%{opacity:.95}}`}</style>
    </div>
  );
}
