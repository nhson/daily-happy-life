"use client";

import { clsx } from "clsx";
import { Check, Feather, HeartHandshake, Milestone, Palette, Pencil, Plus, Sparkles, Sunrise, X, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useCopy, useFormatDate } from "@/copy";
import { MINDSET_KEYS, type MindsetKey } from "@/domain/mindsets";
import { GAUGE_KEYS, type OdysseyPlan } from "@/domain/types";
import { useStore } from "@/data/mock-store";
import { Button, Chip, GaugeDial } from "@/ui/controls";
import { KindDot } from "@/ui/glyphs";
import { quarterProgress } from "@/domain/logical-day";
import { objectiveRoom } from "@/domain/objectives";
import { Sheet } from "@/ui/sheet";
import { Tip } from "@/ui/tip";
import { PlanScene } from "./plan-scene";
import { useToast } from "@/ui/toast";

export function LifeView() {
  const copy = useCopy();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-20 pt-4 lg:pt-8">
      <Hero />
      <CompassSection />
      <OdysseySection />
      <ObjectivesSection />
      <DecisionsSection />
      <p className="serif mx-auto max-w-md text-balance pb-10 text-center text-[clamp(1.4rem,3.6vw,1.9rem)] italic leading-snug text-ink-2">
        {copy.life.closing}
      </p>
    </div>
  );
}

/** Each part of a life gets its own light: the same hues the rest of the app uses for meaning. */
const MINDSET_LOOK: Record<MindsetKey, { icon: LucideIcon; tint: string }> = {
  wonder: { icon: Sparkles, tint: "var(--m-wonder)" },
  availability: { icon: HeartHandshake, tint: "var(--m-community)" },
  "radical-acceptance": { icon: Sunrise, tint: "var(--m-coherence)" },
  "engaged-detached": { icon: Feather, tint: "var(--m-flow)" },
  "create-your-world": { icon: Palette, tint: "var(--kind-objective)" },
};
const PLAN_TINT: Record<1 | 2 | 3, string> = { 1: "var(--kind-objective)", 2: "var(--m-wonder)", 3: "var(--kind-prototype)" };
const wash = (tint: string, at = "0% 0%", strength = 26) =>
  `radial-gradient(120% 90% at ${at}, color-mix(in oklab, ${tint} ${strength}%, transparent), transparent 62%)`;

function Hero() {
  const copy = useCopy();
  const { activePlan } = useStore();
  const reduce = useReducedMotion();
  const words = copy.life.subtitle.split(" ");
  return (
    <header className="pt-4 lg:pt-10">
      <p className="eyebrow">{copy.life.title}</p>
      <h1 className="serif mt-3 max-w-3xl text-balance text-[clamp(2.8rem,9.5vw,5.6rem)] leading-[0.98]">
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            className="inline-block whitespace-pre"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.3em", filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        ))}
      </h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 + words.length * 0.08, duration: 0.9 }}
        className="serif mt-5 max-w-xl text-[clamp(1.2rem,3vw,1.5rem)] italic leading-snug text-ink-2"
      >
        {copy.life.intro}
      </motion.p>
      {activePlan?.title && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + words.length * 0.08, duration: 0.7 }}
          className="glass mt-7 inline-flex max-w-full items-center gap-3 rounded-[26px] py-2.5 pl-2.5 pr-6"
        >
          <span
            aria-hidden
            className="size-9 shrink-0 rounded-full"
            style={{ background: "radial-gradient(circle at 35% 35%, #fff6e0, var(--kind-objective) 70%)", boxShadow: "0 0 18px var(--kind-objective)" }}
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] text-ink-3">{copy.life.livingToward}</span>
            <span className="serif text-balance text-xl leading-tight text-ink">{activePlan.title}</span>
          </span>
        </motion.p>
      )}
      <LifeTip />
    </header>
  );
}

function LifeTip() {
  const copy = useCopy();
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
  const copy = useCopy();
  const { state, actions, compassLine } = useStore();
  const compass = state.compass ?? { workview: "", lifeview: "" };
  return (
    <section aria-label={copy.life.compass}>
      <SectionHead title={copy.life.compass} hint={copy.life.compassHint} />
      <div className="grid gap-4 md:grid-cols-2">
        <ViewCard label={copy.life.workview} prompt={copy.life.workviewPrompt} tint="var(--kind-objective)" value={compass.workview} onSave={(workview) => actions.updateCompass({ ...compass, workview })} />
        <ViewCard label={copy.life.lifeview} prompt={copy.life.lifeviewPrompt} tint="var(--m-coherence)" value={compass.lifeview} onSave={(lifeview) => actions.updateCompass({ ...compass, lifeview })} />
      </div>
      <div className="mb-4 mt-12">
        <h3 className="serif text-[26px] leading-none">{copy.life.mindsets}</h3>
        <p className="mt-1.5 text-sm text-ink-2">{copy.life.mindsetsHint}</p>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5">
        {MINDSET_KEYS.map((key) => (
          <MindsetCard key={key} mindset={key} today={compassLine.source === "mindset" && compassLine.mindset === key} />
        ))}
      </div>
    </section>
  );
}

function MindsetCard({ mindset, today }: { mindset: MindsetKey; today: boolean }) {
  const copy = useCopy();
  const { icon: Icon, tint } = MINDSET_LOOK[mindset];
  return (
    <div
      className="glass flex w-60 shrink-0 snap-start flex-col rounded-[24px] p-5 lg:w-auto"
      style={{
        backgroundImage: wash(tint, "50% 0%", today ? 40 : 24),
        ...(today && { boxShadow: `var(--shadow), 0 0 0 1.5px color-mix(in oklab, ${tint} 75%, transparent), 0 0 40px -12px ${tint}` }),
      }}
    >
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${tint} 30%, transparent)` }}>
          <Icon size={17} className="text-ink" aria-hidden />
        </span>
        {today && (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-[#0b1230]" style={{ background: tint }}>
            {copy.life.todaysMindset}
          </span>
        )}
      </div>
      <p className="serif mt-4 text-[21px] leading-snug text-ink">{copy.mindsets[mindset].line}</p>
      <p className="mt-auto pt-4 text-xs font-medium text-ink-2">{copy.mindsets[mindset].name}</p>
    </div>
  );
}

function ViewCard({ label, prompt, tint, value, onSave }: { label: string; prompt: string; tint: string; value: string; onSave: (v: string) => void }) {
  const copy = useCopy();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="glass relative flex min-h-56 flex-col overflow-hidden rounded-[30px] p-7" style={{ backgroundImage: wash(tint) }}>
      <span aria-hidden className="serif pointer-events-none absolute -bottom-20 right-5 select-none text-[180px] leading-none" style={{ color: tint, opacity: 0.4 }}>
        ”
      </span>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            aria-label={copy.life.editLabel(label)}
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
              {copy.common.cancel}
            </Button>
            <Button type="submit" size="sm">
              {copy.common.save}
            </Button>
          </div>
        </form>
      ) : value ? (
        <>
          <p className="serif relative mt-4 text-balance text-[clamp(1.6rem,4.6vw,2.2rem)] leading-[1.15]">{value}</p>
          <p className="serif mt-auto pt-5 text-sm italic text-ink-3">— {copy.life.yourWords}</p>
        </>
      ) : (
        <p className="serif mt-3 text-2xl leading-snug text-ink-3">{prompt}</p>
      )}
    </div>
  );
}

// ── Odyssey ─────────────────────────────────────────────────

function OdysseySection() {
  const copy = useCopy();
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
      toast(copy.life.nowActive(p.title));
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

      <Sheet open={!!editing} onClose={() => setEditing(null)} label={copy.life.editPlan}>
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
      <Sheet open={!!promoting} onClose={() => setPromoting(null)} label={copy.life.changeActive}>
        {promoting && <PromotionForm plan={promoting} onDone={() => setPromoting(null)} />}
      </Sheet>
    </section>
  );
}

function PlanCard({ plan, prototypes, onEdit, onPromote }: { plan: OdysseyPlan; prototypes: number; onEdit: () => void; onPromote: () => void }) {
  const copy = useCopy();
  const written = !!plan.title;
  const slotName = copy.life.slotNames[plan.slot];

  if (!written) {
    const tint = PLAN_TINT[plan.slot];
    return (
      <motion.button
        type="button"
        onClick={onEdit}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="group flex min-h-[22rem] w-[82vw] max-w-sm shrink-0 snap-center flex-col overflow-hidden rounded-[30px] border-[1.5px] border-dashed p-6 text-left lg:w-auto lg:max-w-none"
        style={{
          borderColor: `color-mix(in oklab, ${tint} 55%, transparent)`,
          backgroundColor: "color-mix(in oklab, var(--glass) 55%, transparent)",
          backgroundImage: wash(tint, "100% 0%", 30),
        }}
      >
        <PlanScene slot={plan.slot} tint={tint} className="scene-fade -mx-6 -mt-6 mb-4 h-40 w-[calc(100%+3rem)] rounded-t-[28px] transition-transform duration-700 group-hover:scale-[1.02]" />
        <p className="eyebrow">{copy.life.planLabel(plan.slot, slotName)}</p>
        <p className="serif mt-auto pt-6 text-balance text-[28px] leading-[1.12] text-ink">{copy.life.planPrompts[plan.slot]}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{copy.life.planInvite}</p>
        <span
          className="mt-6 inline-flex h-11 items-center gap-2 self-start rounded-full px-5 text-sm font-medium text-[#0b1230] transition-transform group-hover:translate-x-0.5"
          style={{ background: `color-mix(in oklab, ${tint} 70%, white)` }}
        >
          <Plus size={16} /> {copy.life.writePlan}
        </span>
      </motion.button>
    );
  }

  return (
    <motion.article
      layout
      className={clsx("glass relative flex min-h-[22rem] w-[82vw] max-w-sm shrink-0 snap-center flex-col overflow-hidden rounded-[30px] p-6 lg:w-auto lg:max-w-none")}
      style={{
        // Each life has its own horizon: dawn for the one you live, open sky, then dusk for the wild card.
        backgroundImage: wash(PLAN_TINT[plan.slot], "100% 0%", plan.isActive ? 34 : 22),
        ...(plan.isActive && {
          boxShadow: "var(--shadow), 0 0 0 1.5px color-mix(in oklab, var(--kind-objective) 80%, transparent), 0 0 60px -10px color-mix(in oklab, var(--kind-objective) 60%, transparent)",
        }),
      }}
    >
      <PlanScene slot={plan.slot} tint={PLAN_TINT[plan.slot]} className="scene-fade -mx-6 -mt-6 mb-3 h-32 w-[calc(100%+3rem)] rounded-t-[29px]" />
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">
          {copy.life.planLabel(plan.slot, slotName)}
        </p>
        {plan.isActive ? (
          <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-[#0b1230]" style={{ background: "var(--kind-objective)" }}>
            {copy.life.active}
          </span>
        ) : (
          prototypes > 0 && (
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-ink-2">
              <KindDot kind="prototype" /> {copy.life.prototypes(prototypes)}
            </span>
          )
        )}
      </div>
      <h3 className="serif mt-4 text-balance text-[32px] leading-[1.04]">{plan.title}</h3>
      {plan.questions && <p className="mt-3 text-sm leading-relaxed text-ink-2">{plan.questions}</p>}
      <div className="mt-auto grid grid-cols-4 gap-1 pt-6">
        {GAUGE_KEYS.map((k) => (
          <GaugeDial key={k} value={plan.gauges[k]} label={copy.life.gauges[k]} size={52} />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={onEdit} className="flex h-10 items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <Pencil size={14} /> {copy.life.edit}
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
  const copy = useCopy();
  const [draft, setDraft] = useState(plan);
  const words = draft.title.trim() ? draft.title.trim().split(/\s+/).length : 0;
  const { min, max } = copy.life.titleRange;
  const fits = words >= min && words <= max;
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
          <span className="eyebrow">{copy.life.sixWordTitle}</span>
          <span className={clsx("tabular font-mono text-xs", fits ? "text-ink" : "text-ink-3")}>
            {words}/{min === max ? min : `${min}–${max}`}
          </span>
        </span>
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder={copy.life.titlePlaceholder}
          className="serif mt-1 w-full bg-transparent text-[28px] leading-tight text-ink outline-none placeholder:text-ink-3"
        />
      </label>
      <label className="block">
        <span className="eyebrow">{copy.life.questions}</span>
        <textarea
          value={draft.questions}
          onChange={(e) => setDraft({ ...draft, questions: e.target.value })}
          rows={2}
          placeholder={copy.life.questionsPlaceholder}
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
        {copy.life.savePlan}
      </Button>
    </form>
  );
}

function PromotionForm({ plan, onDone }: { plan: OdysseyPlan; onDone: () => void }) {
  const copy = useCopy();
  const { state, quarter, actions } = useStore();
  const toast = useToast();
  const affected = actions.openPrototypesOf(plan.id);
  const [name, setName] = useState(plan.title);
  // Three objectives already: fold into one of them instead of making a fourth.
  const active = state.objectives.filter((o) => o.status === "active" && o.quarter === quarter);
  const full = objectiveRoom(state.objectives, quarter) === 0;
  const [into, setInto] = useState(active[0]?.id ?? null);
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
      {full ? (
        <div>
          <p className="text-sm text-ink-2">{copy.promotion.full}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {active.map((o) => (
              <Chip key={o.id} selected={into === o.id} onClick={() => setInto(o.id)}>
                {o.title}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <label className="block">
          <span className="eyebrow">{copy.promotion.objectiveName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-2xl bg-fill px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-hairline focus:ring-ink-3"
          />
        </label>
      )}
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row-reverse">
        <Button
          size="lg"
          className="sm:flex-1"
          disabled={full ? !into : !name.trim()}
          onClick={() => {
            actions.setActivePlan(plan.id, full && into ? { into } : { fold: name.trim() });
            toast(copy.life.nowActive(plan.title));
            onDone();
          }}
        >
          {full ? copy.promotion.convertInto : copy.promotion.convert}
        </Button>
        <Button
          size="lg"
          variant="glass"
          className="sm:flex-1"
          onClick={() => {
            actions.setActivePlan(plan.id, "close");
            toast(copy.life.nowActive(plan.title));
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
  const copy = useCopy();
  const { state, quarter, today, actions } = useStore();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const all = state.objectives.filter((o) => o.quarter === quarter);
  const room = objectiveRoom(state.objectives, quarter);
  const qp = quarterProgress(today);

  return (
    <section aria-label={copy.life.objectives}>
      <SectionHead title={copy.life.objectives} hint={copy.life.objectivesHint} />
      <QuarterStrip label={quarter.replace("-", " · ")} week={copy.life.quarterWeek(qp.week, qp.weeks)} fraction={qp.fraction} />
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((o, i) => {
          const tasks = state.tasks.filter((t) => t.objectiveId === o.id && !t.closedAt);
          const done = tasks.filter((t) => t.doneAt).length;
          const pct = tasks.length ? done / tasks.length : 0;
          return (
            <motion.li
              key={o.id}
              layout
              className={clsx("glass flex min-h-44 flex-col rounded-[26px] p-5", o.status !== "active" && "opacity-60")}
              style={{
                backgroundImage: wash("var(--kind-objective)", "0% 100%", 12 + Math.round(pct * 30)),
                // Every task under it is done: it glows, quietly.
                ...(pct === 1 && o.status === "active" && { boxShadow: "var(--shadow), 0 0 0 1px color-mix(in oklab, var(--kind-objective) 60%, transparent), 0 0 40px -14px var(--kind-objective)" }),
              }}
            >
              <div className="flex items-center justify-between">
                <span className="tabular font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                {o.status === "active" ? (
                  <div className="-my-2 -mr-2 flex">
                    <IconButton label={copy.life.markDone(o.title)} onClick={() => actions.setObjectiveStatus(o.id, "done")}>
                      <Check size={16} />
                    </IconButton>
                    <IconButton label={copy.life.drop(o.title)} onClick={() => actions.setObjectiveStatus(o.id, "dropped")}>
                      <X size={16} />
                    </IconButton>
                  </div>
                ) : (
                  room > 0 && <button type="button" onClick={() => actions.setObjectiveStatus(o.id, "active")} className="-my-2 h-9 px-2 text-xs text-ink-3 hover:text-ink">
                    {copy.common.undo}
                  </button>
                )}
              </div>
              <p className={clsx("serif mt-3 text-balance text-[24px] leading-[1.15]", o.status === "dropped" && "line-through")}>{o.title}</p>
              <div className="mt-auto pt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--kind-objective)", boxShadow: "0 0 12px var(--kind-objective)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pct * 100, tasks.length ? 3 : 0)}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 18 }}
                  />
                </div>
                <p className="tabular mt-2 font-mono text-xs text-ink-3">
                  {copy.life.objectiveTasks(done, tasks.length)}
                  {o.status !== "active" ? ` · ${copy.life.objectiveStatus[o.status]}` : ""}
                </p>
              </div>
            </motion.li>
          );
        })}
        {room > 0 && (
          <li>
            {adding ? (
              <form
                className="glass flex min-h-44 flex-col rounded-[26px] p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  actions.addObjective(draft);
                  setDraft("");
                  setAdding(false);
                }}
              >
                <textarea
                  autoFocus
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={copy.life.objectivePlaceholder}
                  className="serif w-full flex-1 resize-none bg-transparent text-[24px] leading-[1.15] outline-none placeholder:text-ink-3"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                    {copy.common.cancel}
                  </Button>
                  <Button size="sm" type="submit" disabled={!draft.trim()}>
                    {copy.common.add}
                  </Button>
                </div>
              </form>
            ) : (
              <motion.button
                type="button"
                onClick={() => setAdding(true)}
                whileHover={{ y: -2 }}
                className="group flex h-full w-full flex-row items-center gap-4 rounded-[26px] border-[1.5px] border-dashed p-5 text-left sm:min-h-44 sm:flex-col sm:items-start sm:justify-end sm:gap-3"
                style={{ borderColor: "color-mix(in oklab, var(--kind-objective) 75%, transparent)", backgroundImage: wash("var(--kind-objective)", "0% 100%", 18) }}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--kind-objective) 40%, var(--glass-strong))" }}>
                  <Plus size={18} className="text-ink" aria-hidden />
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-ink">{copy.life.addObjective}</span>
                  <span className="block text-sm text-ink-3">{copy.life.roomFor(room)}</span>
                </span>
              </motion.button>
            )}
          </li>
        )}
      </ul>
      {room === 0 && <p className="serif mt-4 text-lg italic text-ink-2">{copy.life.objectivesFull}</p>}
    </section>
  );
}

/** Where you are in the quarter: a thin horizon with the sun travelling along it. */
function QuarterStrip({ label, week, fraction }: { label: string; week: string; fraction: number }) {
  return (
    <div className="glass flex items-center gap-4 rounded-full py-2.5 pl-5 pr-5">
      <span className="tabular shrink-0 font-mono text-xs text-ink-2">{label}</span>
      <div className="relative h-1 flex-1 rounded-full bg-fill">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fraction * 100}%`, background: "linear-gradient(90deg, transparent, var(--kind-objective))" }} />
        <span
          aria-hidden
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${fraction * 100}%`, background: "radial-gradient(circle at 35% 35%, #fff6e0, var(--kind-objective) 70%)", boxShadow: "0 0 14px var(--kind-objective)" }}
        />
      </div>
      <span className="tabular shrink-0 font-mono text-xs text-ink-2">{week}</span>
    </div>
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
  const copy = useCopy();
  const formatDate = useFormatDate();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={copy.life.decisions}>
      <SectionHead
        title={copy.life.decisions}
        hint={copy.life.decisionsHint}
        action={
          state.decisions.length > 0 && (
            <Button size="sm" variant="glass" onClick={() => setOpen(true)}>
              <Plus size={15} /> {copy.life.logDecision}
            </Button>
          )
        }
      />
      {state.decisions.length === 0 ? (
        <div className="glass flex flex-col items-start gap-4 rounded-[30px] p-7 sm:flex-row sm:items-center sm:gap-6" style={{ backgroundImage: wash("var(--m-coherence)", "0% 0%", 26) }}>
          <span className="relative grid size-14 shrink-0 place-items-center">
            <span aria-hidden className="absolute inset-0 rounded-full blur-md" style={{ background: "var(--m-coherence)", opacity: 0.5 }} />
            <span className="relative grid size-14 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--m-coherence) 45%, var(--glass-strong))" }}>
              <Milestone size={22} className="text-ink" aria-hidden />
            </span>
          </span>
          <div className="flex-1">
            <p className="serif text-[clamp(1.6rem,4vw,2rem)] leading-tight">{copy.life.decisionsEmpty}</p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-2">{copy.life.decisionsEmptyBody}</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} /> {copy.life.logDecision}
          </Button>
        </div>
      ) : (
        <ol className="relative flex flex-col gap-4 pl-8">
          <span aria-hidden className="absolute bottom-4 left-[7px] top-4 w-px" style={{ background: "linear-gradient(to bottom, var(--kind-objective), color-mix(in oklab, var(--m-coherence) 60%, transparent), transparent)" }} />
          {state.decisions.map((d) => {
            const plan = state.plans.find((p) => p.id === d.linkedPlanId);
            return (
              <li key={d.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-8 top-6 size-[15px] rounded-full"
                  style={{ background: "radial-gradient(circle at 35% 35%, #fff6e0, var(--kind-objective) 70%)", boxShadow: "0 0 14px var(--kind-objective)" }}
                />
                <div className="glass rounded-[24px] p-5" style={{ backgroundImage: wash("var(--kind-objective)", "0% 0%", 12) }}>
                  <p className="tabular font-mono text-xs text-ink-3">
                    {formatDate(new Date(`${d.date}T12:00:00`), { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="serif mt-1.5 text-balance text-[26px] leading-[1.15]">{d.decision}</p>
                  {d.drivenBy && (
                    <p className="serif mt-3 border-l-2 pl-3 text-lg italic leading-snug text-ink-2" style={{ borderColor: "color-mix(in oklab, var(--m-coherence) 70%, transparent)" }}>
                      {d.drivenBy}
                    </p>
                  )}
                  {plan?.title && (
                    <p
                      className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-ink-2"
                      style={{ background: `color-mix(in oklab, ${PLAN_TINT[plan.slot]} 22%, transparent)` }}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: PLAN_TINT[plan.slot] }} /> {plan.title}
                    </p>
                  )}
                </div>
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
  const copy = useCopy();
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
      <input autoFocus value={decision} onChange={(e) => setDecision(e.target.value)} placeholder={copy.life.decisionPlaceholder} className="serif w-full bg-transparent text-[28px] leading-tight outline-none placeholder:text-ink-3" />
      <label className="block">
        <span className="eyebrow">{copy.life.drivenBy}</span>
        <textarea value={drivenBy} onChange={(e) => setDrivenBy(e.target.value)} rows={2} placeholder={copy.life.drivenByPlaceholder} className="mt-2 w-full resize-none rounded-2xl bg-fill px-4 py-3 text-[15px] outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3" />
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
