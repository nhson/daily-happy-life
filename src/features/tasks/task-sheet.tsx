"use client";

import { CalendarDays, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useCopy } from "@/copy";
import { useStore } from "@/data/store";
import type { KindChoice } from "@/data/state";
import type { Task } from "@/domain/types";
import { same, useWhyOptions, type WhyOption } from "@/features/capture/capture";
import { FocusStart } from "@/features/focus/focus";
import { Button, Chip } from "@/ui/controls";
import { tap } from "@/ui/feedback";
import { KindDot, kindColor } from "@/ui/glyphs";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";
import { useWhy } from "./task-row";

const TaskSheetContext = createContext<(id: string) => void>(() => {});
/** Open the edit sheet of one task. */
export const useTaskSheet = () => useContext(TaskSheetContext);

export function TaskSheetProvider({ children }: { children: ReactNode }) {
  const copy = useCopy();
  const { state } = useStore();
  const [id, setId] = useState<string | null>(null);
  const task = id ? state.tasks.find((t) => t.id === id) : undefined;
  const open = useCallback((taskId: string) => setId(taskId), []);
  return (
    <TaskSheetContext value={open}>
      {children}
      <Sheet open={!!task} onClose={() => setId(null)} label={copy.taskSheet.label}>
        {task && <TaskForm key={task.id} task={task} onDone={() => setId(null)} />}
      </Sheet>
    </TaskSheetContext>
  );
}

const choiceOf = (t: Task): KindChoice =>
  t.kind === "objective"
    ? { kind: "objective", objectiveId: t.objectiveId! }
    : t.kind === "prototype"
      ? { kind: "prototype", planId: t.prototypePlanId! }
      : { kind: "maintenance" };

function TaskForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const copy = useCopy();
  const { actions } = useStore();
  const toast = useToast();
  const why = useWhy();
  const current = choiceOf(task);
  const base = useWhyOptions();
  // A task can keep a why that is no longer offered (a finished Objective); show it so nothing moves by itself.
  const options: WhyOption[] = base.some((o) => same(current, o.choice))
    ? base
    : [{ choice: current, label: why(task), color: kindColor[task.kind], kind: task.kind }, ...base];

  const [title, setTitle] = useState(task.title);
  const [choice, setChoice] = useState<KindChoice>(current);
  const [due, setDue] = useState(task.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = !task.doneAt && !task.closedAt;

  const save = () => {
    if (!title.trim()) {
      setError(copy.taskSheet.emptyTitle);
      tap(30);
      return;
    }
    const patch: Parameters<typeof actions.editTask>[1] = {};
    if (title.trim() !== task.title) patch.title = title;
    if (!same(current, choice)) patch.choice = choice;
    if ((due || null) !== task.dueDate) patch.dueDate = due || null;
    if (Object.keys(patch).length) {
      const r = actions.editTask(task.id, patch);
      if (!r.ok) {
        setError(copy.capture.errors[r.error]);
        tap(30);
        return;
      }
    }
    tap(10);
    onDone();
  };

  return (
    <form
      className="flex flex-col gap-5 pb-2 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="block">
        <span className="eyebrow">{copy.taskSheet.title}</span>
        {/* Wraps instead of scrolling sideways: the whole title stays readable. Enter saves. */}
        <textarea
          value={title}
          rows={2}
          onChange={(e) => {
            setTitle(e.target.value.replace(/\n/g, " "));
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          enterKeyHint="done"
          className="serif mt-1 w-full resize-none bg-transparent py-1 text-[26px] leading-tight text-ink outline-none [field-sizing:content] placeholder:text-ink-3"
        />
      </label>

      {open && <FocusStart task={task} onStarted={onDone} />}

      <div>
        <p className="eyebrow">{copy.taskSheet.why}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o, i) => (
            <Chip
              key={i}
              selected={same(choice, o.choice)}
              color={o.color}
              onClick={() => {
                setChoice(o.choice);
                setError(null);
              }}
            >
              <KindDot kind={o.kind} />
              <span className="max-w-[16rem] truncate">{o.label}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow">{copy.taskSheet.due}</p>
        <div className="mt-2 flex items-center gap-2">
          <label className="glass field-pill flex h-11 items-center gap-2 rounded-full pl-3.5 pr-3">
            <CalendarDays size={16} className="shrink-0 text-ink-3" aria-hidden />
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label={copy.taskSheet.due}
              className="tabular min-w-0 bg-transparent text-[15px] text-ink outline-none [color-scheme:light_dark]"
            />
          </label>
          {due ? (
            <button type="button" onClick={() => setDue("")} className="flex h-11 items-center gap-1 px-2 text-sm text-ink-2 hover:text-ink">
              <X size={14} aria-hidden /> {copy.taskSheet.clearDue}
            </button>
          ) : (
            <span className="text-sm text-ink-3">{copy.taskSheet.noDue}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-3">{copy.taskSheet.dueHint}</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-ink-2">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Button type="submit" size="lg">
        {copy.taskSheet.save}
      </Button>

      <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
        {open && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ink-3">{copy.taskSheet.closeHint}</p>
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                actions.closeTask(task.id);
                tap(10);
                toast(copy.taskSheet.closed);
                onDone();
              }}
            >
              {copy.taskSheet.close}
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              tap(20);
              return;
            }
            actions.deleteTask(task.id);
            toast(copy.taskSheet.deleted);
            onDone();
          }}
          className="h-10 self-start text-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline"
        >
          {confirmDelete ? copy.taskSheet.deleteConfirm : copy.taskSheet.delete}
        </button>
      </div>
    </form>
  );
}
