"use client";

import { CalendarCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useCopy } from "@/copy";
import { useStore } from "@/data/store";
import { PromotionForm } from "@/features/life/promotion-form";
import { MAX_ACTIVE_OBJECTIVES, objectiveRoom } from "@/domain/objectives";
import type { LeftoverChoice } from "@/domain/quarter-close";
import { LIFE_AREAS, type Dashboard } from "@/domain/quarterly-review";
import { GAUGE_KEYS, type Gauges, type OdysseyPlan } from "@/domain/types";
import { Button, GaugeDial } from "@/ui/controls";
import { Sheet } from "@/ui/sheet";

/** "2026-Q4" → "Q4 · 2026". */
export function quarterLabel(quarter: string): string {
  const [y, q] = quarter.split("-Q");
  return `Q${q} · ${y}`;
}

/**
 * The Quarterly Review on Today, at the start of a quarter; never blocking. In order: (in Q1 only)
 * rewriting the Compass, the Life
 * Dashboard, the plans' Gauges and the Active Plan, Quarter Close of last quarter's leftovers, one
 * question about a Decision, and "add one?". Each step is saved, so a reload picks up where it was.
 */
export function QuarterlyReviewCard() {
  const copy = useCopy();
  const { reviewQuarter, quarterStep } = useStore();
  const reduce = useReducedMotion();
  // The wrap-up runs here once reached; the review is marked complete as it starts.
  const [end, setEnd] = useState<"decision" | "addOne" | "closing" | "gone" | null>(null);
  const [switched, setSwitched] = useState(false);

  // Once complete the store has no quarter waiting; the wrap-up still shows until it is left.
  const [seen, setSeen] = useState(reviewQuarter);
  if (reviewQuarter && reviewQuarter !== seen) setSeen(reviewQuarter);
  const shown = reviewQuarter ?? (end ? seen : null);
  if (!shown || end === "gone") return null;
  if (quarterStep === "done" && !end) return null;
  const step = reviewQuarter ? quarterStep : "done";
  const label = quarterLabel(shown);

  return (
    <motion.section
      aria-label={copy.quarterReview.eyebrow(label)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-[24px] p-5"
    >
      <p className="eyebrow flex items-center gap-1.5">
        <CalendarCheck size={13} aria-hidden /> {copy.quarterReview.eyebrow(label)}
      </p>
      {step === "compass" && <CompassStep />}
      {step === "dashboard" && <DashboardStep />}
      {step === "plans" && <PlansStep onSwitched={() => setSwitched(true)} />}
      {step === "settle" && <SettleStep />}
      {(step === "wrapUp" || step === "done") && (
        <WrapUp stage={end ?? (switched ? "addOne" : "decision")} setStage={setEnd} label={label} />
      )}
    </motion.section>
  );
}

function Rating({ label, hint, value, before, onChange }: { label: string; hint?: string; value: number; before?: number | null; onChange: (v: number) => void }) {
  const copy = useCopy();
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          <span className="text-ink">{label}</span>
          {hint && <span className="block text-xs text-ink-3">{hint}</span>}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          {before != null && <span className="text-xs text-ink-3">{copy.quarterReview.lastTime(before)}</span>}
          <span className="tabular font-mono text-ink-2">{value}</span>
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--kind-objective)]"
      />
    </label>
  );
}

/** Once a year (the review of Q4): rewrite the Compass from blank, last year's words in view. */
function CompassStep() {
  const copy = useCopy();
  const { state, actions } = useStore();
  const [workview, setWorkview] = useState("");
  const [lifeview, setLifeview] = useState("");
  const old = state.compass;
  const box =
    "mt-2 w-full resize-none rounded-2xl bg-fill px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3";
  const halves = [
    { key: "workview", label: copy.life.workview, prompt: copy.life.workviewPrompt, value: workview, set: setWorkview, before: old?.workview },
    { key: "lifeview", label: copy.life.lifeview, prompt: copy.life.lifeviewPrompt, value: lifeview, set: setLifeview, before: old?.lifeview },
  ];
  return (
    <form
      className="mt-3 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        actions.reviewCompass({ workview, lifeview });
      }}
    >
      <div>
        <p className="serif text-2xl leading-tight">{copy.compassRewrite.title}</p>
        <p className="mt-1 text-sm text-ink-2">{copy.compassRewrite.body}</p>
      </div>
      {halves.map((h) => (
        <label key={h.key} className="block">
          <span className="eyebrow">{h.label}</span>
          {h.before && (
            <span className="mt-2 block border-l-2 border-hairline pl-3 text-sm italic text-ink-2">
              <span className="not-italic text-xs text-ink-3">{copy.compassRewrite.lastYear} · </span>
              {h.before}
            </span>
          )}
          <textarea value={h.value} onChange={(e) => h.set(e.target.value)} rows={3} placeholder={h.prompt} className={box} />
        </label>
      ))}
      <div className="flex flex-wrap justify-end gap-2">
        {old && (
          <Button type="button" variant="ghost" onClick={() => actions.reviewCompass(null)}>
            {copy.compassRewrite.keep}
          </Button>
        )}
        <Button type="submit" disabled={!workview.trim() || !lifeview.trim()}>
          {copy.compassRewrite.save}
        </Button>
      </div>
    </form>
  );
}

function DashboardStep() {
  const copy = useCopy();
  const { state, reviewQuarter, actions } = useStore();
  // Starts from last time's ratings, if there was a last time.
  const before = state.quarterReviews.find((r) => r.quarter < reviewQuarter!)?.dashboard;
  const [draft, setDraft] = useState<Record<keyof Dashboard, number>>(() =>
    Object.fromEntries(LIFE_AREAS.map((a) => [a, before?.[a] ?? 5])) as Record<keyof Dashboard, number>,
  );
  return (
    <form
      className="mt-3 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        actions.saveDashboard(draft);
      }}
    >
      <div>
        <p className="serif text-2xl leading-tight">{copy.quarterReview.dashboardTitle}</p>
        <p className="mt-1 text-sm text-ink-2">{copy.quarterReview.dashboardBody}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {LIFE_AREAS.map((a) => (
          <Rating
            key={a}
            label={copy.quarterReview.areas[a]}
            hint={copy.quarterReview.areaHints[a]}
            value={draft[a]}
            before={before?.[a]}
            onChange={(v) => setDraft({ ...draft, [a]: v })}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => actions.saveDashboard({ health: null, work: null, play: null, love: null })}>
          {copy.quarterReview.skip}
        </Button>
        <Button type="submit">{copy.quarterReview.next}</Button>
      </div>
    </form>
  );
}

function PlansStep({ onSwitched }: { onSwitched: () => void }) {
  const copy = useCopy();
  const { state, actions } = useStore();
  const written = state.plans.filter((p) => p.title.trim()).sort((a, b) => a.slot - b.slot);
  const [gauges, setGauges] = useState<Record<string, Gauges>>(() => Object.fromEntries(written.map((p) => [p.id, p.gauges])));
  const [promoting, setPromoting] = useState<OdysseyPlan | null>(null);
  const [rerating, setRerating] = useState<string | null>(null);
  const gaugesOf = (p: OdysseyPlan) => gauges[p.id] ?? p.gauges;

  // Re-rated Gauges travel with the step, so the review keeps exactly what was rated.
  const next = () =>
    actions.finishQuarterPlans(
      state.plans.flatMap((p) => {
        const g = gauges[p.id];
        return g && GAUGE_KEYS.some((k) => g[k] !== p.gauges[k]) ? [{ planId: p.id, gauges: g }] : [];
      }),
    );

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div>
        <p className="serif text-2xl leading-tight">{copy.quarterReview.plansTitle}</p>
        <p className="mt-1 text-sm text-ink-2">{written.length ? copy.quarterReview.plansBody : copy.quarterReview.noPlans}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {written.map((p) => (
          <li key={p.id} role="group" aria-label={p.title} className="rounded-2xl bg-fill px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{copy.life.planLabel(p.slot, copy.life.slotNames[p.slot])}</p>
                <p className="serif mt-1 text-lg leading-snug text-ink">{p.title}</p>
              </div>
              {p.isActive && (
                <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-[#0b1230]" style={{ background: "var(--kind-objective)" }}>
                  {copy.life.active}
                </span>
              )}
            </div>
            {rerating === p.id ? (
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {GAUGE_KEYS.map((k) => (
                  <Rating
                    key={k}
                    label={copy.life.gauges[k]}
                    value={gaugesOf(p)[k] ?? 5}
                    onChange={(v) => setGauges({ ...gauges, [p.id]: { ...gaugesOf(p), [k]: v } })}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-4 gap-1">
                {GAUGE_KEYS.map((k) => (
                  <GaugeDial key={k} value={gaugesOf(p)[k]} label={copy.life.gauges[k]} size={44} />
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {rerating !== p.id && (
                <Button size="sm" variant="ghost" onClick={() => setRerating(p.id)}>
                  {copy.quarterReview.rerate}
                </Button>
              )}
              {!p.isActive && (
                <Button size="sm" variant="glass" onClick={() => setPromoting(p)}>
                  {copy.quarterReview.switchTo}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button onClick={next}>{copy.quarterReview.next}</Button>
      </div>
      <Sheet open={!!promoting} onClose={() => setPromoting(null)} label={copy.life.changeActive}>
        {promoting && (
          <PromotionForm
            plan={promoting}
            onDone={(did) => {
              setPromoting(null);
              if (did) onSwitched();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

/** Quarter Close: each leftover Objective of last quarter gets Done / Drop / Carry forward. */
function SettleStep() {
  const copy = useCopy();
  const { state, quarter, leftoverObjectives, actions } = useStore();
  const reduce = useReducedMotion();
  const room = objectiveRoom(state.objectives, quarter);
  const pick = (id: string, choice: LeftoverChoice) => actions.settleLeftover(id, choice);

  return (
    <>
      <p className="serif mt-3 text-2xl leading-tight">{copy.quarterClose.title}</p>
      <p className="mt-1 text-sm text-ink-2">{copy.quarterClose.body}</p>
      <ul className="mt-4 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {leftoverObjectives.map((o) => {
            const open = state.tasks.filter((t) => t.objectiveId === o.id && !t.doneAt && !t.closedAt).length;
            return (
              <motion.li
                key={o.id}
                layout
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl bg-fill px-4 py-3"
              >
                <p className="text-[15px] font-medium text-ink">{o.title}</p>
                <p className="text-xs text-ink-3">{copy.quarterClose.openTasks(open)}</p>
                <div role="group" aria-label={o.title} className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="glass" onClick={() => pick(o.id, "done")}>
                    {copy.quarterClose.done}
                  </Button>
                  <Button size="sm" variant="glass" onClick={() => pick(o.id, "drop")}>
                    {copy.quarterClose.drop}
                  </Button>
                  <Button size="sm" variant="glass" disabled={room === 0} onClick={() => pick(o.id, "carry")}>
                    {copy.quarterClose.carry}
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {room === 0 && <p className="mt-3 text-xs text-ink-3">{copy.quarterClose.full}</p>}
    </>
  );
}

/** The Decision question (not asked again after a switch, which offered its own), then "add one?". */
function WrapUp({
  stage,
  setStage,
  label,
}: {
  stage: "decision" | "addOne" | "closing" | "gone";
  setStage: (s: "decision" | "addOne" | "closing" | "gone") => void;
  label: string;
}) {
  const copy = useCopy();
  const { state, quarter, actions } = useStore();
  const [decision, setDecision] = useState("");
  const [drivenBy, setDrivenBy] = useState("");
  const room = objectiveRoom(state.objectives, quarter);
  const end = room > 0 ? "addOne" : "closing";
  // Leaving the wrap-up by any way marks the review complete (a second call does nothing).
  const leave = (then: "addOne" | "closing" | "gone") => {
    actions.completeQuarterReview();
    setStage(then);
  };
  const shown = stage === "addOne" && room === 0 ? "closing" : stage;

  if (shown === "decision")
    return (
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          actions.addDecision({ decision: decision.trim(), drivenBy: drivenBy.trim(), linkedPlanId: null });
          leave(end);
        }}
      >
        <p className="serif text-2xl leading-tight">{copy.quarterClose.decisionQ}</p>
        <input
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          aria-label={copy.life.decisionPlaceholder}
          placeholder={copy.life.decisionPlaceholder}
          className="w-full rounded-2xl bg-fill px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3"
        />
        <textarea
          value={drivenBy}
          onChange={(e) => setDrivenBy(e.target.value)}
          rows={2}
          aria-label={copy.life.drivenBy}
          placeholder={copy.life.drivenByPlaceholder}
          className="w-full resize-none rounded-2xl bg-fill px-4 py-3 text-[15px] outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => leave(end)}>
            {copy.quarterClose.skip}
          </Button>
          <Button type="submit" disabled={!decision.trim()}>
            {copy.quarterClose.save}
          </Button>
        </div>
      </form>
    );

  if (shown === "addOne")
    return (
      <div className="mt-3">
        <p className="serif text-2xl leading-tight">{copy.quarterClose.addOneQ(MAX_ACTIVE_OBJECTIVES - room)}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => leave("gone")}>
            {copy.quarterClose.later}
          </Button>
          <Link
            href="/life"
            onClick={() => actions.completeQuarterReview()}
            className="inline-flex h-11 items-center rounded-full bg-solid px-5 text-sm font-medium text-solid-ink"
          >
            {copy.quarterClose.addOne}
          </Link>
        </div>
      </div>
    );

  return (
    <div className="mt-3">
      <p className="serif text-2xl leading-tight">{copy.quarterReview.closing(label)}</p>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => leave("gone")}>{copy.quarterReview.finish}</Button>
      </div>
    </div>
  );
}
