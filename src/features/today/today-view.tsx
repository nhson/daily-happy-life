"use client";

import { ArrowRight, Moon, Pencil, Sunrise } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCopy, useFormatDate } from "@/copy";
import { useStore } from "@/data/store";
import { dueStatus } from "@/domain/task-rules";
import { TaskList } from "@/features/tasks/task-list";
import { Button, ShareBar, WeekDots } from "@/ui/controls";
import { KindDot, MeaningGlyph, meaningColor } from "@/ui/glyphs";
import { Sheet } from "@/ui/sheet";
import { CheckInForm } from "./checkin-sheet";
import { CompassHero } from "./compass-hero";
import { MorningFlow } from "./morning-flow";
import { TasksPanel } from "@/features/tasks/tasks-panel";
import { TodayOnboardingCard } from "@/features/onboarding/today-card";
import { QuarterCloseCard } from "./quarter-close";


export function TodayView() {
  const formatDate = useFormatDate();
  const copy = useCopy();
  const store = useStore();
  const { now, today, mode, compassLine, top3, open, dots, share, log } = store;
  const [flowOpen, setFlowOpen] = useState(mode === "morning");
  // The ritual that opens by itself may first ask to close yesterday; opened by hand, it doesn't.
  const [autoFlow, setAutoFlow] = useState(mode === "morning");
  const [checkIn, setCheckIn] = useState(false);
  const allTop3Done = top3.length > 0 && top3.every((t) => t.doneAt);
  const checked = dots.filter((d) => d.checkedIn).length;

  // The check-in sheet rises by itself once per evening.
  useEffect(() => {
    if (mode !== "evening") return;
    const key = `dhl:auto-checkin:${today}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {}
    // Mark as shown only when it actually opens (effects run twice in dev).
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
      setCheckIn(true);
    }, 900);
    return () => clearTimeout(t);
  }, [mode, today]);

  // Due today or overdue shows on Today (never added to the Top 3 by itself).
  const due = open.filter((t) => t.top3Date !== today && (dueStatus(t, today) === "today" || dueStatus(t, today) === "overdue"));
  const rest = open.filter((t) => t.top3Date !== today && !due.includes(t)).slice(0, 4);

  return (
    <>
      <AnimatePresence>
        {flowOpen && (
          <MorningFlow
            offerYesterday={autoFlow}
            onClose={() => {
              setFlowOpen(false);
              setAutoFlow(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:pt-6 [&>*]:min-w-0">
        <motion.div
          className="flex flex-col gap-8"
          animate={{ opacity: flowOpen ? 0 : 1, y: flowOpen ? 16 : 0 }}
          transition={{ duration: 0.6, delay: flowOpen ? 0 : 0.2 }}
        >
          <header className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0">
              <p className="eyebrow whitespace-nowrap">{/* Short month keeps the header on one line beside the week dots on a phone. */}
              {formatDate(now, { weekday: "long", day: "numeric", month: "short" })}</p>
            </div>
            <div className="flex items-center gap-3">
              <WeekDots dots={dots} label={copy.today.weekLabel(checked)} />
              <Link href="/settings" aria-label={copy.settings.title} className="glass hit relative grid size-9 place-items-center rounded-full text-xs font-medium lg:hidden">
                S
              </Link>
            </div>
          </header>

          {mode !== "night" ? (
            <section className="pt-4 lg:pt-10">
              <CompassHero line={compassLine} size={mode === "evening" ? "md" : "lg"} glow={allTop3Done} />
            </section>
          ) : (
            <NightSummary />
          )}

          <QuarterCloseCard />
          <TodayOnboardingCard />

          {mode === "evening" && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="serif text-2xl leading-tight">{copy.today.eveningTitle}</p>
                  <p className="text-sm text-ink-2">{copy.today.checkInHint}</p>
                </div>
                <Button onClick={() => setCheckIn(true)}>
                  <Moon size={16} /> {copy.today.checkIn}
                </Button>
              </div>
              <LifeShareRow share={share} />
            </motion.section>
          )}

          {mode !== "night" && (
            <section aria-labelledby="top3-h">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="top3-h" className="eyebrow">
                  {copy.today.top3}
                </h2>
                {mode !== "evening" && (
                  <button type="button" onClick={() => setFlowOpen(true)} className="hit relative flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
                    <Sunrise size={13} /> {copy.today.ritual}
                  </button>
                )}
              </div>
              {top3.length ? (
                <TaskList tasks={top3} />
              ) : (
                <button type="button" onClick={() => setFlowOpen(true)} className="glass flex h-14 w-full items-center justify-between rounded-2xl px-5 text-ink-2">
                  {copy.today.chooseTop3} <ArrowRight size={16} />
                </button>
              )}
            </section>
          )}

          {mode !== "night" && due.length > 0 && (
            <section aria-labelledby="due-h">
              <h2 id="due-h" className="eyebrow mb-3">
                {copy.today.due}
              </h2>
              <TaskList tasks={due} />
            </section>
          )}

          {mode !== "night" && mode !== "evening" && <IntentionCard />}

          {mode !== "night" && rest.length > 0 && (
            <section className="lg:hidden">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="eyebrow">{copy.today.alsoOpen}</h2>
                <Link href="/tasks" className="hit relative text-xs text-ink-3 hover:text-ink">
                  {copy.today.allTasks} →
                </Link>
              </div>
              <TaskList tasks={rest} />
            </section>
          )}

          {log.closedAt && (
            <button type="button" onClick={store.actions.reopenDay} className="self-start text-xs text-ink-3 hover:text-ink">
              {copy.today.reopen}
            </button>
          )}
        </motion.div>

        {/* Desktop: Tasks beside Today */}
        <motion.aside
          className="hidden lg:block"
          animate={{ opacity: flowOpen ? 0 : 1 }}
          transition={{ duration: 0.6, delay: flowOpen ? 0 : 0.35 }}
          aria-hidden={flowOpen || undefined}
        >
          <div className="sticky top-24">
            <p className="mb-3 hidden text-xs text-ink-3 xl:block">/ to search · j / k to move · x to complete · t for Top 3</p>
            <TasksPanel keyboard={!flowOpen} />
          </div>
        </motion.aside>
      </div>

      <Sheet open={checkIn} onClose={() => setCheckIn(false)} label={copy.checkIn.title}>
        {checkIn && <CheckInForm onClosed={() => setCheckIn(false)} />}
      </Sheet>
    </>
  );
}

function IntentionCard() {
  const copy = useCopy();
  const { log } = useStore();
  const [flow, setFlow] = useState(false);
  return (
    <section aria-labelledby="intent-h">
      <h2 id="intent-h" className="eyebrow mb-3">
        {copy.today.intention}
      </h2>
      {log.intention ? (
        <div className="glass group relative rounded-[24px] px-5 py-4">
          <p className="serif text-[22px] leading-snug pr-8">
            <span className="text-ink-3">{copy.morning.when} </span>
            <em>{log.intention.when}</em>
            <span className="text-ink-3">, {copy.morning.then} </span>
            <em>{log.intention.then}</em>.
          </p>
          <button type="button" onClick={() => setFlow(true)} aria-label={copy.today.editIntention} className="hit absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink-3 hover:text-ink">
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setFlow(true)} className="glass flex h-14 w-full items-center justify-between rounded-2xl px-5 text-ink-2">
          {copy.today.addIntention} <ArrowRight size={16} />
        </button>
      )}
      <IntentionSheet open={flow} onClose={() => setFlow(false)} />
    </section>
  );
}

function IntentionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useCopy();
  return (
    <Sheet open={open} onClose={onClose} label={copy.today.intention}>
      {open && <IntentionForm onClose={onClose} />}
    </Sheet>
  );
}

function IntentionForm({ onClose }: { onClose: () => void }) {
  const copy = useCopy();
  const { log, actions } = useStore();
  const [when, setWhen] = useState(log.intention?.when ?? "");
  const [then, setThen] = useState(log.intention?.then ?? "");
  return (
      <form
        className="flex flex-col gap-5 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          actions.setIntention(when.trim() && then.trim() ? { when: when.trim(), then: then.trim() } : null);
          onClose();
        }}
      >
        <h2 className="serif text-3xl">{copy.morning.intentionTitle}</h2>
        {(
          [
            [copy.morning.when, when, setWhen, copy.morning.whenPlaceholder],
            [copy.morning.then, then, setThen, copy.morning.thenPlaceholder],
          ] as const
        ).map(([label, v, set, ph]) => (
          <label key={label} className="block">
            <span className="eyebrow">{label}</span>
            <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="serif mt-1 w-full bg-transparent text-2xl italic text-ink outline-none placeholder:not-italic placeholder:text-ink-3" />
          </label>
        ))}
        <Button type="submit" size="lg">
          {copy.morning.set}
        </Button>
      </form>
  );
}

function LifeShareRow({ share }: { share: ReturnType<typeof useStore>["share"] }) {
  const copy = useCopy();
  return (
    <div className="mt-5">
      <p className="eyebrow mb-2.5">{copy.today.lifeShare}</p>
      {share.total > 0 ? (
        <>
          <ShareBar percent={share.percent} />
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            {(["objective", "prototype", "maintenance"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
                <KindDot kind={k} />
                <span className="tabular font-mono text-ink">{share.percent[k]}%</span> {copy.today.shareLabels[k]}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3">{copy.today.lifeShareEmpty}</p>
      )}
    </div>
  );
}

function NightSummary() {
  const copy = useCopy();
  const { log, share, compassLine } = useStore();
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} className="flex flex-col gap-8 pt-6 lg:pt-12">
      <div>
        <p className="serif text-[clamp(2.4rem,9vw,4rem)] leading-[1.02]">{copy.today.dayClosed}</p>
        <p className="mt-3 text-ink-2">{copy.today.rest}</p>
      </div>

      <div className="glass grid grid-cols-2 gap-5 rounded-[28px] p-5">
        <Meter label={copy.checkIn.energy} value={log.energy} />
        <Meter label={copy.checkIn.engagement} value={log.engagement} />
        {log.meaningSources.length > 0 && (
          <div className="col-span-2 flex flex-wrap gap-3">
            {log.meaningSources.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-sm" style={{ color: meaningColor[s] }}>
                <MeaningGlyph source={s} size={22} filled />
                <span className="text-ink">{copy.meaning[s].name}</span>
              </span>
            ))}
          </div>
        )}
        {log.note && <p className="serif col-span-2 text-xl italic leading-snug text-ink">“{log.note}”</p>}
        <div className="col-span-2">
          <LifeShareRow share={share} />
        </div>
      </div>

      <div className="opacity-70">
        <p className="eyebrow mb-2">{copy.today.todaysLine}</p>
        <CompassHero line={compassLine} size="md" />
      </div>
    </motion.section>
  );
}

function Meter({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="h-1.5 flex-1 rounded-full" style={{ background: value && n <= value ? "var(--kind-objective)" : "var(--hairline)" }} />
        ))}
      </div>
    </div>
  );
}
