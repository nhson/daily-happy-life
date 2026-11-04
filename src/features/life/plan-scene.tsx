"use client";

import { useId, type CSSProperties } from "react";

/**
 * A small landscape for each Odyssey life — drawn, not photographed, so it follows the sky and the theme.
 * 1 · Current Path: the road you are on, walking into a sunrise.
 * 2 · Plan B: the fork in the road.
 * 3 · Wild Card: balloons under a night full of stars.
 * Decorative only.
 */
export function PlanScene({ slot, tint, className }: { slot: 1 | 2 | 3; tint: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const ink = (o: number): CSSProperties => ({ fill: "var(--ink)", fillOpacity: o });
  const mix = (pct: number, base = "transparent") => `color-mix(in oklab, ${tint} ${pct}%, ${base})`;
  const light = mix(45, "white");

  return (
    <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: mix(slot === 3 ? 70 : 52) }} />
          <stop offset="1" style={{ stopColor: mix(10) }} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" style={{ stopColor: "#fff8e8" }} />
          <stop offset="0.55" style={{ stopColor: mix(70, "#fff8e8") }} />
          <stop offset="1" style={{ stopColor: tint }} />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" style={{ stopColor: mix(80, "white"), stopOpacity: 0.85 }} />
          <stop offset="1" style={{ stopColor: tint, stopOpacity: 0 }} />
        </radialGradient>
        <mask id={`${id}-moon`}>
          <circle cx="262" cy="30" r="11" fill="white" />
          <circle cx="268" cy="25" r="10" fill="black" />
        </mask>
      </defs>

      <rect width="320" height="140" fill={`url(#${id}-sky)`} />

      {slot === 1 && (
        <>
          <circle className="scene-pulse" cx="160" cy="80" r="56" fill={`url(#${id}-glow)`} />
          <circle cx="160" cy="80" r="21" fill={`url(#${id}-sun)`} />
          <path d="M0 92 L38 72 L66 84 L108 58 L146 82 L188 62 L228 84 L268 60 L320 86 V140 H0Z" style={ink(0.09)} />
          <path d="M0 104 Q60 86 120 100 T240 96 T320 100 V140 H0Z" style={ink(0.13)} />
          <path d="M0 120 Q80 106 160 114 T320 112 V140 H0Z" style={ink(0.19)} />
          {/* The road you are already on, narrowing toward the sunrise */}
          <path
            d="M122 140 C136 128 178 124 166 113 C159 107 150 104 159 100 L162 100 C157 104 169 108 174 113 C188 125 170 131 202 140 Z"
            style={{ fill: light, fillOpacity: 0.95 }}
          />
          <g className="scene-drift" style={{ stroke: "var(--ink)", strokeOpacity: 0.45, fill: "none" }} strokeWidth="1.2" strokeLinecap="round">
            <path d="M86 40 q4 -4 8 0 q4 -4 8 0" />
            <path d="M108 30 q3 -3 6 0 q3 -3 6 0" />
          </g>
        </>
      )}

      {slot === 2 && (
        <>
          <circle cx="262" cy="34" r="15" fill={`url(#${id}-sun)`} />
          <g className="scene-drift" fill="white" fillOpacity="0.7">
            <ellipse cx="70" cy="34" rx="26" ry="7" />
            <ellipse cx="86" cy="29" rx="14" ry="7" />
            <ellipse cx="190" cy="50" rx="20" ry="5" />
          </g>
          <path d="M0 96 L44 76 L84 92 L120 80 L160 96 L200 78 L250 94 L290 74 L320 90 V140 H0Z" style={ink(0.09)} />
          <path d="M0 108 Q70 94 150 106 T320 104 V140 H0Z" style={ink(0.14)} />
          <path d="M0 122 Q90 110 170 118 T320 116 V140 H0Z" style={ink(0.2)} />
          {/* One road, two directions */}
          <path
            d="M138 140 C148 128 156 122 156 117 C150 112 120 106 86 101 L90 99 C124 103 152 108 160 113 C168 108 200 103 236 99 L238 101 C204 106 170 112 164 117 C164 122 172 128 182 140 Z"
            style={{ fill: light, fillOpacity: 0.95 }}
          />
          {/* Signpost at the fork */}
          <rect x="159" y="86" width="2" height="30" rx="1" style={ink(0.6)} />
          <path d="M160 88 H140 L135 92 L140 96 H160Z" style={{ fill: mix(80, "white") }} />
          <path d="M160 97 H180 L185 101 L180 105 H160Z" style={{ fill: "white", fillOpacity: 0.9 }} />
        </>
      )}

      {slot === 3 && (
        <>
          <g fill="white">
            {[
              [24, 22, 1.2], [58, 12, 0.9], [92, 30, 1], [148, 14, 1.3], [184, 34, 0.8],
              [214, 16, 1], [298, 44, 1.1], [40, 52, 0.8], [236, 52, 0.9], [306, 14, 0.8],
            ].map(([x, y, r], i) => (
              <circle key={i} className="scene-twinkle" style={{ animationDelay: `${i * 0.37}s` }} cx={x} cy={y} r={r} />
            ))}
          </g>
          <circle cx="262" cy="30" r="11" fill="#fff6e2" mask={`url(#${id}-moon)`} />
          <path d="M0 100 Q50 82 110 96 T220 90 T320 96 V140 H0Z" style={ink(0.12)} />
          <path d="M0 118 Q90 100 180 114 T320 110 V140 H0Z" style={ink(0.2)} />
          {/* The wild card: a balloon, and one further off */}
          <Balloon x={112} y={52} scale={1} light={light} strong={mix(85, "white")} />
          <Balloon x={214} y={70} scale={0.5} light={light} strong={mix(85, "white")} delay={1.6} />
        </>
      )}
    </svg>
  );
}

function Balloon({ x, y, scale, light, strong, delay = 0 }: { x: number; y: number; scale: number; light: string; strong: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className="scene-bob" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 -22 C14 -22 20 -10 18 0 C16 10 6 15 4 21 L-4 21 C-6 15 -16 10 -18 0 C-20 -10 -14 -22 0 -22Z" style={{ fill: light }} />
        <path d="M0 -22 C6 -22 8 -10 7 0 C6 10 3 15 2 21 L-2 21 C-3 15 -6 10 -7 0 C-8 -10 -6 -22 0 -22Z" style={{ fill: strong }} />
        <path d="M-4 21 L-4 27 M4 21 L4 27" style={{ stroke: "var(--ink)", strokeOpacity: 0.5 }} strokeWidth="0.8" />
        <rect x="-4.5" y="27" width="9" height="6" rx="1.2" style={{ fill: "var(--ink)", fillOpacity: 0.6 }} />
      </g>
    </g>
  );
}
