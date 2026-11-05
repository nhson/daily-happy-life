"use client";

import { ArrowUp, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCopy } from "@/copy";
import { Tip } from "@/ui/tip";
import { useStore } from "@/data/mock-store";
import type { KindChoice } from "@/data/state";
import { Chip } from "@/ui/controls";
import { KindDot, kindColor } from "@/ui/glyphs";
import { tap } from "@/ui/feedback";
import { Sheet } from "@/ui/sheet";

const CaptureContext = createContext<() => void>(() => {});
export const useCapture = () => useContext(CaptureContext);

export const same = (a: KindChoice | null, b: KindChoice) =>
  !!a &&
  a.kind === b.kind &&
  (a.kind !== "objective" || a.objectiveId === (b as typeof a).objectiveId) &&
  (a.kind !== "prototype" || a.planId === (b as typeof a).planId);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CaptureContext value={show}>
      {children}
      <Sheet open={open} onClose={() => setOpen(false)} label={copy.capture.open}>
        {open && <CaptureForm onDone={() => setOpen(false)} />}
      </Sheet>
    </CaptureContext>
  );
}

export type WhyOption = { choice: KindChoice; label: string; color: string; kind: KindChoice["kind"] };

/** Every "why" a task can have right now: active Objectives, Maintenance, written non-active plans. */
export function useWhyOptions(): WhyOption[] {
  const copy = useCopy();
  const { state, activeObjectives } = useStore();
  return useMemo(() => {
    const list: WhyOption[] = [];
    for (const o of activeObjectives) list.push({ choice: { kind: "objective", objectiveId: o.id }, label: o.title, color: kindColor.objective, kind: "objective" });
    list.push({ choice: { kind: "maintenance" }, label: copy.capture.maintenance, color: kindColor.maintenance, kind: "maintenance" });
    for (const p of state.plans.filter((p) => !p.isActive && p.title))
      list.push({ choice: { kind: "prototype", planId: p.id }, label: p.title, color: kindColor.prototype, kind: "prototype" });
    return list;
  }, [activeObjectives, state.plans, copy]);
}

function CaptureForm({ onDone }: { onDone: () => void }) {
  const copy = useCopy();
  const { state, tipUnseen, actions } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);

  const options = useWhyOptions();

  const [choice, setChoice] = useState<KindChoice>(
    () => options.find((o) => same(state.lastKind, o.choice))?.choice ?? options[0].choice,
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const submit = () => {
    if (!title.trim()) return;
    const r = actions.addTask(title, choice);
    if (!r.ok) {
      setError(copy.capture.errors[r.error]);
      tap(30);
      return;
    }
    tap(10);
    setTitle("");
    setError(null);
    setAdded((n) => n + 1);
  };

  return (
    <form
      className="pb-2 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        // ⌘1–9 picks a "why" without leaving the keyboard.
        if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
          const o = options[Number(e.key) - 1];
          if (o) {
            e.preventDefault();
            setChoice(o.choice);
          }
        }
      }}
    >
      <div className="flex items-center gap-2">
        <input
          ref={input}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder={copy.capture.placeholder}
          aria-label={copy.capture.placeholder}
          enterKeyHint="done"
          className="serif min-w-0 flex-1 bg-transparent py-3 text-[26px] leading-tight text-ink outline-none placeholder:text-ink-3"
        />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.92 }}
          disabled={!title.trim()}
          aria-label={copy.capture.add}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-solid text-solid-ink transition-opacity disabled:opacity-25"
        >
          <ArrowUp size={20} strokeWidth={2.2} />
        </motion.button>
      </div>

      <div className="mt-3">
        <Tip show={tipUnseen("capture")} onDismiss={() => actions.dismissTip("capture")}>
          {copy.tips.capture}
          <span className="hidden lg:inline">{copy.tips.captureDesktop}</span>
        </Tip>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="eyebrow">{copy.capture.why}</p>
        <AnimatePresence mode="popLayout">
          {added > 0 && (
            <motion.span key={added} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-ink-3">
              {copy.capture.added(added)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {/* Wrap, never scroll sideways: every "why" stays visible on a phone. */}
      <div className="mt-2 flex flex-wrap gap-2 pb-1">
        {options.map((o, i) => (
          <Chip key={i} selected={same(choice, o.choice)} color={o.color} onClick={() => setChoice(o.choice)} title={i < 9 ? `⌘${i + 1}` : undefined}>
            <KindDot kind={o.kind} />
            <span className="max-w-[16rem] truncate">{o.label}</span>
          </Chip>
        ))}
      </div>
      {options.every((o) => o.kind !== "prototype") && (
        <p className="mt-2 text-xs text-ink-3">{copy.capture.prototypeLocked}</p>
      )}
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 text-sm text-ink-2">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onDone} className="h-10 px-3 text-sm text-ink-2 hover:text-ink">
          {copy.capture.done}
        </button>
      </div>
    </form>
  );
}

export function CaptureButton() {
  const copy = useCopy();
  const open = useCapture();
  return (
    <motion.button
      type="button"
      onClick={open}
      whileTap={{ scale: 0.92 }}
      aria-label={`${copy.capture.open} (⌘K)`}
      className="grid size-14 place-items-center rounded-full bg-solid text-solid-ink shadow-[0_14px_40px_-12px_rgb(0_0_0/0.55)]"
    >
      <Plus size={24} strokeWidth={2} />
    </motion.button>
  );
}
