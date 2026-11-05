"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import { useState } from "react";
import { useCopy } from "@/copy";
import { Tip } from "@/ui/tip";
import { logicalDate } from "@/domain/logical-day";
import { MEANING_SOURCES, type MeaningSource } from "@/domain/types";
import { useStore } from "@/data/store";
import { TaskList } from "@/features/tasks/task-list";
import { Button, RatingStops } from "@/ui/controls";
import { chime, tap } from "@/ui/feedback";
import { MeaningGlyph, meaningColor } from "@/ui/glyphs";

/** The Evening Check-in — one sheet, one commit. ~60 seconds. */
export function CheckInForm({ onClosed }: { onClosed: () => void }) {
  const copy = useCopy();
  const { state, today, top3, log, tipUnseen, actions } = useStore();
  const [energy, setEnergy] = useState<number | null>(log.energy);
  const [engagement, setEngagement] = useState<number | null>(log.engagement);
  const [sources, setSources] = useState<MeaningSource[]>(log.meaningSources);
  const [note, setNote] = useState(log.note);

  // Today's Top 3 plus anything touched today.
  const { timeZone, dayEndHour } = state.settings;
  const todays = state.tasks.filter(
    (t) => !t.closedAt && (t.top3Date === today || (t.doneAt && logicalDate(new Date(t.doneAt), timeZone, dayEndHour) === today)),
  );
  const list = todays.length ? todays : top3;

  const toggle = (s: MeaningSource) => {
    tap(8);
    setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const close = () => {
    actions.closeDay({ energy, engagement, meaningSources: sources, note: note.trim() });
    tap(20);
    if (state.settings.sound) chime();
    onClosed();
  };

  return (
    <div className="flex flex-col gap-7 pb-2 pt-2">
      <h2 className="serif text-[34px] leading-none">{copy.checkIn.title}</h2>
      <Tip show={tipUnseen("evening")} onDismiss={() => actions.dismissTip("evening")}>
        {copy.tips.evening}
      </Tip>

      {list.length > 0 && (
        <section>
          <p className="eyebrow mb-2">{copy.checkIn.tick}</p>
          <TaskList tasks={list} showWhy={false} compact />
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <RatingStops label={copy.checkIn.energy} ends={copy.checkIn.energyEnds} value={energy} onChange={setEnergy} />
        <RatingStops label={copy.checkIn.engagement} ends={copy.checkIn.engagementEnds} value={engagement} onChange={setEngagement} />
      </div>

      <section>
        <p className="mb-3 text-sm font-medium">{copy.checkIn.meaning}</p>
        <div className="grid grid-cols-4 gap-2">
          {MEANING_SOURCES.map((s) => {
            const on = sources.includes(s);
            return (
              <motion.button
                key={s}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => toggle(s)}
                aria-pressed={on}
                aria-label={`${copy.meaning[s].name}: ${copy.meaning[s].hint}`}
                className={clsx("flex flex-col items-center gap-1.5 rounded-2xl px-1 pb-2.5 pt-3 transition-colors duration-300")}
                style={{
                  color: on ? meaningColor[s] : "var(--ink-2)",
                  background: on ? `color-mix(in oklab, ${meaningColor[s]} 16%, var(--fill))` : "var(--fill)",
                  boxShadow: on ? `inset 0 0 0 1.5px ${meaningColor[s]}` : "inset 0 0 0 1px var(--hairline)",
                }}
              >
                <motion.span animate={{ scale: on ? [1, 1.18, 1] : 1, rotate: on && s === "wonder" ? [0, 18, 0] : 0 }} transition={{ duration: 0.45 }}>
                  <MeaningGlyph source={s} size={30} filled={on} />
                </motion.span>
                <span className="text-xs font-medium text-ink">{copy.meaning[s].name}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <label className="block">
        <span className="mb-2 block text-sm font-medium">{copy.checkIn.note}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.checkIn.notePlaceholder}
          maxLength={140}
          className="serif w-full rounded-2xl bg-fill px-4 py-3 text-xl italic text-ink outline-none ring-1 ring-hairline placeholder:not-italic placeholder:text-ink-3 focus:ring-ink-3"
        />
      </label>

      {/* The one commit stays in reach while the sheet scrolls. */}
      <div
        className="sticky bottom-0 -mx-5 -mb-2 px-5 pb-2 pt-5 sm:-mx-7 sm:px-7"
        style={{ background: "linear-gradient(to top, var(--glass-strong) 65%, transparent)" }}
      >
        <Button size="lg" onClick={close} className="w-full">
          {copy.checkIn.close}
        </Button>
      </div>
    </div>
  );
}
