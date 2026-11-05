"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useCopy } from "@/copy";
import { useStore } from "@/data/store";
import { objectiveRoom } from "@/domain/objectives";
import type { OdysseyPlan } from "@/domain/types";
import { Button, Chip } from "@/ui/controls";
import { KindDot } from "@/ui/glyphs";
import { useToast } from "@/ui/toast";

/**
 * Switching the Active Plan (Life, and the Quarterly Review): settles the old plan's Objectives
 * and the new one's Prototypes, then offers the switch as a Decision. `onDone(switched)`.
 */
export function PromotionForm({ plan, onDone }: { plan: OdysseyPlan; onDone: (switched: boolean) => void }) {
  const copy = useCopy();
  const { state, quarter, activePlan, toSettle, actions } = useStore();
  const toast = useToast();
  const affected = actions.openPrototypesOf(plan.id);
  const [stage, setStage] = useState<"settle" | "decision">("settle");
  const [choices, setChoices] = useState<Record<string, "keep" | "drop">>(() => Object.fromEntries(toSettle.map((o) => [o.id, "keep"])));
  const [fold, setFold] = useState(true);
  const [name, setName] = useState(plan.title);
  // Room is what is left once the dropped ones are gone.
  const after = state.objectives.filter((o) => choices[o.id] !== "drop");
  const full = objectiveRoom(after, quarter) === 0;
  const targets = after.filter((o) => o.status === "active" && o.quarter === quarter);
  const [into, setInto] = useState<string | null>(null);
  const target = targets.some((o) => o.id === into) ? into : (targets[0]?.id ?? null);
  const [decision, setDecision] = useState(copy.promotion.decisionText(plan.title));
  const [drivenBy, setDrivenBy] = useState("");

  const ready = !affected.length || !fold || (full ? !!target : !!name.trim());
  const confirm = () => {
    const prototypes = !affected.length ? null : !fold ? ("close" as const) : full ? { into: target! } : { fold: name.trim() };
    if (actions.setActivePlan(plan.id, { objectives: choices, prototypes })) setStage("decision");
  };
  const finish = (log: boolean) => {
    if (log && decision.trim()) actions.addDecision({ decision: decision.trim(), drivenBy: drivenBy.trim(), linkedPlanId: plan.id });
    toast(copy.life.nowActive(plan.title));
    onDone(true);
  };

  if (stage === "decision")
    return (
      <form
        className="flex flex-col gap-5 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <div>
          <h2 className="serif text-3xl leading-tight">{copy.promotion.decisionTitle}</h2>
          <p className="mt-2 text-ink-2">{copy.promotion.decisionBody}</p>
        </div>
        <input
          aria-label={copy.life.decisionPlaceholder}
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="serif w-full bg-transparent text-[26px] leading-tight outline-none"
        />
        <label className="block">
          <span className="eyebrow">{copy.life.drivenBy}</span>
          <textarea
            autoFocus
            value={drivenBy}
            onChange={(e) => setDrivenBy(e.target.value)}
            rows={2}
            placeholder={copy.life.drivenByPlaceholder}
            className="mt-2 w-full resize-none rounded-2xl bg-fill px-4 py-3 text-[15px] outline-none ring-1 ring-hairline placeholder:text-ink-3 focus:ring-ink-3"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" size="lg" className="sm:flex-1" disabled={!decision.trim()}>
            {copy.life.logDecision}
          </Button>
          <Button type="button" size="lg" variant="glass" className="sm:flex-1" onClick={() => finish(false)}>
            {copy.promotion.skipDecision}
          </Button>
        </div>
      </form>
    );

  return (
    <div className="flex flex-col gap-7 py-2">
      <h2 className="serif text-3xl leading-tight">{copy.promotion.title(plan.title)}</h2>

      {toSettle.length > 0 && (
        <section aria-label={copy.promotion.oldObjectives(activePlan?.title ?? "")}>
          <p className="eyebrow">{copy.promotion.oldObjectives(activePlan?.title ?? "")}</p>
          <p className="mt-1 text-sm text-ink-2">{copy.promotion.oldObjectivesHint}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {toSettle.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-2xl bg-fill px-4 py-2.5">
                <span className={clsx("min-w-0 flex-1 text-[15px]", choices[o.id] === "drop" && "text-ink-3 line-through")}>{o.title}</span>
                <span role="group" aria-label={o.title} className="flex shrink-0 gap-1.5">
                  {(["keep", "drop"] as const).map((c) => (
                    <Chip key={c} selected={choices[o.id] === c} onClick={() => setChoices({ ...choices, [o.id]: c })}>
                      {copy.promotion[c]}
                    </Chip>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {affected.length > 0 && (
        <section aria-label={copy.promotion.prototypes}>
          <p className="eyebrow">{copy.promotion.prototypes}</p>
          <p className="mt-1 text-sm text-ink-2">{copy.promotion.body}</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {affected.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <KindDot kind="prototype" /> {t.title}
              </li>
            ))}
          </ul>
          <div role="group" aria-label={copy.promotion.prototypes} className="mt-4 flex flex-wrap gap-2">
            <Chip selected={fold} onClick={() => setFold(true)}>
              {copy.promotion.foldChoice}
            </Chip>
            <Chip selected={!fold} onClick={() => setFold(false)}>
              {copy.promotion.close}
            </Chip>
          </div>
          {fold &&
            (full ? (
              <div className="mt-4">
                <p className="text-sm text-ink-2">{copy.promotion.full}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {targets.map((o) => (
                    <Chip key={o.id} selected={target === o.id} onClick={() => setInto(o.id)}>
                      {o.title}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : (
              <label className="mt-4 block">
                <span className="eyebrow">{copy.promotion.objectiveName}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-2xl bg-fill px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-hairline focus:ring-ink-3"
                />
              </label>
            ))}
        </section>
      )}

      <Button size="lg" disabled={!ready} onClick={confirm}>
        {copy.promotion.confirm}
      </Button>
    </div>
  );
}
