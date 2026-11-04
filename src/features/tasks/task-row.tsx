"use client";

import { clsx } from "clsx";
import { Star, Check } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useRef } from "react";
import { useCopy } from "@/copy";
import type { Task } from "@/domain/types";
import { useStore } from "@/data/mock-store";
import { KindDot, kindColor } from "@/ui/glyphs";
import { tap } from "@/ui/feedback";
import { useSky } from "@/ui/sky";
import { useToast } from "@/ui/toast";

export function useWhy() {
  const { state } = useStore();
  const copy = useCopy();
  return (t: Task): string => {
    if (t.kind === "objective") return state.objectives.find((o) => o.id === t.objectiveId)?.title ?? copy.kinds.objective;
    if (t.kind === "prototype") {
      const p = state.plans.find((x) => x.id === t.prototypePlanId);
      return `${copy.kinds.prototype} · ${p?.title || copy.life.plan(p?.slot ?? 0)}`;
    }
    return copy.kinds.maintenance;
  };
}

export function TaskRow({
  task,
  focused = false,
  showWhy = true,
  compact = false,
}: {
  task: Task;
  focused?: boolean;
  showWhy?: boolean;
  compact?: boolean;
}) {
  const copy = useCopy();
  const { today, top3, actions } = useStore();
  const { celebrate } = useSky();
  const toast = useToast();
  const why = useWhy();
  const reduce = useReducedMotion();
  const done = !!task.doneAt;
  const inTop3 = task.top3Date === today;

  const x = useMotionValue(0);
  const trackOpacity = useTransform(x, [0, 90], [0, 1]);
  const checkScale = useTransform(x, [20, 90], [0.6, 1.1]);
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null);

  const complete = () => {
    tap(done ? 6 : 12);
    const wasLastTop3 = !done && inTop3 && top3.filter((t) => !t.doneAt).length === 1 && top3.length === 3;
    actions.toggleDone(task.id);
    if (wasLastTop3) {
      celebrate();
      toast(copy.today.top3Done);
    }
  };

  const flipTop3 = () => {
    if (!actions.toggleTop3(task.id)) {
      tap(30);
      toast(copy.tasks.top3Full);
    } else tap(10);
  };

  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
      data-task={task.id}
      className="relative list-none overflow-hidden rounded-2xl"
    >
      {/* Swipe track */}
      <motion.div
        aria-hidden
        className="absolute inset-0 flex items-center rounded-2xl pl-5"
        style={{ opacity: trackOpacity, background: `color-mix(in oklab, ${kindColor[task.kind]} 38%, transparent)` }}
      >
        <motion.span style={{ scale: checkScale }} className="grid size-7 place-items-center rounded-full bg-solid text-solid-ink">
          <Check size={16} strokeWidth={2.5} />
        </motion.span>
      </motion.div>

      <motion.div
        drag={reduce ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.04, right: 0.55 }}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 90) complete();
          animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
        }}
        onPointerDown={(e) => {
          press.current = {
            x: e.clientX,
            y: e.clientY,
            fired: false,
            t: setTimeout(() => {
              if (press.current) press.current.fired = true;
              flipTop3();
            }, 480),
          };
        }}
        onPointerMove={(e) => {
          if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) clearTimeout(press.current.t);
        }}
        onPointerUp={() => press.current && clearTimeout(press.current.t)}
        onClickCapture={(e) => {
          // A long-press already toggled Top 3 — swallow the click that follows it.
          if (press.current?.fired) {
            e.stopPropagation();
            e.preventDefault();
            press.current = null;
          }
        }}
        onPointerCancel={() => press.current && clearTimeout(press.current.t)}
        className={clsx(
          "glass relative flex items-center gap-3 rounded-2xl pr-2 transition-shadow",
          compact ? "min-h-12 py-2 pl-3" : "min-h-14 py-2.5 pl-3",
          focused && "ring-2 ring-ink/60",
        )}
      >
        <button
          type="button"
          onClick={complete}
          aria-label={done ? copy.taskRow.notDone(task.title) : copy.taskRow.complete(task.title)}
          className="grid size-11 shrink-0 place-items-center"
        >
          <span
            className="grid size-6 place-items-center rounded-full transition-colors duration-300"
            style={{
              boxShadow: `inset 0 0 0 1.75px ${kindColor[task.kind]}`,
              background: done ? kindColor[task.kind] : "transparent",
            }}
          >
            <motion.svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <motion.path
                d="M3 7.4l2.6 2.6L11 4.4"
                fill="none"
                stroke="#0b1230"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              />
            </motion.svg>
          </span>
        </button>

        <div className="min-w-0 flex-1 py-0.5">
          {/* Titles wrap to two lines — they are the user's own words, never an ellipsis after one. */}
          <span className={clsx("line-clamp-2 text-[15px] leading-snug transition-colors duration-500", done ? "text-ink-3" : "text-ink")}>
            <span className="strike" data-on={done}>
              {task.title}
            </span>
          </span>
          {showWhy && (
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-3">
              <KindDot kind={task.kind} />
              <span className="truncate">{why(task)}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={flipTop3}
          aria-pressed={inTop3}
          aria-label={inTop3 ? copy.taskRow.removeTop3 : copy.taskRow.addTop3}
          className={clsx("grid size-11 shrink-0 place-items-center rounded-full transition-opacity", inTop3 ? "opacity-100" : "opacity-40 hover:opacity-80")}
        >
          <Star size={18} strokeWidth={1.8} fill={inTop3 ? "var(--kind-objective)" : "none"} color={inTop3 ? "var(--kind-objective)" : "currentColor"} />
        </button>
      </motion.div>
    </motion.li>
  );
}
