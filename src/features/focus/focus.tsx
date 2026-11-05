"use client";

import { clsx } from "clsx";
import { Square, Timer } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/copy";
import { useStore } from "@/data/store";
import { currentFocus, endsAt, FOCUS_MINUTES, phaseOf, type FocusSession } from "@/domain/focus";
import type { Task } from "@/domain/types";
import { Button, Chip } from "@/ui/controls";
import { chime, tap } from "@/ui/feedback";
import { Sheet } from "@/ui/sheet";

/** A clock that ticks every second, only while something needs it. */
function useSeconds(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    const onVisible = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);
  return now;
}

/** The session running or waiting for an answer, read every second. */
export function useFocus(): { session: FocusSession | null; task: Task | null; now: Date } {
  const { state } = useStore();
  const any = state.focus.some((f) => !f.endedAt);
  const now = useSeconds(any);
  const session = any ? currentFocus(state.focus, now) : null;
  const task = session ? (state.tasks.find((t) => t.id === session.taskId) ?? null) : null;
  return { session: task ? session : null, task, now };
}

const mmss = (ms: number, planned: number) => {
  const s = Math.min(planned * 60, Math.max(0, Math.ceil(ms / 1000)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Fills as the session goes on: the time already given, not the time left. */
function Ring({ session, now, size = 28 }: { session: FocusSession; now: Date; size?: number }) {
  const total = session.plannedMinutes * 60_000;
  const left = Math.min(total, Math.max(0, endsAt(session).getTime() - now.getTime()));
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={2.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--kind-objective)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (left / total)}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}

/**
 * Everything a Focus Session shows outside the task itself: the bar while it runs (above the tab
 * bar, on every page) and, when its time is up, one quiet question. A chime and a tap mark the end
 * when the app is open; a push does when it is not (queued by the server).
 */
export function FocusLayer() {
  const copy = useCopy();
  const { state, actions } = useStore();
  const { session, task, now } = useFocus();
  const phase = session ? phaseOf(session, now) : null;

  // The end is marked once, and only if it happens while the app is open.
  const last = useRef<{ id: string; phase: string } | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = session && phase ? { id: session.id, phase } : null;
    if (session && phase === "finished" && before?.id === session.id && before.phase === "running") {
      tap(30);
      if (state.settings.sound) chime();
    }
  }, [session, phase, state.settings.sound]);

  return (
    <>
      <AnimatePresence>
        {session && task && phase === "running" && (
          <motion.div
            key="bar"
            data-chrome
            role="status"
            aria-label={copy.focus.running}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),14px)+68px)] z-30 flex justify-center px-4 lg:bottom-8"
          >
            <div data-focus-bar className="glass-strong flex w-full max-w-sm items-center gap-3 rounded-full py-1.5 pl-3 pr-1.5">
              <Ring session={session} now={now} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{task.title}</p>
                <p className="tabular text-xs text-ink-3">{copy.focus.left(mmss(endsAt(session).getTime() - now.getTime(), session.plannedMinutes))}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  tap(10);
                  actions.stopFocus(session.id);
                }}
                aria-label={copy.focus.stopFor(task.title)}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--fill)] text-ink-2 hover:text-ink"
              >
                <Square size={14} fill="currentColor" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Closing the sheet any other way means "leave it for now". */}
      <Sheet open={!!(session && task && phase === "finished")} onClose={() => session && actions.answerFocus(session.id, "leave")} label={copy.focus.endTitle}>
        {session && task && (
          <div className="flex flex-col gap-6 pb-2 pt-2">
            <div>
              <h2 className="serif text-[34px] leading-none">{copy.focus.endTitle}</h2>
              <p className="mt-3 text-ink-2">{copy.focus.endBody(task.title)}</p>
            </div>
            <div className="flex flex-col gap-2">
              {!task.doneAt && (
                <Button size="lg" onClick={() => actions.answerFocus(session.id, "done")}>
                  {copy.focus.markDone}
                </Button>
              )}
              <Button size="lg" variant="glass" onClick={() => actions.answerFocus(session.id, "again")}>
                {copy.focus.again} · {copy.focus.minutes(session.plannedMinutes)}
              </Button>
              <Button variant="ghost" onClick={() => actions.answerFocus(session.id, "leave")}>
                {copy.focus.leave}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** In a task's sheet: pick a length to start, or see and stop the one running on it. */
export function FocusStart({ task, onStarted }: { task: Task; onStarted: () => void }) {
  const copy = useCopy();
  const { focusMinutes, actions } = useStore();
  const { session, now } = useFocus();
  const mine = session && session.taskId === task.id && phaseOf(session, now) === "running" ? session : null;

  return (
    <div>
      <p className="eyebrow">{copy.focus.start}</p>
      {mine ? (
        <div className="mt-2 flex items-center gap-3">
          <Ring session={mine} now={now} />
          <span className="tabular flex-1 text-sm text-ink-2">{copy.focus.left(mmss(endsAt(mine).getTime() - now.getTime(), mine.plannedMinutes))}</span>
          <Button type="button" variant="glass" size="sm" onClick={() => actions.stopFocus(mine.id)}>
            {copy.focus.stop}
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={copy.focus.length}>
          {FOCUS_MINUTES.map((m) => (
            <Chip
              key={m}
              selected={m === focusMinutes}
              onClick={() => {
                tap(10);
                actions.startFocus(task.id, m);
                onStarted();
              }}
            >
              <Timer size={14} aria-hidden />
              {copy.focus.minutes(m)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** On a Top 3 row: one tap starts a session of the last length; tapping it again stops it. */
export function FocusButton({ task }: { task: Task }) {
  const copy = useCopy();
  const { actions } = useStore();
  const { session, now } = useFocus();
  const running = session && session.taskId === task.id && phaseOf(session, now) === "running" ? session : null;
  if (task.doneAt) return null;
  return (
    <button
      type="button"
      onClick={() => {
        tap(10);
        if (running) actions.stopFocus(running.id);
        else actions.startFocus(task.id);
      }}
      aria-pressed={!!running}
      aria-label={running ? copy.focus.stopFor(task.title) : copy.focus.startFor(task.title)}
      className={clsx("grid size-11 shrink-0 place-items-center rounded-full transition-opacity", running ? "opacity-100" : "opacity-40 hover:opacity-80")}
    >
      {running ? <Ring session={running} now={now} size={22} /> : <Timer size={18} strokeWidth={1.8} aria-hidden />}
    </button>
  );
}
