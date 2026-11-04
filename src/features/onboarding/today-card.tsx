"use client";

import { BellRing, Compass } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { copy } from "@/copy/en";
import { useStore } from "@/data/mock-store";
import { Button } from "@/ui/controls";
import { Tip } from "@/ui/tip";

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const useIsIos = () => useSyncExternalStore(() => () => {}, isIos, () => false);

/** The one onboarding card Today shows, if any: tip → reminder ask → Odyssey nudge (SPEC §7). */
export function TodayOnboardingCard() {
  const { card, actions } = useStore();
  const reduce = useReducedMotion();
  const key = !card ? "none" : card.type === "tip" ? card.tip : card.type === "nudge" ? `nudge-${card.slot}` : "reminder";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {card && (
        <motion.div
          key={key}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {card.type === "tip" && <Tip onDismiss={() => actions.dismissTip(card.tip)}>{copy.tips[card.tip]}</Tip>}
          {card.type === "reminder" && <ReminderAsk onAnswer={actions.answerReminder} />}
          {card.type === "nudge" && <OdysseyNudge slot={card.slot} onLater={() => actions.notNowNudge(card.slot)} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReminderAsk({ onAnswer }: { onAnswer: () => void }) {
  const ios = useIsIos();
  return (
    <section aria-label={copy.onboarding.reminderTitle} className="glass rounded-[24px] p-5">
      <div className="flex items-start gap-3">
        <BellRing size={18} className="mt-1 shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="serif text-2xl leading-tight">{copy.onboarding.reminderTitle}</p>
          <p className="mt-1 text-sm text-ink-2">{copy.onboarding.reminderBody}</p>
          {ios && <p className="mt-2 text-xs text-ink-3">{copy.onboarding.reminderIos}</p>}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onAnswer}>
          {copy.onboarding.reminderNo}
        </Button>
        <Link
          href="/settings#reminder"
          onClick={onAnswer}
          className="inline-flex h-11 items-center rounded-full bg-solid px-5 text-sm font-medium text-solid-ink"
        >
          {copy.onboarding.reminderYes}
        </Link>
      </div>
    </section>
  );
}

function OdysseyNudge({ slot, onLater }: { slot: 1 | 2 | 3; onLater: () => void }) {
  return (
    <section aria-label={copy.onboarding.nudgeEyebrow(slot)} className="rounded-[24px] border-[1.5px] border-dashed border-ink-3/50 p-5">
      <p className="eyebrow flex items-center gap-1.5">
        <Compass size={13} aria-hidden /> {copy.onboarding.nudgeEyebrow(slot)}
      </p>
      <p className="serif mt-3 text-2xl leading-tight">{copy.life.planPrompts[slot]}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onLater}>
          {copy.onboarding.nudgeLater}
        </Button>
        <Link
          href={`/life?plan=${slot}`}
          className="inline-flex h-11 items-center rounded-full bg-solid px-5 text-sm font-medium text-solid-ink"
        >
          {copy.onboarding.nudgeWrite}
        </Link>
      </div>
    </section>
  );
}
