"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCopy } from "@/copy";

type Variant = "solid" | "glass" | "ghost";

export function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[transform,background-color,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-9 px-4 text-sm",
        size === "md" && "h-11 px-5 text-[15px]",
        size === "lg" && "h-14 px-7 text-base",
        variant === "solid" && "bg-solid text-solid-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)]",
        variant === "glass" && "glass text-ink",
        variant === "ghost" && "text-ink-2 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  selected,
  color,
  onClick,
  children,
  className,
  title,
}: {
  selected?: boolean;
  color?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors duration-200",
        selected ? "text-ink" : "text-ink-2 hover:text-ink",
        className,
      )}
      style={{
        background: selected ? `color-mix(in oklab, ${color ?? "var(--ink)"} 22%, var(--glass-strong))` : "var(--fill)",
        boxShadow: selected ? `inset 0 0 0 1.5px color-mix(in oklab, ${color ?? "var(--ink)"} 75%, transparent)` : "inset 0 0 0 1px var(--hairline)",
      }}
    >
      {children}
    </motion.button>
  );
}

/** Five big tappable stops, labelled only at the ends. */
export function RatingStops({
  label,
  ends,
  value,
  onChange,
}: {
  label: string;
  ends: readonly [string, string];
  value: number | null;
  onChange: (v: number) => void;
}) {
  const copy = useCopy();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== null && n <= value;
          const exact = value === n;
          return (
            <motion.button
              key={n}
              type="button"
              role="radio"
              aria-checked={exact}
              aria-label={copy.common.rating(label, n, 5)}
              whileTap={{ scale: 0.9 }}
              onClick={() => onChange(n)}
              className="grid h-12 flex-1 place-items-center rounded-2xl transition-colors duration-200"
              style={{
                background: on ? `color-mix(in oklab, var(--kind-objective) ${18 + n * 9}%, var(--fill))` : "var(--fill)",
                boxShadow: exact ? "inset 0 0 0 1.5px var(--kind-objective)" : "inset 0 0 0 1px var(--hairline)",
              }}
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: 6 + n * 2.4,
                  height: 6 + n * 2.4,
                  background: on ? "var(--kind-objective)" : "var(--ink-3)",
                  opacity: on ? 1 : 0.45,
                }}
              />
            </motion.button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-3">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </fieldset>
  );
}

/** Radial 0–10 dial for an Odyssey gauge. */
export function GaugeDial({ value, label, size = 56 }: { value: number | null; label: string; size?: number }) {
  const copy = useCopy();
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° dial
  const v = value ?? 0;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[135deg]" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={4} strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={4}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${(c * arc * v) / 10} ${c}` }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
          />
        </svg>
        <span className="tabular absolute inset-0 grid place-items-center font-mono text-sm text-ink" aria-label={copy.common.gauge(label, value)}>
          {value ?? "–"}
        </span>
      </div>
      <span className="max-w-full text-balance text-center text-[10.5px] leading-tight text-ink-3">{label}</span>
    </div>
  );
}

/** Thin three-colour Life Share bar. */
export function ShareBar({ percent }: { percent: { objective: number; maintenance: number; prototype: number } }) {
  const parts = [
    { k: "objective", v: percent.objective, c: "var(--kind-objective)" },
    { k: "prototype", v: percent.prototype, c: "var(--kind-prototype)" },
    { k: "maintenance", v: percent.maintenance, c: "var(--kind-maintenance)" },
  ];
  return (
    <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full" aria-hidden>
      {parts.map((p) =>
        p.v > 0 ? (
          <motion.span
            key={p.k}
            className="h-full rounded-full"
            style={{ background: p.c }}
            initial={{ width: 0 }}
            animate={{ width: `${p.v}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 16 }}
          />
        ) : null,
      )}
    </div>
  );
}

export function WeekDots({ dots, label }: { dots: { date: string; checkedIn: boolean }[]; label: string }) {
  return (
    <div className="flex items-center gap-2" aria-label={label} role="img">
      <div className="flex gap-1">
        {dots.map((d, i) => (
          <span
            key={d.date}
            className={clsx("size-1.5 rounded-full transition-colors", i === dots.length - 1 && "ring-1 ring-ink-3 ring-offset-1 ring-offset-transparent")}
            style={{ background: d.checkedIn ? "var(--ink)" : "var(--hairline)" }}
          />
        ))}
      </div>
      <span className="tabular whitespace-nowrap font-mono text-[11px] text-ink-3">{label}</span>
    </div>
  );
}
