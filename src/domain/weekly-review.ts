import { focusedOn, type FocusSession } from "./focus";
import { lifeShare } from "./life-share";
import { addDays, logicalDate } from "./logical-day";
import type { RitualMode } from "./ritual-mode";
import { MEANING_SOURCES, type DailyLog, type LogicalDate, type MeaningSource, type Objective, type OdysseyPlan, type Task } from "./types";

/**
 * The Weekly Review (SPEC Phase 2 · 2): once a week, the week's numbers and a few quiet notes from
 * an AI about them. Weeks run Monday to Sunday (Logical Days). The AI sees numbers and titles only —
 * never notes, Intentions, Compass words or task titles (owner's choice, 2026-11-05).
 */

/** Sunday from the evening on, and all of Monday: the week ending that Sunday. Otherwise none. */
export function weekToReview(today: LogicalDate, mode: RitualMode): LogicalDate | null {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (weekday === 0) return mode === "evening" || mode === "night" ? today : null;
  if (weekday === 1) return addDays(today, -1);
  return null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface WeekStats {
  /** The Sunday that ends the week. */
  weekEnd: LogicalDate;
  activePlan: string | null;
  days: { date: LogicalDate; weekday: (typeof WEEKDAYS)[number]; energy: number | null; engagement: number | null; closed: boolean }[];
  checkIns: number;
  done: { objective: number; maintenance: number; prototype: number; total: number };
  /** Life Share of the week, in percent. */
  share: { objective: number; maintenance: number; prototype: number };
  meaning: Record<MeaningSource, number>;
  focusMinutes: number;
  /** This quarter's active Objectives, with tasks done for each this week. */
  objectives: { title: string; done: number }[];
  /** Prototype tasks done this week, per plan tested. */
  prototypes: { plan: string; done: number }[];
}

export function weekStats(
  input: { tasks: Task[]; logs: DailyLog[]; focus: FocusSession[]; objectives: Objective[]; plans: OdysseyPlan[] },
  weekEnd: LogicalDate,
  timeZone: string,
  dayEndHour: number,
  now: Date,
): WeekStats {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekEnd, i - 6));
  const inWeek = (d: LogicalDate) => d >= dates[0] && d <= weekEnd;
  const doneIn = input.tasks.filter((t) => t.doneAt && inWeek(logicalDate(new Date(t.doneAt), timeZone, dayEndHour)));
  const share = lifeShare(doneIn, { today: weekEnd, timeZone, dayEndHour });
  const logOf = new Map(input.logs.map((l) => [l.date, l]));

  const meaning = Object.fromEntries(MEANING_SOURCES.map((s) => [s, 0])) as Record<MeaningSource, number>;
  for (const d of dates) for (const s of logOf.get(d)?.meaningSources ?? []) meaning[s]++;

  const planTitle = (id: string | null) => {
    const p = input.plans.find((x) => x.id === id);
    return p ? p.title || `Plan ${p.slot}` : "";
  };
  const quarterOfWeek = `${weekEnd.slice(0, 4)}-Q${Math.ceil(Number(weekEnd.slice(5, 7)) / 3)}`;
  const objectives = input.objectives
    .filter((o) => (o.status === "active" && o.quarter <= quarterOfWeek) || doneIn.some((t) => t.objectiveId === o.id))
    .map((o) => ({ title: o.title, done: doneIn.filter((t) => t.objectiveId === o.id).length }));
  const byPlan = new Map<string, number>();
  for (const t of doneIn) if (t.kind === "prototype") byPlan.set(planTitle(t.prototypePlanId), (byPlan.get(planTitle(t.prototypePlanId)) ?? 0) + 1);

  return {
    weekEnd,
    activePlan: input.plans.find((p) => p.isActive)?.title || null,
    days: dates.map((date, i) => {
      const l = logOf.get(date);
      return { date, weekday: WEEKDAYS[i], energy: l?.energy ?? null, engagement: l?.engagement ?? null, closed: !!l?.closedAt };
    }),
    checkIns: dates.filter((d) => logOf.get(d)?.closedAt).length,
    done: { ...share.counts, total: share.total },
    share: share.percent,
    meaning,
    focusMinutes: dates.reduce((sum, d) => sum + focusedOn(input.focus, d, timeZone, dayEndHour, now), 0),
    objectives,
    prototypes: [...byPlan].map(([plan, done]) => ({ plan, done })),
  };
}

/** The app's own Vietnamese words (GLOSSARY.md), so the notes read like the rest of the app. */
const VI_TERMS =
  "Use exactly these Vietnamese terms, never the English ones: Task = việc, Objective = Mục tiêu, Maintenance = Duy trì, " +
  "Prototype = Thử nghiệm, Odyssey Plan = Kế hoạch Odyssey, Active Plan = Kế hoạch đang theo, Evening Check-in = Khép lại ngày, " +
  "Energy = Năng lượng, Engagement = Độ say mê, Sources of Meaning = Nguồn ý nghĩa, wonder = Kinh ngạc, coherence = Mạch lạc, " +
  "flow = Dòng chảy, community = Kết nối, Life Share = Cán cân tuần, focus minutes = thời gian tập trung.";

/** The request: a calm reader of the week, in the user's language, answering in JSON. */
export function reviewPrompt(stats: WeekStats, locale: "vi" | "en"): { system: string; user: string } {
  const language = locale === "en" ? "English" : "Vietnamese (address the reader as “bạn”)";
  const system = [
    "You read one week of a person's life data from a purpose-aware task manager built on the books",
    "Designing Your Life and How to Live a Meaningful Life. Tasks are one of three kinds: Objective",
    "(serves a quarterly Objective under their Active Plan), Maintenance (keeps life running) or",
    "Prototype (a small experiment testing another possible life, an Odyssey Plan). Each evening they",
    "rate Energy and Engagement 1–5 and tap Sources of Meaning: wonder, coherence, flow, community.",
    "",
    "Notice patterns, gently: the balance of Objective vs Maintenance work, how Energy and Engagement",
    "moved through the week, which Sources of Meaning showed up or didn't, focus time, progress per",
    "Objective, and whether any Prototype moved. Be specific to the numbers. Warm, quiet, honest; no",
    "praise inflation, no guilt, no exclamation marks, no lists of advice, no medical claims.",
    "",
    `Write in ${language}.${locale === "vi" ? ` ${VI_TERMS}` : ""} Reply with JSON only, no other text:`,
    '{"observations": ["3 or 4 short sentences, each one observation"], "question": "one open question to sit with this week"}',
  ].join("\n");
  return { system, user: JSON.stringify(stats) };
}

export interface ReviewNotes {
  observations: string[];
  question: string | null;
}

/** Free models don't always follow instructions: find the JSON wherever it is, keep it short. */
export function parseReview(text: string): ReviewNotes | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const v = raw as { observations?: unknown; question?: unknown };
  const observations = (Array.isArray(v.observations) ? v.observations : [])
    .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
    .map((o) => o.trim().slice(0, 400))
    .slice(0, 4);
  if (!observations.length) return null;
  const question = typeof v.question === "string" && v.question.trim() ? v.question.trim().slice(0, 400) : null;
  return { observations, question };
}

/** One saved Weekly Review. `notes` is null when the AI couldn't answer (the numbers still stand). */
export interface WeeklyReview {
  weekEnd: LogicalDate;
  stats: WeekStats;
  notes: ReviewNotes | null;
  model: string | null;
  takeaway: string;
  createdAt: string;
}
