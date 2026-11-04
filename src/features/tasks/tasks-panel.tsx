"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { copy } from "@/copy/en";
import { addDays, logicalDate } from "@/domain/logical-day";
import type { Task } from "@/domain/types";
import { useStore } from "@/data/mock-store";
import { Chip } from "@/ui/controls";
import { KindDot, kindColor } from "@/ui/glyphs";
import { TaskList, useTaskKeys } from "./task-list";

type Filter = { kind: "all" } | { kind: "objective"; id: string } | { kind: "maintenance" } | { kind: "prototype" };

/** Tasks grouped by their "why", filterable. Used as the Tasks tab and beside Today on desktop. */
export function TasksPanel({ keyboard = false, title = true }: { keyboard?: boolean; title?: boolean }) {
  const { state, open, activeObjectives, today } = useStore();
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const g: { key: string; label: string; color: string; kind: Task["kind"]; tasks: Task[] }[] = [];
    for (const o of activeObjectives) g.push({ key: o.id, label: o.title, color: kindColor.objective, kind: "objective", tasks: open.filter((t) => t.objectiveId === o.id) });
    for (const p of state.plans.filter((p) => !p.isActive))
      g.push({ key: p.id, label: `${copy.kinds.prototype} · ${p.title || `Plan ${p.slot}`}`, color: kindColor.prototype, kind: "prototype", tasks: open.filter((t) => t.prototypePlanId === p.id) });
    g.push({ key: "maintenance", label: copy.kinds.maintenance, color: kindColor.maintenance, kind: "maintenance", tasks: open.filter((t) => t.kind === "maintenance") });
    return g
      .filter((x) => x.tasks.length)
      .filter((x) =>
        filter.kind === "all" ? true : filter.kind === "objective" ? x.key === filter.id : x.kind === filter.kind,
      );
  }, [activeObjectives, state.plans, open, filter]);

  const flat = useMemo(() => groups.flatMap((g) => g.tasks), [groups]);
  const focusedId = useTaskKeys(flat, keyboard);
  const { timeZone, dayEndHour } = state.settings;
  const weekAgo = addDays(today, -6);
  const doneThisWeek = state.tasks.filter((t) => t.doneAt && logicalDate(new Date(t.doneAt), timeZone, dayEndHour) >= weekAgo);

  return (
    <div className="flex flex-col gap-6">
      {title && (
        <div className="flex items-baseline justify-between">
          <h1 className="serif text-[40px] leading-none">{copy.tasks.title}</h1>
          <span className="tabular font-mono text-xs text-ink-3">{open.length} open</span>
        </div>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="toolbar" aria-label="Filter">
        <Chip selected={filter.kind === "all"} onClick={() => setFilter({ kind: "all" })}>
          {copy.tasks.all}
        </Chip>
        {activeObjectives.map((o) => (
          <Chip key={o.id} color={kindColor.objective} selected={filter.kind === "objective" && filter.id === o.id} onClick={() => setFilter({ kind: "objective", id: o.id })}>
            <KindDot kind="objective" /> <span className="max-w-[11rem] truncate">{o.title}</span>
          </Chip>
        ))}
        <Chip color={kindColor.prototype} selected={filter.kind === "prototype"} onClick={() => setFilter({ kind: "prototype" })}>
          <KindDot kind="prototype" /> {copy.kinds.prototype}
        </Chip>
        <Chip color={kindColor.maintenance} selected={filter.kind === "maintenance"} onClick={() => setFilter({ kind: "maintenance" })}>
          <KindDot kind="maintenance" /> {copy.kinds.maintenance}
        </Chip>
      </div>

      {groups.length === 0 && <p className="serif py-10 text-center text-2xl text-ink-2">{copy.tasks.empty}</p>}

      <AnimatePresence initial={false}>
        {groups.map((g) => (
          <motion.section key={g.key} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-medium text-ink-2">
              <KindDot kind={g.kind} />
              <span className="truncate">{g.label}</span>
              <span className="tabular ml-auto font-mono text-xs text-ink-3">{g.tasks.length}</span>
            </h2>
            <TaskList tasks={g.tasks} showWhy={false} focusedId={focusedId} />
          </motion.section>
        ))}
      </AnimatePresence>


      {doneThisWeek.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="flex h-10 items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
            <motion.span animate={{ rotate: showDone ? 0 : -90 }}>
              <ChevronDown size={15} />
            </motion.span>
            {copy.tasks.done} · {doneThisWeek.length}
          </button>
          <AnimatePresence>
            {showDone && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2">
                <TaskList tasks={doneThisWeek} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
