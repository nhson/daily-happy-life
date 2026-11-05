"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import type { Task } from "@/domain/types";
import { useStore } from "@/data/store";
import { TaskRow } from "./task-row";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Keyboard driving over an ordered set of tasks: j/k move · x completes · t toggles Top 3. */
export function useTaskKeys(tasks: Task[], enabled: boolean): string | null {
  const { actions } = useStore();
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
      const i = tasks.findIndex((t) => t.id === focusId);
      if (e.key === "j") setFocusId(tasks[Math.min(tasks.length - 1, i + 1)]?.id ?? null);
      else if (e.key === "k") setFocusId(tasks[Math.max(0, i - 1)]?.id ?? null);
      else if (e.key === "x" && focusId) actions.toggleDone(focusId);
      else if (e.key === "t" && focusId) actions.toggleTop3(focusId);
      else if (e.key === "Escape") setFocusId(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, tasks, focusId, actions]);

  useEffect(() => {
    if (focusId) document.querySelector(`[data-task="${focusId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusId]);

  return enabled ? focusId : null;
}

export function TaskList({
  tasks,
  focusedId = null,
  showWhy = true,
  compact = false,
  focusable = false,
}: {
  tasks: Task[];
  focusedId?: string | null;
  showWhy?: boolean;
  compact?: boolean;
  focusable?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} focused={t.id === focusedId} showWhy={showWhy} compact={compact} focusable={focusable} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
