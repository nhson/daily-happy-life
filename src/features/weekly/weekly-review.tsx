"use client";

import { CalendarRange, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useCopy, useFormatDate } from "@/copy";
import { useStore } from "@/data/store";
import { addDays } from "@/domain/logical-day";
import { MEANING_SOURCES } from "@/domain/types";
import type { WeeklyReview } from "@/domain/weekly-review";
import { Button, ShareBar } from "@/ui/controls";
import { tap } from "@/ui/feedback";
import { MeaningGlyph, meaningColor } from "@/ui/glyphs";
import { Sheet } from "@/ui/sheet";
import { useToast } from "@/ui/toast";

/** "2–8 Nov" for the week ending `weekEnd`. */
function useWeekRange() {
  const formatDate = useFormatDate();
  return (weekEnd: string) => {
    const d = (x: string) => new Date(`${x}T12:00:00Z`);
    const start = addDays(weekEnd, -6);
    const sameMonth = start.slice(0, 7) === weekEnd.slice(0, 7);
    const from = formatDate(d(start), sameMonth ? { day: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
    return `${from}–${formatDate(d(weekEnd), { day: "numeric", month: "short", timeZone: "UTC" })}`;
  };
}

/** On Today from Sunday evening through Monday, until the week's review is opened. */
export function WeeklyReviewCard() {
  const copy = useCopy();
  const { reviewDue } = useStore();
  const range = useWeekRange();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  if (!reviewDue && !open) return null;
  return (
    <>
      {reviewDue && (
        <motion.section
          aria-label={copy.weeklyReview.title}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <p className="eyebrow flex items-center gap-1.5">
              <CalendarRange size={13} aria-hidden /> {copy.weeklyReview.week(range(reviewDue))}
            </p>
            <p className="serif mt-2 text-2xl leading-tight">{copy.weeklyReview.title}</p>
            <p className="mt-1 text-sm text-ink-2">{copy.weeklyReview.cardBody}</p>
          </div>
          <Button onClick={() => setOpen(reviewDue)}>{copy.weeklyReview.open}</Button>
        </motion.section>
      )}
      <ReviewSheet weekEnd={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Past reviews on the Life page: the week and the line the user kept. */
export function ReviewsSection({ Head }: { Head: (p: { title: string; hint?: string }) => React.ReactNode }) {
  const copy = useCopy();
  const { state } = useStore();
  const range = useWeekRange();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section aria-label={copy.weeklyReview.past}>
      <Head title={copy.weeklyReview.past} hint={copy.weeklyReview.pastHint} />
      {state.reviews.length === 0 ? (
        <p className="text-sm text-ink-3">{copy.weeklyReview.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.reviews.map((r) => (
            <li key={r.weekEnd}>
              <button
                type="button"
                onClick={() => setOpen(r.weekEnd)}
                aria-haspopup="dialog"
                className="glass-lite flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left"
              >
                <span className="eyebrow w-28 shrink-0">{range(r.weekEnd)}</span>
                <span className={r.takeaway ? "serif text-lg leading-snug text-ink" : "text-sm text-ink-3"}>{r.takeaway || copy.weeklyReview.noTakeaway}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ReviewSheet weekEnd={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function ReviewSheet({ weekEnd, onClose }: { weekEnd: string | null; onClose: () => void }) {
  const copy = useCopy();
  return (
    <Sheet open={!!weekEnd} onClose={onClose} label={copy.weeklyReview.title}>
      {weekEnd && <ReviewBody key={weekEnd} weekEnd={weekEnd} onDone={onClose} />}
    </Sheet>
  );
}

function ReviewBody({ weekEnd, onDone }: { weekEnd: string; onDone: () => void }) {
  const copy = useCopy();
  const { state, actions, isLive } = useStore();
  const range = useWeekRange();
  const review = state.reviews.find((r) => r.weekEnd === weekEnd) ?? null;
  const [loading, setLoading] = useState(!review);
  const [failed, setFailed] = useState(false);

  const ask = () => {
    setLoading(true);
    setFailed(false);
    actions.openReview(weekEnd).then((r) => {
      setLoading(false);
      if (!r) setFailed(true);
    });
  };
  // Opened for the first time: the server reads the week and asks the AI.
  useEffect(() => {
    if (review) return;
    let alive = true;
    actions.openReview(weekEnd).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (!r) setFailed(true);
    });
    return () => {
      alive = false;
    };
    // Once per sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-7 pb-2 pt-2">
      <div>
        <p className="eyebrow">{copy.weeklyReview.week(range(weekEnd))}</p>
        <h2 className="serif mt-2 text-[34px] leading-none">{copy.weeklyReview.title}</h2>
      </div>

      {!review ? (
        <p role="status" className="animate-pulse text-ink-2 [animation-duration:2s]">
          {failed ? copy.common.notSaved : copy.weeklyReview.loading}
        </p>
      ) : (
        <>
          <Numbers review={review} />
          <Notes review={review} loading={loading} canRetry={isLive && !loading} onRetry={ask} />
          <Takeaway review={review} onSaved={onDone} />
        </>
      )}
    </div>
  );
}

function Numbers({ review }: { review: WeeklyReview }) {
  const copy = useCopy();
  const formatDate = useFormatDate();
  const s = review.stats;
  const bar = (v: number | null, color: string) => (
    <span className="flex h-16 w-2.5 items-end overflow-hidden rounded-full bg-[var(--fill)]">
      {v !== null && <span className="w-full rounded-full" style={{ height: `${(v / 5) * 100}%`, background: color }} />}
    </span>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="glass-lite rounded-full px-3 py-1.5">{copy.weeklyReview.done(s.done.total)}</span>
        <span className="glass-lite rounded-full px-3 py-1.5">{copy.weeklyReview.checkIns(s.checkIns)}</span>
        {s.focusMinutes > 0 && <span className="glass-lite rounded-full px-3 py-1.5">{copy.weeklyReview.focus(copy.focus.duration(s.focusMinutes))}</span>}
      </div>

      <section aria-label={copy.weeklyReview.days}>
        <p className="eyebrow mb-3">{copy.weeklyReview.days}</p>
        <ul className="grid grid-cols-7 gap-1">
          {s.days.map((d) => (
            <li
              key={d.date}
              className="flex flex-col items-center gap-1.5"
              aria-label={`${formatDate(new Date(`${d.date}T12:00:00Z`), { weekday: "long", timeZone: "UTC" })}: ${
                d.closed ? `${copy.checkIn.energy} ${d.energy ?? "–"}/5, ${copy.checkIn.engagement} ${d.engagement ?? "–"}/5` : copy.weeklyReview.noDay
              }`}
            >
              <span className="flex gap-1" aria-hidden>
                {bar(d.energy, "var(--kind-objective)")}
                {bar(d.engagement, "var(--m-wonder)")}
              </span>
              <span className="text-xs text-ink-3" aria-hidden>
                {formatDate(new Date(`${d.date}T12:00:00Z`), { weekday: "narrow", timeZone: "UTC" })}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex gap-4 text-xs text-ink-3" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: "var(--kind-objective)" }} /> {copy.checkIn.energy}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: "var(--m-wonder)" }} /> {copy.checkIn.engagement}
          </span>
        </p>
      </section>

      {s.done.total > 0 && (
        <section aria-label={copy.weeklyReview.share}>
          <p className="eyebrow mb-3">{copy.weeklyReview.share}</p>
          <ShareBar percent={s.share} />
        </section>
      )}

      <section aria-label={copy.weeklyReview.meaning}>
        <p className="eyebrow mb-3">{copy.weeklyReview.meaning}</p>
        <ul className="grid grid-cols-4 gap-2">
          {MEANING_SOURCES.map((m) => (
            <li key={m} className="flex flex-col items-center gap-1 text-xs" style={{ color: s.meaning[m] ? meaningColor[m] : "var(--ink-3)" }}>
              <MeaningGlyph source={m} size={24} filled={s.meaning[m] > 0} />
              <span className="text-ink-2">
                {copy.meaning[m].name} · <span className="tabular">{s.meaning[m]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {(s.objectives.length > 0 || s.prototypes.length > 0) && (
        <section aria-label={copy.weeklyReview.objectives} className="flex flex-col gap-2 text-sm">
          <p className="eyebrow">{copy.weeklyReview.objectives}</p>
          {s.objectives.map((o) => (
            <p key={o.title} className="flex justify-between gap-4">
              <span className="text-ink">{o.title}</span>
              <span className="tabular shrink-0 text-ink-2">{o.done}</span>
            </p>
          ))}
          {s.prototypes.map((p) => (
            <p key={p.plan} className="flex justify-between gap-4">
              <span className="text-ink">
                {copy.weeklyReview.prototypes} · {p.plan}
              </span>
              <span className="tabular shrink-0 text-ink-2">{p.done}</span>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

function Notes({ review, loading, canRetry, onRetry }: { review: WeeklyReview; loading: boolean; canRetry: boolean; onRetry: () => void }) {
  const copy = useCopy();
  return (
    <section aria-label={copy.weeklyReview.notes} className="glass rounded-[24px] p-5">
      <p className="eyebrow flex items-center gap-1.5">
        <Sparkles size={13} aria-hidden /> {copy.weeklyReview.notes}
      </p>
      {review.notes ? (
        <>
          <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink">
            {review.notes.observations.map((o, i) => (
              <p key={i}>{o}</p>
            ))}
          </div>
          {review.notes.question && (
            <div className="mt-5">
              <p className="eyebrow">{copy.weeklyReview.question}</p>
              <p className="serif mt-1 text-xl italic leading-snug">{review.notes.question}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-ink-3">{copy.weeklyReview.byAi}</p>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-ink-2">
            {loading ? copy.weeklyReview.loading : copy.weeklyReview.noNotes}
          </p>
          {canRetry && (
            <Button size="sm" variant="glass" onClick={onRetry}>
              {copy.weeklyReview.retry}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Takeaway({ review, onSaved }: { review: WeeklyReview; onSaved: () => void }) {
  const copy = useCopy();
  const { actions } = useStore();
  const toast = useToast();
  const [text, setText] = useState(review.takeaway);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        actions.saveTakeaway(review.weekEnd, text);
        tap(10);
        toast(copy.weeklyReview.saved);
        onSaved();
      }}
      className="flex flex-col gap-3"
    >
      <label className="block">
        <span className="mb-2 block text-sm font-medium">{copy.weeklyReview.takeaway}</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder={copy.weeklyReview.takeawayPlaceholder}
          className="serif w-full rounded-2xl bg-fill px-4 py-3 text-xl italic text-ink outline-none ring-1 ring-hairline placeholder:not-italic placeholder:text-ink-3 focus:ring-ink-3"
        />
      </label>
      <Button type="submit" size="lg">
        {copy.weeklyReview.save}
      </Button>
    </form>
  );
}
