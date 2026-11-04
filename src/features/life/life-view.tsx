"use client";

import { clsx } from "clsx";
import { Check, Pencil, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/copy/en";
import { MINDSETS } from "@/domain/mindsets";
import { GAUGE_KEYS, type OdysseyPlan } from "@/domain/types";
import { useStore } from "@/data/mock-store";
import { Button, Chip, GaugeDial } from "@/ui/controls";
import { KindDot, kindColor } from "@/ui/glyphs";
import { Sheet } from "@/ui/sheet";
import { Tip } from "@/ui/tip";
import { useToast } from "@/ui/toast";

export function LifeView() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-16 pt-4 lg:pt-8">
      <header>
        <h1 className="serif text-[clamp(2.6rem,9vw,4.2rem)] leading-none">{copy.life.title}</h1>
        <p className="mt-2 text-ink-2">{copy.life.subtitle}</p>
        <LifeTip />
      </header>
      <CompassSection />
      <OdysseySection />
      <ObjectivesSection />
      <DecisionsSection />
    </div>
  );
}

function LifeTip() {
  const { tipUnseen, actions } = useStore();
  return (
    <div className="mt-6 max-w-xl empty:hidden">
      <Tip show={tipUnseen("life")} onDismiss={() => actions.dismissTip("life")}>
        {copy.tips.life}
      </Tip>
    </div>
  );
}

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="serif text-[32px] leading-none">{title}</h2>
        {hint && <p className="mt-1.5 text-sm text-ink-2">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Compass ─────────────────────────────────────────────────

function CompassSection() {
  const { state, actions } = useStore();
  const compass = state.compass ?? { workview: "", lifeview: "" };
  return (
    <section aria-label={copy.life.compass}>
      <SectionHead title={copy.life.compass} />
      <div className="grid gap-4 md:grid-cols-2">
        <ViewCard label={copy.life.workview} prompt={copy.life.workviewPrompt} value={compass.workview} onSave={(workview) => actions.updateCompass({ ...compass, workview })} />
        <ViewCard label={copy.life.lifeview} prompt={copy.life.lifeviewPrompt} value={compass.lifeview} onSave={(lifeview) => actions.updateCompass({ ...compass, lifeview })} />
      </div>
      <p className="eyebrow mb-3 mt-8">{copy.life.mindsets}</p>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5">
        {MINDSETS.map((m, i) => (
          <div key={m.key} className="glass w-56 shrink-0 snap-start rounded-[22px] p-4 lg:w-auto">
            <p className="tabular font-mono text-[11px] text-ink-3">0{i + 1}</p>
            <p className="mt-1 text-sm font-medium">{m.name}</p>
            <p className="serif mt-2 text-lg leading-snug text-ink-2">{m.line}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ViewCard({ label, prompt, value, onSave }: { label: string; prompt: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="glass relative flex min-h-48 flex-col rounded-[28px] p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            aria-label={`Edit ${label}`}
            className="-m-2 grid size-10 place-items-center rounded-full text-ink-3 hover:text-ink"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="mt-3 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft.trim());
            setEditing(false);
          }}
        >
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={prompt}
            rows={4}
            className="serif flex-1 resize-none bg-transparent text-2xl leading-snug text-ink outline-none placeholder:text-ink-3"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      ) : value ? (
        <p className="serif mt-3 text-[clamp(1.4rem,4.4vw,1.75rem)] leading-snug">{value}</p>
      ) : (
        <p className="serif mt-3 text-2xl leading-snug text-ink-3">{prompt}</p>
      )}
    </div>
  );
}

// ── Odyssey ─────────────────────────────────────────────────

function OdysseySection() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<OdysseyPlan | null>(null);
  const [promoting, setPromoting] = useState<OdysseyPlan | null>(null);
  const section = useRef<HTMLElement>(null);

  // An Odyssey nudge on Today links here as /life?plan=N: open that plan's editor.
  useEffect(() => {
    const slot = Number(new URLSearchParams(window.location.search).get("plan"));
    const plan = state.plans.find((p) => p.slot === slot);
    if (!plan) return;
    section.current?.scrollIntoView({ block: "start" });
    // Clear ?plan only when the editor actually opens, so a re-run effect still finds it.
    const t = setTimeout(() => {
      window.history.replaceState(null, "", window.location.pathname);
      setEditing(plan);
    }, 350);
    return () => clearTimeout(t);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promote = (p: OdysseyPlan) => {
    if (actions.openPrototypesOf(p.id).length) setPromoting(p);
    else {
      actions.setActivePlan(p.id, null);
      toast(`“${p.title}” is now your Active Plan.`);
    }
  };

  return (
    <section ref={section} aria-label={copy.life.odyssey} className="scroll-mt-6">
      <SectionHead title={copy.life.odyssey} hint={copy.life.odysseyHint} />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {state.plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            prototypes={state.tasks.filter((t) => t.prototypePlanId === p.id && !t.doneAt && !t.closedAt).length}
            onEdit={() => setEditing(p)}
            onPromote={() => promote(p)}
          />
        ))}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} label="Edit plan">
        {editing && (
          <PlanEditor
            plan={editing}
            onSave={(p) => {
              actions.savePlan(p);
              setEditing(null);
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!promoting} onClose={() => setPromoting(null)} label="Change Active Plan">
        {promoting && <PromotionForm plan={promoting} onDone={() => setPromoting(null)} />}
      </Sheet>
    </section>
  );
}

function PlanCard({ plan, prototypes, onEdit, onPromote }: { plan: OdysseyPlan; prototypes: number; onEdit: () => void; onPromote: () => void }) {
  const written = !!plan.title;
  const slotName = plan.slot === 1 ? "Current path" : plan.slot === 2 ? "Plan B" : "Wild card";

  if (!written)
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-[22rem] w-[82vw] max-w-sm shrink-0 snap-center flex-col rounded-[30px] border-[1.5px] border-dashed border-ink-3/50 p-6 text-left transition-colors hover:bg-fill lg:w-auto lg:max-w-none"
      >
        <p className="eyebrow">
          Plan {plan.slot} · {slotName}
        </p>
        <p className="serif mt-auto text-[28px] leading-tight text-ink-2">{copy.life.planPrompts[plan.slot]}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium">
          <Plus size={16} /> {copy.life.writePlan}
        </span>
      </button>
    );

  return (
    <motion.article
      layout
      className={clsx("glass relative flex min-h-[22rem] w-[82vw] max-w-sm shrink-0 snap-center flex-col rounded-[30px] p-6 lg:w-auto lg:max-w-none")}
      style={
        plan.isActive
          ? { boxShadow: "var(--shadow), 0 0 0 1.5px color-mix(in oklab, var(--kind-objective) 80%, transparent), 0 0 60px -10px color-mix(in oklab, var(--kind-objective) 60%, transparent)" }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow">
          Plan {plan.slot} · {slotName}
        </p>
        {plan.isActive ? (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[#0b1230]" style={{ background: "var(--kind-objective)" }}>
            {copy.life.active}
          </span>
        ) : (
          prototypes > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-ink-2">
              <KindDot kind="prototype" /> {copy.life.prototypes(prototypes)}
            </span>
          )
        )}
      </div>
      <h3 className="serif mt-5 text-[30px] leading-[1.05]">{plan.title}</h3>
      {plan.questions && <p className="mt-3 text-sm leading-relaxed text-ink-2">{plan.questions}</p>}
      <div className="mt-auto grid grid-cols-4 gap-1 pt-6">
        {GAUGE_KEYS.map((k) => (
          <GaugeDial key={k} value={plan.gauges[k]} label={copy.life.gauges[k]} size={52} />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={onEdit} className="flex h-10 items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <Pencil size={14} /> Edit
        </button>
        {!plan.isActive && (
          <Button size="sm" variant="glass" onClick={onPromote}>
            {copy.life.makeActive}
          </Button>
        )}
      </div>
    </motion.article>
  );
}

function PlanEditor({ plan, onSave }: { plan: OdysseyPlan; onSave: (p: OdysseyPlan) => void }) {
  const [draft, setDraft] = useState(plan);
  const words = draft.title.trim() ? draft.title.trim().split(/\s+/).length : 0;
  return (
    <form
      className="flex flex-col gap-6 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...draft, title: draft.title.trim(), questions: draft.questions.trim() });
      }}
    >
      <p className="serif text-xl leading-snug text-ink-2">{copy.life.planPrompts[plan.slot]}</p>
      <label className="block">
        <span className="flex justify-between">
          <span className="eyebrow">Six-word title</span>
          <span className={clsx("tabular font-mono text-xs", words === 6 ? "text-ink" : "text-ink-3")}>{words}/6</span>
        </span>
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Small studio, big outdoors, slow mornings"
          className="serif mt-1 w-full bg-transparent text-[28px] leading-tight text-ink outline-none placeholder:text-ink-3"
        />
      </label>
      <label className="block">
        <span className="eyebrow">Questions it tests</span>
        <textarea
          value={draft.questions}
          onChange={(e) => setDraft({ ...draft, questions: e.target.value })}
          rows={2}
          placeholder="What would you need to find out?"
          className="mt-2 w-full resize-none rounded-2xl bg-fill px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {GAUGE_KEYS.map((k) => (
          <label key={k} className="block">
            <span className="flex justify-between text-sm">
              <span>{copy.life.gauges[k]}</span>
              <span className="tabular font-mono text-ink-2">{draft.gauges[k] ?? "–"}</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              value={draft.gauges[k] ?? 5}
              onChange={(e) => setDraft({ ...draft, gauges: { ...draft.gauges, [k]: Number(e.target.value) } })}
              className="mt-2 w-full accent-[var(--kind-objective)]"
            />
          </label>
        ))}
      </div>
      <Button type="submit" size="lg" disabled={!draft.title.trim()}>
        Save plan
      </Button>
    </form>
  );
}

function PromotionForm({ plan, onDone }: { plan: OdysseyPlan; onDone: () => void }) {
  const { actions } = useStore();
  const toast = useToast();
  const affected = actions.openPrototypesOf(plan.id);
  const [name, setName] = useState(plan.title);
  return (
    <div className="flex flex-col gap-5 py-2">
      <h2 className="serif text-3xl leading-tight">{copy.promotion.title(plan.title)}</h2>
      <p className="text-ink-2">{copy.promotion.body}</p>
      <ul className="flex flex-col gap-1.5">
        {affected.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <KindDot kind="prototype" /> {t.title}
          </li>
        ))}
      </ul>
      <label className="block">
        <span className="eyebrow">{copy.promotion.objectiveName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-2xl bg-fill px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-hairline focus:ring-ink-3"
        />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          size="lg"
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            actions.setActivePlan(plan.id, { fold: name.trim() });
            toast(`“${plan.title}” is now your Active Plan.`);
            onDone();
          }}
        >
          {copy.promotion.convert}
        </Button>
        <Button
          size="lg"
          variant="glass"
          className="flex-1"
          onClick={() => {
            actions.setActivePlan(plan.id, "close");
            toast(`“${plan.title}” is now your Active Plan.`);
            onDone();
          }}
        >
          {copy.promotion.close}
        </Button>
      </div>
    </div>
  );
}

// ── Objectives ──────────────────────────────────────────────

function ObjectivesSection() {
  const { state, activeObjectives, quarter, actions } = useStore();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const all = state.objectives.filter((o) => o.quarter === quarter);

  return (
    <section aria-label={copy.life.objectives}>
      <SectionHead
        title={copy.life.objectives}
        hint={`${quarter.replace("-", " · ")} — ${copy.life.objectivesHint}`}
        action={<span className="tabular font-mono text-xs text-ink-3">{activeObjectives.length}/5</span>}
      />
      <ul className="flex flex-col gap-3">
        {all.map((o) => {
          const tasks = state.tasks.filter((t) => t.objectiveId === o.id && !t.closedAt);
          const done = tasks.filter((t) => t.doneAt).length;
          const pct = tasks.length ? done / tasks.length : 0;
          return (
            <li key={o.id} className={clsx("glass flex items-center gap-4 rounded-[24px] px-5 py-4", o.status !== "active" && "opacity-60")}>
              <Ring pct={pct} />
              <div className="min-w-0 flex-1">
                <p className={clsx("text-[15px] leading-snug", o.status === "dropped" && "line-through")}>{o.title}</p>
                <p className="tabular mt-0.5 font-mono text-xs text-ink-3">
                  {done}/{tasks.length} tasks{o.status !== "active" ? ` · ${o.status}` : ""}
                </p>
              </div>
              {o.status === "active" ? (
                <div className="flex gap-1">
                  <IconButton label={`Mark “${o.title}” done`} onClick={() => actions.setObjectiveStatus(o.id, "done")}>
                    <Check size={16} />
                  </IconButton>
                  <IconButton label={`Drop “${o.title}”`} onClick={() => actions.setObjectiveStatus(o.id, "dropped")}>
                    <X size={16} />
                  </IconButton>
                </div>
              ) : (
                <button type="button" onClick={() => actions.setObjectiveStatus(o.id, "active")} className="h-9 px-2 text-xs text-ink-3 hover:text-ink">
                  Undo
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {activeObjectives.length < 5 &&
        (adding ? (
          <form
            className="glass mt-3 flex items-center gap-2 rounded-[24px] py-2 pl-5 pr-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              actions.addObjective(draft);
              setDraft("");
              setAdding(false);
            }}
          >
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="True by the end of this quarter…" className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-3" />
            <Button size="sm" type="submit" disabled={!draft.trim()}>
              Add
            </Button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-3 flex h-11 items-center gap-2 px-1 text-sm text-ink-2 hover:text-ink">
            <Plus size={16} /> {copy.life.addObjective}
          </button>
        ))}
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90 shrink-0" aria-hidden>
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--hairline)" strokeWidth="3" />
      <motion.circle
        cx="19"
        cy="19"
        r={r}
        fill="none"
        stroke={kindColor.objective}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${c * pct} ${c}` }}
        transition={{ type: "spring", stiffness: 70, damping: 16 }}
      />
    </svg>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-10 place-items-center rounded-full text-ink-3 transition-colors hover:bg-fill hover:text-ink">
      {children}
    </button>
  );
}

// ── Decisions ───────────────────────────────────────────────

function DecisionsSection() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={copy.life.decisions}>
      <SectionHead
        title={copy.life.decisions}
        hint={copy.life.decisionsHint}
        action={
          <Button size="sm" variant="glass" onClick={() => setOpen(true)}>
            <Plus size={15} /> {copy.life.logDecision}
          </Button>
        }
      />
      {state.decisions.length === 0 ? (
        <p className="serif text-2xl text-ink-3">The first one is usually small.</p>
      ) : (
        <ol className="relative ml-2 border-l border-hairline pl-6">
          {state.decisions.map((d) => {
            const plan = state.plans.find((p) => p.id === d.linkedPlanId);
            return (
              <li key={d.id} className="relative pb-8 last:pb-0">
                <span className="absolute -left-[31px] top-1.5 size-2.5 rounded-full bg-ink ring-4 ring-[color:var(--glass)]" aria-hidden />
                <p className="tabular font-mono text-xs text-ink-3">
                  {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p className="serif mt-1 text-2xl leading-snug">{d.decision}</p>
                {d.drivenBy && <p className="mt-1 text-sm text-ink-2">{d.drivenBy}</p>}
                {plan?.title && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-3">
                    <span className="size-1.5 rounded-full bg-ink-3" /> {plan.title}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} label={copy.life.logDecision}>
        {open && <DecisionForm onDone={() => setOpen(false)} />}
      </Sheet>
    </section>
  );
}

function DecisionForm({ onDone }: { onDone: () => void }) {
  const { state, actions } = useStore();
  const [decision, setDecision] = useState("");
  const [drivenBy, setDrivenBy] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-5 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        actions.addDecision({ decision: decision.trim(), drivenBy: drivenBy.trim(), linkedPlanId: planId });
        onDone();
      }}
    >
      <input autoFocus value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What did you decide?" className="serif w-full bg-transparent text-[28px] leading-tight outline-none placeholder:text-ink-3" />
      <label className="block">
        <span className="eyebrow">{copy.life.drivenBy}</span>
        <textarea value={drivenBy} onChange={(e) => setDrivenBy(e.target.value)} rows={2} placeholder="Your Lifeview, a gauge, a prototype that taught you something…" className="mt-2 w-full resize-none rounded-2xl bg-fill px-4 py-3 text-[15px] outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3" />
      </label>
      <div className="flex flex-wrap gap-2">
        {state.plans
          .filter((p) => p.title)
          .map((p) => (
            <Chip key={p.id} selected={planId === p.id} onClick={() => setPlanId(planId === p.id ? null : p.id)}>
              {p.title}
            </Chip>
          ))}
      </div>
      <Button type="submit" size="lg" disabled={!decision.trim()}>
        {copy.life.logDecision}
      </Button>
    </form>
  );
}
