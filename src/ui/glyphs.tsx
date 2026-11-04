import type { MeaningSource, TaskKind } from "@/domain/types";

/** Custom glyphs for the four Sources of Meaning — same stroke language as the contours. */
export function MeaningGlyph({ source, size = 28, filled = false }: { source: MeaningSource; size?: number; filled?: boolean }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const fill = filled ? "currentColor" : "none";
  switch (source) {
    case "wonder": // a star with a halo
      return (
        <svg {...common}>
          <path d="M16 5.5l2.6 7.2 7.4.3-5.8 4.6 2 7.2L16 20.6l-6.2 4.2 2-7.2L6 13l7.4-.3z" fill={fill} fillOpacity={0.25} />
          <circle cx="16" cy="16" r="14" strokeOpacity={0.25} />
        </svg>
      );
    case "coherence": // interlocking rings
      return (
        <svg {...common}>
          <circle cx="12" cy="16" r="7.5" fill={fill} fillOpacity={0.2} />
          <circle cx="20" cy="16" r="7.5" fill={fill} fillOpacity={0.2} />
        </svg>
      );
    case "flow": // a wave
      return (
        <svg {...common}>
          <path d="M3 13c3.2 0 3.2-4 6.5-4S12.7 13 16 13s3.3-4 6.5-4 3.3 4 6.5 4" />
          <path d="M3 20c3.2 0 3.2-4 6.5-4s3.2 4 6.5 4 3.3-4 6.5-4 3.3 4 6.5 4" strokeOpacity={0.55} />
          {filled && <path d="M3 20c3.2 0 3.2-4 6.5-4s3.2 4 6.5 4 3.3-4 6.5-4 3.3 4 6.5 4V27H3z" fill="currentColor" fillOpacity={0.2} stroke="none" />}
        </svg>
      );
    case "community": // three people in a circle
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12" strokeOpacity={0.3} />
          <circle cx="16" cy="8.8" r="2.6" fill={fill} fillOpacity={0.5} />
          <circle cx="9.8" cy="19.6" r="2.6" fill={fill} fillOpacity={0.5} />
          <circle cx="22.2" cy="19.6" r="2.6" fill={fill} fillOpacity={0.5} />
        </svg>
      );
  }
}

export const meaningColor: Record<MeaningSource, string> = {
  wonder: "var(--m-wonder)",
  coherence: "var(--m-coherence)",
  flow: "var(--m-flow)",
  community: "var(--m-community)",
};

export const kindColor: Record<TaskKind, string> = {
  objective: "var(--kind-objective)",
  maintenance: "var(--kind-maintenance)",
  prototype: "var(--kind-prototype)",
};

export function KindDot({ kind, className = "" }: { kind: TaskKind; className?: string }) {
  if (kind === "prototype")
    return <span aria-hidden className={`inline-block size-2 rotate-45 rounded-[2px] ${className}`} style={{ background: kindColor[kind] }} />;
  return <span aria-hidden className={`inline-block size-2 rounded-full ${className}`} style={{ background: kindColor[kind] }} />;
}

/** Name-agnostic mark: a sun half-risen over one contour line. */
export function AppMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="mark-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#ff9d6c" />
        </linearGradient>
      </defs>
      <path d="M7 19a9 9 0 0 1 18 0z" fill="url(#mark-sun)" />
      <path d="M3 20.5c4-1.6 6.5-1.6 9.5 0s6.5 1.6 9.5 0 4.5-1.6 7 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 25c3-1 5-1 7.5 0s5 1 7.5 0 4-1 5 0" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
