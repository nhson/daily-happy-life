"use client";

import { ArrowRight, Star } from "lucide-react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCopy } from "@/copy";
import { useStore } from "@/data/store";
import { Button } from "@/ui/controls";
import { AppMark } from "@/ui/glyphs";
import { useSky } from "@/ui/sky";

/** Pre-dawn → sunrise: each step brightens the sky. Minutes of day per step. */
const DAWN = [255, 290, 325, 360, 395];
const SUNRISE = 480;

export function FirstRun() {
  const copy = useCopy();
  const { actions } = useStore();
  const { setOverride } = useSky();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [workview, setWorkview] = useState("");
  const [lifeview, setLifeview] = useState("");
  const [objective, setObjective] = useState("");
  const [tasks, setTasks] = useState(["", "", ""]);
  /** "Which of these is for today?" — all picked unless the user taps one off. */
  const [notToday, setNotToday] = useState<number[]>([]);
  const [rising, setRising] = useState(false);

  useEffect(() => {
    if (!rising) setOverride(DAWN[step]);
  }, [step, rising, setOverride]);
  useEffect(() => () => setOverride(null), [setOverride]);

  const finish = () => {
    actions.completeOnboarding({
      compass: { workview: workview.trim(), lifeview: lifeview.trim() },
      objective,
      tasks: tasks.map((title, i) => ({ title, today: !notToday.includes(i) })),
    });
    setRising(true);
    // Walk the sky up to sunrise, then hand over to the real clock.
    let m = DAWN[DAWN.length - 1];
    const id = setInterval(() => {
      m += 15;
      setOverride(m);
      if (m >= SUNRISE) {
        clearInterval(id);
        setTimeout(() => {
          setOverride(null);
          router.replace("/today");
        }, reduce ? 300 : 1800);
      }
    }, reduce ? 20 : 320);
  };

  const LAST = 4;
  const canNext = [true, !!(workview.trim() && lifeview.trim()), !!objective.trim(), tasks.some((t) => t.trim()), true][step];
  const filled = tasks.map((t, i) => ({ t: t.trim(), i })).filter((x) => x.t);
  const slide = { initial: { opacity: 0, y: 24, filter: "blur(6px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -24, filter: "blur(6px)" } };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),24px)]">
      <div className="flex items-center justify-between">
        <AppMark size={30} />
        {step > 0 && !rising && (
          <ol className="flex gap-4 text-xs" aria-label={copy.common.progress}>
            {copy.welcome.steps.map((s, i) => (
              <li key={s} className={i + 1 <= step ? "text-ink" : "text-ink-3"}>
                {s}
              </li>
            ))}
          </ol>
        )}
      </div>

      <AnimatePresence mode="wait">
        {rising ? (
          <motion.div key="rise" {...slide} transition={{ duration: 0.8 }} className="flex flex-1 flex-col justify-center">
            <p className="serif text-[clamp(2.6rem,10vw,4.4rem)] leading-[1.02]">{workview.trim() || lifeview.trim()}</p>
          </motion.div>
        ) : (
          <motion.form
            key={step}
            {...slide}
            transition={{ duration: 0.5 }}
            className="flex flex-1 flex-col justify-center gap-8 py-10"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canNext) return;
              if (step < LAST) setStep(step + 1);
              else finish();
            }}
          >
            {step === 0 && (
              <div>
                <h1 className="serif text-[clamp(2.8rem,11vw,4.6rem)] leading-[1]">{copy.welcome.hello}</h1>
                <p className="mt-5 max-w-md text-lg text-ink-2">{copy.welcome.helloBody}</p>
              </div>
            )}
            {step === 1 && (
              <div className="flex flex-col gap-8">
                <Field q={copy.welcome.workviewQ} ex={copy.welcome.workviewEx} value={workview} onChange={setWorkview} autoFocus />
                <Field q={copy.welcome.lifeviewQ} ex={copy.welcome.lifeviewEx} value={lifeview} onChange={setLifeview} />
              </div>
            )}
            {step === 2 && <Field q={copy.welcome.objectiveQ} ex={copy.welcome.objectiveEx} value={objective} onChange={setObjective} autoFocus />}
            {step === 3 && (
              <div>
                <p className="serif text-[clamp(1.8rem,6.4vw,2.4rem)] leading-tight">{copy.welcome.tasksQ}</p>
                <p className="mt-2 text-sm text-ink-3">→ {objective}</p>
                <div className="mt-6 flex flex-col gap-2">
                  {tasks.map((t, i) => (
                    <input
                      key={i}
                      autoFocus={i === 0}
                      value={t}
                      onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={copy.common.step(i + 1)}
                      aria-label={copy.common.step(i + 1)}
                      className="glass h-14 rounded-2xl px-5 text-[16px] text-ink outline-none placeholder:text-ink-3"
                    />
                  ))}
                </div>
              </div>
            )}
            {step === 4 && (
              <div>
                <p className="serif text-[clamp(1.8rem,6.4vw,2.4rem)] leading-tight">{copy.welcome.todayQ}</p>
                <p className="mt-2 text-sm text-ink-3">{copy.welcome.todayHint}</p>
                <div className="mt-6 flex flex-col gap-2">
                  {filled.map(({ t, i }) => {
                    const on = !notToday.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setNotToday((cur) => (on ? [...cur, i] : cur.filter((x) => x !== i)))}
                        className={clsx("glass flex min-h-14 items-center gap-3 rounded-2xl px-5 py-3 text-left transition-opacity", !on && "opacity-60")}
                      >
                        <Star
                          size={20}
                          strokeWidth={1.8}
                          aria-hidden
                          className="shrink-0"
                          fill={on ? "var(--kind-objective)" : "none"}
                          color={on ? "var(--kind-objective)" : "currentColor"}
                        />
                        <span className="line-clamp-2 min-w-0 flex-1 text-[16px] text-ink">{t}</span>
                      </button>
                    );
                  })}
                </div>
                {filled.every(({ i }) => notToday.includes(i)) && <p className="mt-3 text-sm text-ink-3">{copy.welcome.todayNone}</p>}
              </div>
            )}
            <div className="flex items-center justify-between">
              {step > 0 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="h-11 px-1 text-sm text-ink-2">
                  {copy.common.back}
                </button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" disabled={!canNext}>
                {step === 0 ? copy.welcome.start : step === LAST ? copy.welcome.finish : copy.welcome.next} <ArrowRight size={18} />
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ q, ex, value, onChange, autoFocus }: { q: string; ex: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const copy = useCopy();
  const [showEx, setShowEx] = useState(false);
  return (
    <label className="block">
      <span className="serif block text-[clamp(1.8rem,6.4vw,2.4rem)] leading-tight">{q}</span>
      <textarea
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="glass mt-4 w-full resize-none rounded-2xl px-5 py-4 text-lg leading-snug text-ink outline-none placeholder:text-ink-3"
        placeholder={copy.welcome.sentencePlaceholder}
      />
      {showEx ? (
        <span className="serif mt-2 block text-lg italic text-ink-2">“{ex}”</span>
      ) : (
        <button type="button" onClick={() => setShowEx(true)} className="mt-2 h-9 text-sm text-ink-3 hover:text-ink">
          {copy.welcome.showExample}
        </button>
      )}
    </label>
  );
}
