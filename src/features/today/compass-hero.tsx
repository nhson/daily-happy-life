"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { copy } from "@/copy/en";
import type { CompassLine } from "@/domain/compass-line";

/** Today's Compass Line, revealed word by word. Tap to see where it comes from. */
export function CompassHero({
  line,
  size = "lg",
  glow = false,
  delay = 0,
}: {
  line: CompassLine;
  size?: "xl" | "lg" | "md";
  glow?: boolean;
  delay?: number;
}) {
  const [showSource, setShowSource] = useState(false);
  const reduce = useReducedMotion();
  const words = line.text.split(/\s+/);
  const source = line.source === "mindset" ? `${line.label} · ${copy.compassSource.mindset}` : copy.compassSource[line.source];

  return (
    <figure>
      <button
        type="button"
        onClick={() => setShowSource((s) => !s)}
        className="block w-full text-left"
        aria-label={`${line.text} — ${source}`}
        aria-expanded={showSource}
      >
        <blockquote
          className={clsx(
            "serif text-balance text-ink",
            size === "xl" && "text-[clamp(2.2rem,8.4vw,4.4rem)] leading-[1.04]",
            size === "lg" && "text-[clamp(1.9rem,6.6vw,3.3rem)] leading-[1.06]",
            size === "md" && "text-[clamp(1.35rem,4.6vw,1.9rem)] leading-[1.14]",
            glow && "glow",
          )}
        >
          {words.map((w, i) => (
            <motion.span
              key={`${line.text}-${i}`}
              className="inline-block whitespace-pre"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: delay + i * (reduce ? 0 : 0.075), duration: reduce ? 0.3 : 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </blockquote>
      </button>
      <AnimatePresence initial={false}>
        {showSource && (
          <motion.figcaption
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="eyebrow mt-3 overflow-hidden"
          >
            — {source}
          </motion.figcaption>
        )}
      </AnimatePresence>
    </figure>
  );
}
