"use client";

import { CalendarCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useCopy } from "@/copy";
import { useStore } from "@/data/store";
import { MAX_ACTIVE_OBJECTIVES, objectiveRoom } from "@/domain/objectives";
import type { LeftoverChoice } from "@/domain/quarter-close";
import { Button } from "@/ui/controls";

/** "2027-Q1" → "Q4 · 2026": the quarter being closed. */
function lastQuarterLabel(quarter: string): string {
  const [y, q] = quarter.split("-Q").map(Number);
  return q === 1 ? `Q4 · ${y - 1}` : `Q${q - 1} · ${y}`;
}

/**
 * Quarter Close on Today: not blocking. Each leftover Objective of last quarter gets Done / Drop /
 * Carry forward; then one question about a Decision, and "add one?" if this quarter has room.
 */
export function QuarterCloseCard() {
  const copy = useCopy();
  const { state, quarter, leftoverObjectives, actions } = useStore();
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<"settle" | "decision" | "addOne" | "done">("settle");
  const [decision, setDecision] = useState("");
  const [drivenBy, setDrivenBy] = useState("");
  const room = objectiveRoom(state.objectives, quarter);
  const after = () => setStage(room > 0 ? "addOne" : "done");

  if (stage === "settle" && leftoverObjectives.length === 0) return null;
  if (stage === "done") return null;

  const pick = (id: string, choice: LeftoverChoice) => {
    if (!actions.settleLeftover(id, choice)) return;
    if (leftoverObjectives.length === 1) setStage("decision");
  };

  return (
    <motion.section
      aria-label={copy.quarterClose.eyebrow(lastQuarterLabel(quarter))}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-[24px] p-5"
    >
      <p className="eyebrow flex items-center gap-1.5">
        <CalendarCheck size={13} aria-hidden /> {copy.quarterClose.eyebrow(lastQuarterLabel(quarter))}
      </p>

      {stage === "settle" && (
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
      )}

      {stage === "decision" && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            actions.addDecision({ decision: decision.trim(), drivenBy: drivenBy.trim(), linkedPlanId: null });
            after();
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
            <Button type="button" variant="ghost" onClick={after}>
              {copy.quarterClose.skip}
            </Button>
            <Button type="submit" disabled={!decision.trim()}>
              {copy.quarterClose.save}
            </Button>
          </div>
        </form>
      )}

      {stage === "addOne" && (
        <div className="mt-3">
          <p className="serif text-2xl leading-tight">{copy.quarterClose.addOneQ(MAX_ACTIVE_OBJECTIVES - room)}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStage("done")}>
              {copy.quarterClose.later}
            </Button>
            <Link href="/life" className="inline-flex h-11 items-center rounded-full bg-solid px-5 text-sm font-medium text-solid-ink">
              {copy.quarterClose.addOne}
            </Link>
          </div>
        </div>
      )}
    </motion.section>
  );
}
