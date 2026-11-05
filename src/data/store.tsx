"use client";

/**
 * The app's store. Signed in, every slice comes from the server (`live`): a change shows here first
 * (optimistic) and a Server Action saves it; a refused save reloads the server's version. Only
 * device preferences (sound, the last "why" in capture) stay in this browser.
 *
 * Signed out happens only in design review (`bun run dev:review`): the same store then runs on
 * sample data kept in localStorage, with review URLs:
 *   ?reset=1 (fresh sample data) · ?fresh=1 (first run) · ?at=HH:MM (time of day)
 *   ?day=N (pretend it is Logical Day N since setup — Odyssey nudges) · ?lang=vi|en
 */

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { carryOver as carryOverOf } from "@/domain/carry-over";
import { compassLineFor, type CompassLine } from "@/domain/compass-line";
import { missedCheckIn } from "@/domain/missed-check-in";
import { lifeShare, weekDots, type LifeShare } from "@/domain/life-share";
import { addDays, logicalDate, quarterOf } from "@/domain/logical-day";
import { objectiveRoom } from "@/domain/objectives";
import { applyOnboarding, freshOnboarding, todayCard, type OnboardingEvent, type PlanSlot, type TipId } from "@/domain/onboarding";
import { finishObjective as finishWith, objectivesToSettle, switchPlan, type Settle } from "@/domain/plan-switch";
import { leftovers, settleLeftover as settleWith, type LeftoverChoice } from "@/domain/quarter-close";
import { promotionEffects, validateTaskLink, type TaskLinkResult } from "@/domain/task-rules";
import type { Compass, DailyLog, Decision, LogicalDate, MeaningSource, Objective, OdysseyPlan, Task } from "@/domain/types";
import { useClock } from "@/ui/clock";
import { blank, fixtures } from "./fixtures";
import { ritualMode } from "@/domain/ritual-mode";
import * as server from "./actions";
import type { LiveData } from "./live";
import type { AppState, KindChoice, RitualMode } from "./state";

const REVIEW_KEY = "dhl:mock:v1";
const DEVICE_KEY = "dhl:device:v1";
const uid = () => crypto.randomUUID();
const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

type Device = { sound: boolean; lastKind: KindChoice | null };

function readDevice(): Device {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (raw) return { sound: true, lastKind: null, ...(JSON.parse(raw) as Partial<Device>) };
  } catch {}
  return { sound: true, lastKind: null };
}

/** A remembered "why" survives only while it can still be chosen. */
function stillValid(k: KindChoice | null, s: Pick<AppState, "objectives" | "plans">): KindChoice | null {
  if (!k) return null;
  if (k.kind === "maintenance") return k;
  if (k.kind === "objective") return s.objectives.some((o) => o.id === k.objectiveId && o.status === "active") ? k : null;
  return s.plans.some((p) => p.id === k.planId && !p.isActive) ? k : null;
}

/** The signed-in state: the server's data plus this device's preferences. */
function fromLive(live: LiveData, device: Device): AppState {
  return {
    version: 1,
    userId: live.userId,
    onboarded: live.onboarded,
    onboarding: live.onboarding,
    settings: { ...live.settings, sound: device.sound },
    compass: live.compass,
    plans: live.plans,
    objectives: live.objectives,
    tasks: live.tasks,
    logs: Object.fromEntries(live.logs.map((l) => [l.date, l])),
    decisions: live.decisions,
    lastKind: stillValid(device.lastKind, live),
  };
}

/** Design review only: sample data, kept in localStorage between page loads. */
function loadReview(): AppState {
  const params = new URLSearchParams(window.location.search);
  const tz = deviceTz();
  const today = logicalDate(new Date(), tz, 4);
  let state: AppState | null = params.has("fresh") ? blank(tz) : null;
  if (!state && !params.has("reset")) {
    try {
      const raw = localStorage.getItem(REVIEW_KEY);
      if (raw) state = JSON.parse(raw) as AppState;
    } catch {}
  }
  const lang = params.get("lang");
  const asked = lang === "vi" || lang === "en" ? lang : undefined;
  state ??= fixtures(today, tz, asked);
  if (asked) state = { ...state, settings: { ...state.settings, locale: asked } };

  const day = Number(params.get("day"));
  if (day >= 1 && state.onboarding.setupDate)
    state = { ...state, onboarding: { ...state.onboarding, setupDate: addDays(today, -(day - 1)) } };
  return state;
}

function emptyLog(date: LogicalDate): DailyLog {
  return { date, intention: null, energy: null, engagement: null, meaningSources: [], note: "", top3TaskIds: [], morningAt: null, closedAt: null };
}

type Saved = { ok: boolean };

function useStoreState(live: LiveData | null) {
  const [state, setState] = useState<AppState>(() => (live ? fromLive(live, readDevice()) : loadReview()));
  const { now } = useClock();
  const router = useRouter();
  const [syncFailures, setSyncFailures] = useState(0);

  // A fresh server snapshot (after a refresh) replaces what is on screen.
  const seen = useRef(live);
  useEffect(() => {
    if (!live || live === seen.current) return;
    seen.current = live;
    setState((s) => fromLive(live, { sound: s.settings.sound, lastKind: s.lastKind }));
  }, [live]);

  /** Send a change that is already on screen; if the server says no, reload its version. */
  const save = useCallback(
    (call: () => Promise<Saved>) => {
      if (!live) return;
      const fail = () => {
        setSyncFailures((n) => n + 1);
        router.refresh();
      };
      call().then((r) => !r.ok && fail(), fail);
    },
    [live, router],
  );

  useEffect(() => {
    try {
      if (live) {
        localStorage.setItem(DEVICE_KEY, JSON.stringify({ sound: state.settings.sound, lastKind: state.lastKind } satisfies Device));
        return;
      }
      // Review: keep the sample state pristine while a ?fresh first run is in progress; once setup
      // finishes, save it so day 2+ (?day=N) can be reviewed.
      if (new URLSearchParams(window.location.search).has("fresh") && !state.onboarded) return;
      localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
    } catch {}
  }, [state, live]);

  const { timeZone, dayEndHour, eveningHour } = state.settings;
  const today = logicalDate(now, timeZone, dayEndHour);
  const log = state.logs[today] ?? emptyLog(today);

  const mode: RitualMode = ritualMode(now, { timeZone, eveningHour, dayEndHour, morningAt: log.morningAt, closedAt: log.closedAt });

  const activePlan = state.plans.find((p) => p.isActive) ?? null;
  /** Yesterday, if its check-in was never closed. */
  const yesterdayOpen = missedCheckIn({ logs: state.logs, today, setupDate: state.onboarding.setupDate });

  // The React Compiler memoizes these derived values.
  const compassLine: CompassLine = compassLineFor({ userId: state.userId, date: today, compass: state.compass, activePlanTitle: activePlan?.title || null });

  const open = state.tasks.filter((t) => !t.doneAt && !t.closedAt);
  const top3 = state.tasks.filter((t) => t.top3Date === today && !t.closedAt);
  const carryOver = carryOverOf(Object.values(state.logs), state.tasks, today);
  const quarter = quarterOf(today);
  /** Last quarter's still-active Objectives, waiting for Quarter Close. They stay usable until then. */
  const leftoverObjectives = leftovers(state.objectives, quarter);
  const activeObjectives = state.objectives.filter((o) => o.status === "active" && o.quarter <= quarter);

  const card = todayCard({
    onboarding: state.onboarding,
    today,
    plans: state.plans,
    mode,
    hasTop3: top3.length > 0,
    hasClosedDay: Object.values(state.logs).some((l) => l.closedAt),
  });
  const tipUnseen = (tip: TipId) => state.onboarding.setupDate !== null && !state.onboarding.seenTips.includes(tip);

  const share: LifeShare = useMemo(
    () => lifeShare(state.tasks, { today, timeZone, dayEndHour }),
    [state.tasks, today, timeZone, dayEndHour],
  );
  const dots = useMemo(
    () =>
      weekDots(
        Object.values(state.logs).filter((l) => l.closedAt).map((l) => l.date),
        today,
      ),
    [state.logs, today],
  );

  // ── actions ─────────────────────────────────────────────

  const patchLogOf = useCallback(
    (date: LogicalDate, patch: Partial<Omit<DailyLog, "date" | "top3TaskIds">>) => {
      setState((s) => ({ ...s, logs: { ...s.logs, [date]: { ...(s.logs[date] ?? emptyLog(date)), ...patch } } }));
      save(() => server.patchLogAction(date, patch));
    },
    [save],
  );
  const patchLog = useCallback((patch: Parameters<typeof patchLogOf>[1]) => patchLogOf(today, patch), [patchLogOf, today]);

  const addTask = useCallback(
    (title: string, choice: KindChoice): TaskLinkResult => {
      const link = {
        kind: choice.kind,
        objectiveId: choice.kind === "objective" ? choice.objectiveId : null,
        prototypePlanId: choice.kind === "prototype" ? choice.planId : null,
      };
      const result = validateTaskLink(link, { plans: state.plans, objectives: state.objectives });
      if (!result.ok) return result;
      const task: Task = {
        id: uid(),
        title: title.trim(),
        ...link,
        dueDate: null,
        top3Date: null,
        doneAt: null,
        closedAt: null,
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, tasks: [task, ...s.tasks], lastKind: choice }));
      save(() => server.createTaskAction({ id: task.id, title: task.title, choice }));
      return result;
    },
    [state.plans, state.objectives, save],
  );

  /** Title, why and due date. The why follows the same rule as capture. */
  const editTask = useCallback(
    (id: string, patch: { title?: string; choice?: KindChoice; dueDate?: string | null }): TaskLinkResult => {
      const change: Partial<Task> = {};
      if (patch.title !== undefined) change.title = patch.title.trim();
      if (patch.dueDate !== undefined) change.dueDate = patch.dueDate;
      if (patch.choice) {
        const c = patch.choice;
        const link = {
          kind: c.kind,
          objectiveId: c.kind === "objective" ? c.objectiveId : null,
          prototypePlanId: c.kind === "prototype" ? c.planId : null,
        };
        const result = validateTaskLink(link, { plans: state.plans, objectives: state.objectives });
        if (!result.ok) return result;
        Object.assign(change, link);
      }
      setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...change } : t)) }));
      save(() => server.editTaskAction(id, patch));
      return { ok: true };
    },
    [state.plans, state.objectives, save],
  );

  /** Let it go: it ends without being done and stays as history. */
  const closeTask = useCallback(
    (id: string) => {
      const at = new Date().toISOString();
      setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id && !t.doneAt && !t.closedAt ? { ...t, closedAt: at } : t)) }));
      save(() => server.closeTaskAction(id));
    },
    [save],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return;
      const done = !t.doneAt;
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, doneAt: done ? new Date().toISOString() : null } : x)),
      }));
      save(() => server.setDoneAction(id, done));
    },
    [state.tasks, save],
  );

  /** Returns false when the Top 3 is already full. */
  const toggleTop3 = useCallback(
    (id: string): boolean => {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return false;
      const isIn = t.top3Date === today;
      if (!isIn && top3.length >= 3) return false;
      setState((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, top3Date: isIn ? null : today } : x)) }));
      save(() => server.setTop3Action(id, isIn ? null : today));
      return true;
    },
    [state.tasks, today, top3.length, save],
  );

  /** Only for mistakes: leaves no trace. */
  const deleteTask = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      save(() => server.deleteTaskAction(id));
    },
    [save],
  );

  const finishMorning = useCallback(
    (top3Ids: string[], intention: DailyLog["intention"]) => {
      const morningAt = new Date().toISOString();
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          top3Ids.includes(t.id) ? { ...t, top3Date: today } : t.top3Date === today ? { ...t, top3Date: null } : t,
        ),
        logs: {
          ...s.logs,
          [today]: { ...(s.logs[today] ?? emptyLog(today)), intention, morningAt, top3TaskIds: top3Ids },
        },
      }));
      save(() => server.replaceTop3Action(today, top3Ids));
      save(() => server.patchLogAction(today, { intention, morningAt }));
    },
    [today, save],
  );

  const skipMorning = useCallback(() => patchLog({ morningAt: new Date().toISOString() }), [patchLog]);
  const setIntention = useCallback((intention: DailyLog["intention"]) => patchLog({ intention }), [patchLog]);

  const closeDay = useCallback(
    (entry: { energy: number | null; engagement: number | null; meaningSources: MeaningSource[]; note: string }) =>
      patchLog({ ...entry, closedAt: new Date().toISOString() }),
    [patchLog],
  );

  const reopenDay = useCallback(() => patchLog({ closedAt: null }), [patchLog]);

  /** "Close yesterday?" — the reflection only, no task ticking; counts toward the week dots. */
  const closeYesterday = useCallback(
    (entry: { energy: number | null; engagement: number | null; meaningSources: MeaningSource[]; note: string }) => {
      if (yesterdayOpen) patchLogOf(yesterdayOpen, { ...entry, closedAt: new Date().toISOString() });
    },
    [patchLogOf, yesterdayOpen],
  );

  const updateCompass = useCallback(
    (compass: Compass) => {
      setState((s) => ({ ...s, compass }));
      save(() => server.saveCompassAction(compass));
    },
    [save],
  );

  const savePlan = useCallback(
    (plan: OdysseyPlan) => {
      setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? plan : p)) }));
      save(() => server.savePlanAction(plan));
    },
    [save],
  );

  const openPrototypesOf = useCallback((planId: string) => promotionEffects(planId, state.tasks), [state.tasks]);

  /** The still-active Objectives a switch away from the current Active Plan has to settle. */
  const toSettle = objectivesToSettle(state);

  /** Switch the Active Plan (see `switchPlan`): the old plan's Objectives kept or dropped, the new one's Prototypes folded or closed. */
  const setActivePlan = useCallback(
    (planId: string, settle: Settle) => {
      const ctx = { quarter, now: new Date().toISOString(), newObjectiveId: uid() };
      const r = switchPlan({ plans: state.plans, objectives: state.objectives, tasks: state.tasks }, planId, settle, ctx);
      if (!r.ok) return false;
      setState((s) => ({ ...s, ...r.world, lastKind: null }));
      save(() => server.setActivePlanAction(planId, settle, quarter, ctx.newObjectiveId));
      return true;
    },
    [state.plans, state.objectives, state.tasks, quarter, save],
  );

  /** Mark an Objective Done; its open tasks are closed (default) or moved to another active one. */
  const finishObjective = useCallback(
    (id: string, then: "close" | { move: string }) => {
      const r = finishWith({ objectives: state.objectives, tasks: state.tasks }, id, then, new Date().toISOString());
      if (!r.ok) return;
      setState((s) => ({ ...s, ...r.world }));
      save(() => server.finishObjectiveAction(id, then));
    },
    [state.objectives, state.tasks, save],
  );

  /** Quarter Close: Done, Drop or Carry forward one leftover Objective. */
  const settleLeftover = useCallback(
    (id: string, choice: LeftoverChoice) => {
      const ctx = { quarter, now: new Date().toISOString(), newObjectiveId: uid() };
      const r = settleWith({ objectives: state.objectives, tasks: state.tasks }, id, choice, ctx);
      if (!r.ok) return false;
      setState((s) => ({ ...s, ...r.world }));
      save(() => server.settleLeftoverAction(id, choice, ctx.newObjectiveId));
      return true;
    },
    [state.objectives, state.tasks, quarter, save],
  );

  const addObjective = useCallback(
    (title: string) => {
      if (objectiveRoom(state.objectives, quarter) === 0) return null;
      // Until a plan is active, Objectives sit under the implicit Current Path (slot 1).
      const planId = (state.plans.find((p) => p.isActive) ?? state.plans.find((p) => p.slot === 1))!.id;
      const o: Objective = { id: uid(), planId, title: title.trim(), quarter, status: "active" };
      setState((s) => ({ ...s, objectives: [...s.objectives, o] }));
      save(() => server.addObjectiveAction({ id: o.id, title: o.title, quarter }));
      return o;
    },
    [state.plans, state.objectives, quarter, save],
  );

  const setObjectiveStatus = useCallback(
    (id: string, status: Objective["status"]) => {
      // Reactivating one only fits while there is room.
      if (status === "active" && objectiveRoom(state.objectives, quarter) === 0) return;
      if (status === "done") return finishObjective(id, "close");
      setState((s) => ({ ...s, objectives: s.objectives.map((o) => (o.id === id ? { ...o, status } : o)) }));
      save(() => server.setObjectiveStatusAction(id, status));
    },
    [state.objectives, quarter, save, finishObjective],
  );

  const addDecision = useCallback(
    (d: Omit<Decision, "id" | "date">) => {
      const decision: Decision = { ...d, id: uid(), date: today };
      setState((s) => ({ ...s, decisions: [decision, ...s.decisions] }));
      save(() => server.addDecisionAction(decision));
    },
    [today, save],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppState["settings"]>) => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      // Sound stays on this device; the rest lives on the user row.
      const onUserRow = Object.fromEntries(Object.entries(patch).filter(([k]) => k !== "sound"));
      if (Object.keys(onUserRow).length) save(() => server.saveSettingsAction(onUserRow));
    },
    [save],
  );

  /**
   * Tips, nudges and the reminder ask follow the user across devices. The server applies the same
   * event to what it has stored, so one device never undoes another.
   */
  const recordOnboarding = useCallback(
    (event: OnboardingEvent) => {
      const next = applyOnboarding(state.onboarding, event, { today, now: new Date().toISOString() });
      if (next === state.onboarding) return;
      setState((s) => ({ ...s, onboarding: next }));
      save(() => server.recordOnboardingAction(event));
    },
    [state.onboarding, today, save],
  );
  const dismissTip = useCallback((tip: TipId) => recordOnboarding({ type: "tipSeen", tip }), [recordOnboarding]);
  const showTipsAgain = useCallback(() => recordOnboarding({ type: "tipsReset" }), [recordOnboarding]);
  const notNowNudge = useCallback((slot: PlanSlot) => recordOnboarding({ type: "nudgeNotNow", slot }), [recordOnboarding]);
  /** The reminder is offered once, whatever the answer. */
  const answerReminder = useCallback(() => recordOnboarding({ type: "reminderAsked" }), [recordOnboarding]);

  const completeOnboarding = useCallback(
    (input: { compass: Compass; objective: string; tasks: { title: string; today: boolean }[] }) => {
      const plan = (state.plans.find((p) => p.isActive) ?? state.plans.find((p) => p.slot === 1))!;
      const objective: Objective = { id: uid(), planId: plan.id, title: input.objective.trim(), quarter, status: "active" };
      const nowIso = new Date().toISOString();
      const firsts = input.tasks.filter((t) => t.title.trim()).map((t) => ({ ...t, id: uid(), title: t.title.trim() }));
      const tasks: Task[] = firsts.map((t) => ({
        id: t.id,
        title: t.title,
        kind: "objective",
        objectiveId: objective.id,
        prototypePlanId: null,
        dueDate: null,
        // "Which of these is for today?" — the user's own picks become today's Top 3.
        top3Date: t.today ? today : null,
        doneAt: null,
        closedAt: null,
        createdAt: nowIso,
      }));
      setState((s) => ({
        ...s,
        onboarded: true,
        onboarding: freshOnboarding(today),
        // Day 1 counts as the Morning Ritual done — setup asked enough. The ritual starts on day 2.
        logs: {
          ...s.logs,
          [today]: { ...(s.logs[today] ?? emptyLog(today)), morningAt: nowIso, top3TaskIds: tasks.filter((t) => t.top3Date).map((t) => t.id) },
        },
        compass: input.compass,
        objectives: [...s.objectives, objective],
        tasks: [...tasks, ...s.tasks],
        lastKind: { kind: "objective", objectiveId: objective.id },
      }));
      save(() =>
        server.completeOnboardingAction({
          compass: input.compass,
          objective: { id: objective.id, title: objective.title },
          tasks: firsts.map(({ id, title, today: forToday }) => ({ id, title, today: forToday })),
          today,
          quarter,
        }),
      );
    },
    [state.plans, quarter, today, save],
  );

  /** Design review only: start over from the sample data. */
  const resetFixtures = useCallback(() => {
    if (!live) setState((s) => fixtures(today, timeZone, s.settings.locale));
  }, [today, timeZone, live]);

  return {
    state,
    now,
    today,
    mode,
    log,
    quarter,
    activePlan,
    compassLine,
    open,
    top3,
    carryOver,
    activeObjectives,
    leftoverObjectives,
    share,
    dots,
    card,
    tipUnseen,
    isLive: live !== null,
    yesterdayOpen,
    toSettle,
    syncFailures,
    actions: {
      addTask,
      editTask,
      closeTask,
      toggleDone,
      toggleTop3,
      deleteTask,
      finishMorning,
      skipMorning,
      setIntention,
      closeDay,
      closeYesterday,
      reopenDay,
      updateCompass,
      savePlan,
      openPrototypesOf,
      setActivePlan,
      finishObjective,
      settleLeftover,
      addObjective,
      setObjectiveStatus,
      addDecision,
      updateSettings,
      completeOnboarding,
      dismissTip,
      showTipsAgain,
      notNowNudge,
      answerReminder,
      resetFixtures,
    },
  };
}

export type Store = ReturnType<typeof useStoreState>;
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ live, children }: { live: LiveData | null; children: ReactNode }) {
  const store = useStoreState(live);
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
