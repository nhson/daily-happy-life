"use client";

import { clsx } from "clsx";
import { ArrowRight, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { copy } from "@/copy/en";
import { useStore } from "@/data/mock-store";
import { useCapture } from "@/features/capture/capture";
import { Button } from "@/ui/controls";
import { KindDot, kindColor } from "@/ui/glyphs";
import { tap } from "@/ui/feedback";
import { useWhy } from "@/features/tasks/task-row";
import { CompassHero } from "./compass-hero";

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

/** The Morning Ritual: Compass Line → Top 3 → Intention. Full-screen, once per Logical Day. */
export function MorningFlow({ onClose }: { onClose: () => void }) {
  const { now, compassLine, open, carryOver, log, actions } = useStore();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(() => carryOver.map((t) => t.id).slice(0, 3));
  const [when, setWhen] = useState(log.intention?.when ?? "");
  const [then, setThen] = useState(log.intention?.then ?? "");

  // Hide app chrome (tab bar, header) while the ritual has the screen.
  useEffect(() => {
    document.documentElement.dataset.ritual = "on";
    return () => {
      delete document.documentElement.dataset.ritual;
    };
  }, []);

  const finish = () => {
    actions.finishMorning(picked, when.trim() && then.trim() ? { when: when.trim(), then: then.trim() } : null);
    tap(14);
    onClose();
  };
  const skip = () => {
    actions.skipMorning();
    onClose();
  };

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 40, filter: "blur(6px)" },
        animate: { opacity: 1, x: 0, filter: "blur(0px)" },
        exit: { opacity: 0, x: -40, filter: "blur(6px)" },
      };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Morning ritual"
      className="fixed inset-0 z-40 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: reduce ? 0 : -30, filter: reduce ? "none" : "blur(10px)", transition: { duration: 0.6 } }}
      style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--sky-top) 55%, transparent), transparent 70%)" }}
    >
      <div className="mx-auto flex h-dvh w-full min-w-0 max-w-xl flex-col px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),20px)]">
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1 rounded-full bg-ink"
                animate={{ width: i === step ? 22 : 6, opacity: i <= step ? 0.9 : 0.25 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            ))}
          </div>
          <button type="button" onClick={skip} className="h-10 px-2 text-sm text-ink-2 hover:text-ink">
            {copy.morning.skip}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.section key="compass" {...slide} transition={{ duration: 0.5 }} className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-10">
              <motion.p className="eyebrow mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {fmtDate(now)}
              </motion.p>
              <CompassHero line={compassLine} size="xl" delay={0.5} />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + compassLine.text.split(" ").length * 0.075 }}
                className="mt-12"
              >
                <Button size="lg" onClick={() => setStep(1)}>
                  {copy.morning.begin} <ArrowRight size={18} />
                </Button>
              </motion.div>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section key="top3" {...slide} transition={{ duration: 0.45 }} className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="no-scrollbar -mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-8 [mask-image:linear-gradient(180deg,#000_calc(100%-40px),transparent)]">
                <h2 className="serif text-[clamp(2rem,7vw,2.8rem)] leading-[1.05]">{copy.morning.top3Title}</h2>
                <p className="mt-2 text-ink-2">{copy.morning.top3Hint}</p>
                <Slots count={picked.length} />
                <Top3Picker picked={picked} setPicked={setPicked} carryOverIds={carryOver.map((t) => t.id)} openIds={open.map((t) => t.id)} />
              </div>
              <div className="flex shrink-0 items-center justify-between pt-3">
                <button type="button" onClick={() => setStep(0)} className="h-11 px-2 text-sm text-ink-2">
                  Back
                </button>
                <Button size="lg" onClick={() => setStep(2)}>
                  {copy.morning.continue} <ArrowRight size={18} />
                </Button>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section key="intention" {...slide} transition={{ duration: 0.45 }} className="flex min-h-0 flex-1 flex-col overflow-y-auto py-8">
              <h2 className="serif text-[clamp(2rem,7vw,2.8rem)] leading-[1.05]">{copy.morning.intentionTitle}</h2>
              <p className="mt-2 text-ink-2">{copy.morning.intentionHint}</p>
              <div className="glass mt-10 rounded-[28px] p-6">
                <IntentionLine label={copy.morning.when} value={when} onChange={setWhen} placeholder={copy.morning.whenPlaceholder} autoFocus />
                <div className="my-4 h-px bg-hairline" />
                <IntentionLine label={copy.morning.then} value={then} onChange={setThen} placeholder={copy.morning.thenPlaceholder} />
              </div>
              <div className="mt-auto flex items-center justify-between pt-8">
                <button type="button" onClick={() => setStep(1)} className="h-11 px-2 text-sm text-ink-2">
                  Back
                </button>
                <Button size="lg" onClick={finish}>
                  {when.trim() && then.trim() ? copy.morning.set : copy.today.startDay}
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Slots({ count }: { count: number }) {
  return (
    <div className="mt-6 flex gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="grid size-9 place-items-center rounded-full font-mono text-sm"
          animate={{
            background: i < count ? "var(--kind-objective)" : "var(--fill)",
            color: i < count ? "#0b1230" : "var(--ink-3)",
            scale: i === count - 1 ? [1, 1.15, 1] : 1,
          }}
          transition={{ duration: 0.35 }}
          style={{ boxShadow: "inset 0 0 0 1px var(--hairline)" }}
        >
          {i + 1}
        </motion.span>
      ))}
    </div>
  );
}

function Top3Picker({
  picked,
  setPicked,
  carryOverIds,
  openIds,
}: {
  picked: string[];
  setPicked: (ids: string[]) => void;
  carryOverIds: string[];
  openIds: string[];
}) {
  const { state } = useStore();
  const capture = useCapture();
  const why = useWhy();
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const carry = carryOverIds.map((id) => byId.get(id)!).filter(Boolean);
  const rest = openIds.filter((id) => !carryOverIds.includes(id)).map((id) => byId.get(id)!);

  const toggle = (id: string) => {
    if (picked.includes(id)) setPicked(picked.filter((x) => x !== id));
    else if (picked.length < 3) {
      setPicked([...picked, id]);
      tap(8);
    } else tap(30);
  };

  const row = (id: string) => {
    const t = byId.get(id)!;
    const n = picked.indexOf(id);
    const on = n >= 0;
    return (
      <motion.button
        key={id}
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => toggle(id)}
        aria-pressed={on}
        className={clsx("glass flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-shadow", on && "ring-2")}
        style={on ? ({ "--tw-ring-color": kindColor[t.kind] } as React.CSSProperties) : undefined}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs transition-colors"
          style={{ background: on ? kindColor[t.kind] : "transparent", boxShadow: on ? "none" : `inset 0 0 0 1.5px ${kindColor[t.kind]}`, color: "#0b1230" }}
        >
          {on ? n + 1 : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-ink">{t.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-3">
            <KindDot kind={t.kind} /> <span className="truncate">{why(t)}</span>
          </span>
        </span>
      </motion.button>
    );
  };

  return (
    <div className="mt-6 flex flex-col gap-5">
      {carry.length > 0 && (
        <div>
          <p className="eyebrow mb-2">{copy.morning.carryOver}</p>
          <div className="flex flex-col gap-2">{carry.map((t) => row(t.id))}</div>
        </div>
      )}
      <div>
        <p className="eyebrow mb-2">{copy.morning.fromList}</p>
        {rest.length === 0 && carry.length === 0 && <p className="text-ink-2">{copy.morning.nothingOpen}</p>}
        <div className="flex flex-col gap-2">{rest.map((t) => row(t.id))}</div>
        <button type="button" onClick={capture} className="mt-3 flex h-11 items-center gap-2 px-1 text-sm text-ink-2 hover:text-ink">
          <Plus size={16} /> {copy.capture.open}
        </button>
      </div>
    </div>
  );
}

function IntentionLine({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="serif mt-1 w-full bg-transparent text-[clamp(1.5rem,5.4vw,2rem)] italic leading-tight text-ink outline-none placeholder:not-italic placeholder:text-ink-3"
      />
    </label>
  );
}
