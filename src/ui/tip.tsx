"use client";

import { Lightbulb } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { copy } from "@/copy/en";

/**
 * A one-time onboarding card: quiet, inline, in the page flow — never an overlay.
 * Render it inside <AnimatePresence> or pass `show` so it leaves gently.
 */
export function Tip({ show = true, onDismiss, children }: { show?: boolean; onDismiss: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.aside
          role="note"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="glass flex items-start gap-3 rounded-2xl py-3 pl-4 pr-2">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            <p className="flex-1 text-sm leading-relaxed text-ink-2">{children}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="-my-1.5 h-11 shrink-0 rounded-full px-3 text-sm font-medium text-ink hover:bg-fill"
            >
              {copy.tips.gotIt}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
