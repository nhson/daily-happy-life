"use client";

/**
 * Phase 0 in-memory store (persisted to localStorage). Same shape and domain rules the
 * real Server Actions will use; deleted after Slice 3.
 *
 * Review URLs:  ?reset=1 (fresh fixtures) · ?fresh=1 (first run) · ?at=HH:MM (time of day)
 *                ?day=N (pretend it is Logical Day N since setup — Odyssey nudges)
 *                ?lang=vi|en (switch the language, as Settings does)
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { compassLineFor, type CompassLine } from "@/domain/compass-line";
import { lifeShare, weekDots, type LifeShare } from "@/domain/life-share";
import { addDays, logicalDate, quarterOf } from "@/domain/logical-day";
import { checkFold, objectiveRoom, type FoldResolution } from "@/domain/objectives";
import { freshOnboarding, snoozeNudge, todayCard, type PlanSlot, type TipId } from "@/domain/onboarding";
import { promotionEffects, validateTaskLink, type TaskLinkResult } from "@/domain/task-rules";
import type { Compass, DailyLog, Decision, LogicalDate, MeaningSource, Objective, OdysseyPlan, Task } from "@/domain/types";
import { useClock } from "@/ui/clock";
import { blank, fixtures } from "./fixtures";
import type { AppState, KindChoice, RitualMode } from "./state";

const KEY = "dhl:mock:v1";
const uid = () => crypto.randomUUID().slice(0, 8);
const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function load(): AppState {
  const params = new URLSearchParams(window.location.search);
  const tz = deviceTz();
  const today = logicalDate(new Date(), tz, 4);
  let state: AppState | null = params.has("fresh") ? blank(tz) : null;
  if (!state && !params.has("reset")) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = JSON.parse(raw) as AppState;
    } catch {}
  }
  const lang = params.get("lang");
  const asked = lang === "vi" || lang === "en" ? lang : undefined;
  state ??= fixtures(today, tz, asked);

  // Saved before onboarding state existed: an onboarded user has seen it all.
  if (!state.onboarding)
    state = {
      ...state,
      onboarding: state.onboarded
        ? { setupDate: addDays(today, -30), seenTips: ["top3", "capture", "morning", "evening", "closedDay", "life"], reminderAskedAt: new Date().toISOString(), nudges: {} }
        : freshOnboarding(null),
    };

  // Saved before languages existed: Vietnamese is the default.
  if (!state.settings.locale) state = { ...state, settings: { ...state.settings, locale: "vi" } };
  if (asked) state = { ...state, settings: { ...state.settings, locale: asked } };

  const day = Number(params.get("day"));
  if (day >= 1 && state.onboarding.setupDate)
    state = { ...state, onboarding: { ...state.onboarding, setupDate: addDays(today, -(day - 1)) } };
  return state;
}

function emptyLog(date: LogicalDate): DailyLog {
  return { date, intention: null, energy: null, engagement: null, meaningSources: [], note: "", morningAt: null, closedAt: null };
}

function useStoreState() {
  const [state, setState] = useState<AppState>(load);
  const { now } = useClock();

  useEffect(() => {
    // Keep the saved review state pristine while a ?fresh first run is in progress; once setup
    // finishes, save it so day 2+ (?day=N) can be reviewed.
    if (new URLSearchParams(window.location.search).has("fresh") && !state.onboarded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const { timeZone, dayEndHour, eveningHour } = state.settings;
  const today = logicalDate(now, timeZone, dayEndHour);
  const hour = now.getHours();
  const log = state.logs[today] ?? emptyLog(today);

  const mode: RitualMode = log.closedAt
    ? "night"
    : hour >= eveningHour || hour < dayEndHour
      ? "evening"
      : log.morningAt
        ? "day"
        : "morning";

  const activePlan = state.plans.find((p) => p.isActive) ?? null;

  const compassLine: CompassLine = useMemo(
    () => compassLineFor({ userId: state.userId, date: today, compass: state.compass, activePlanTitle: activePlan?.title || null }),
    [state.userId, today, state.compass, activePlan?.title],
  );

  const open = state.tasks.filter((t) => !t.doneAt && !t.closedAt);
  const top3 = state.tasks.filter((t) => t.top3Date === today && !t.closedAt);
  const carryOver = state.tasks.filter((t) => t.top3Date === addDays(today, -1) && !t.doneAt && !t.closedAt);
  const quarter = quarterOf(today);
  const activeObjectives = state.objectives.filter((o) => o.status === "active" && o.quarter === quarter);

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

  const patchLog = useCallback(
    (patch: Partial<DailyLog>) =>
      setState((s) => ({ ...s, logs: { ...s.logs, [today]: { ...(s.logs[today] ?? emptyLog(today)), ...patch } } })),
    [today],
  );

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
      return result;
    },
    [state.plans, state.objectives],
  );

  const toggleDone = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, doneAt: t.doneAt ? null : new Date().toISOString() } : t)),
    }));
  }, []);

  /** Returns false when the Top 3 is already full. */
  const toggleTop3 = useCallback(
    (id: string): boolean => {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return false;
      const isIn = t.top3Date === today;
      if (!isIn && top3.length >= 3) return false;
      setState((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, top3Date: isIn ? null : today } : x)) }));
      return true;
    },
    [state.tasks, today, top3.length],
  );

  const deleteTask = useCallback((id: string) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })), []);

  const finishMorning = useCallback(
    (top3Ids: string[], intention: DailyLog["intention"]) => {
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          top3Ids.includes(t.id) ? { ...t, top3Date: today } : t.top3Date === today ? { ...t, top3Date: null } : t,
        ),
        logs: {
          ...s.logs,
          [today]: { ...(s.logs[today] ?? emptyLog(today)), intention, morningAt: new Date().toISOString() },
        },
      }));
    },
    [today],
  );

  const skipMorning = useCallback(() => patchLog({ morningAt: new Date().toISOString() }), [patchLog]);
  const setIntention = useCallback((intention: DailyLog["intention"]) => patchLog({ intention }), [patchLog]);

  const closeDay = useCallback(
    (entry: { energy: number | null; engagement: number | null; meaningSources: MeaningSource[]; note: string }) =>
      patchLog({ ...entry, closedAt: new Date().toISOString() }),
    [patchLog],
  );

  const reopenDay = useCallback(() => patchLog({ closedAt: null }), [patchLog]);

  const updateCompass = useCallback((compass: Compass) => setState((s) => ({ ...s, compass })), []);

  const savePlan = useCallback(
    (plan: OdysseyPlan) => setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? plan : p)) })),
    [],
  );

  const openPrototypesOf = useCallback((planId: string) => promotionEffects(planId, state.tasks), [state.tasks]);

  /**
   * Switch the Active Plan. Its open prototypes are folded into a new objective (only while there
   * is room), into an active one (which moves under the new plan), or closed.
   */
  const setActivePlan = useCallback(
    (planId: string, resolution: FoldResolution | null) => {
      setState((s) => {
        const affected = new Set(promotionEffects(planId, s.tasks).map((t) => t.id));
        if (resolution && affected.size && checkFold(resolution, s.objectives, quarter) !== "ok") return s;
        let objectives = [...s.objectives];
        let foldId: string | null = null;
        if (resolution && resolution !== "close" && affected.size) {
          if ("fold" in resolution) {
            foldId = uid();
            objectives.push({ id: foldId, planId, title: resolution.fold, quarter, status: "active" });
          } else {
            foldId = resolution.into;
            objectives = objectives.map((o) => (o.id === foldId ? { ...o, planId } : o));
          }
        }
        const nowIso = new Date().toISOString();
        return {
          ...s,
          plans: s.plans.map((p) => ({ ...p, isActive: p.id === planId })),
          objectives,
          tasks: s.tasks.map((t) => {
            if (!affected.has(t.id)) return t;
            return foldId
              ? { ...t, kind: "objective", objectiveId: foldId, prototypePlanId: null }
              : { ...t, closedAt: nowIso };
          }),
          lastKind: null,
        };
      });
    },
    [quarter],
  );

  const addObjective = useCallback(
    (title: string) => {
      if (objectiveRoom(state.objectives, quarter) === 0) return null;
      const planId = state.plans.find((p) => p.isActive)?.id ?? "plan_1";
      const o: Objective = { id: uid(), planId, title: title.trim(), quarter, status: "active" };
      setState((s) => ({ ...s, objectives: [...s.objectives, o] }));
      return o;
    },
    [state.plans, state.objectives, quarter],
  );

  const setObjectiveStatus = useCallback(
    (id: string, status: Objective["status"]) =>
      setState((s) =>
        // Reactivating one only fits while there is room.
        status === "active" && objectiveRoom(s.objectives, quarter) === 0
          ? s
          : { ...s, objectives: s.objectives.map((o) => (o.id === id ? { ...o, status } : o)) },
      ),
    [quarter],
  );

  const addDecision = useCallback(
    (d: Omit<Decision, "id" | "date">) =>
      setState((s) => ({ ...s, decisions: [{ ...d, id: uid(), date: today }, ...s.decisions] })),
    [today],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppState["settings"]>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [],
  );

  const dismissTip = useCallback(
    (tip: TipId) =>
      setState((s) =>
        s.onboarding.seenTips.includes(tip) ? s : { ...s, onboarding: { ...s.onboarding, seenTips: [...s.onboarding.seenTips, tip] } },
      ),
    [],
  );
  const showTipsAgain = useCallback(() => setState((s) => ({ ...s, onboarding: { ...s.onboarding, seenTips: [] } })), []);
  const notNowNudge = useCallback(
    (slot: PlanSlot) => setState((s) => ({ ...s, onboarding: snoozeNudge(s.onboarding, slot, today) })),
    [today],
  );
  /** The reminder is offered once, whatever the answer. */
  const answerReminder = useCallback(
    () => setState((s) => ({ ...s, onboarding: { ...s.onboarding, reminderAskedAt: new Date().toISOString() } })),
    [],
  );

  const completeOnboarding = useCallback(
    (input: { compass: Compass; objective: string; tasks: { title: string; today: boolean }[] }) => {
      setState((s) => {
        const plan = s.plans.find((p) => p.isActive) ?? s.plans[0];
        const objective: Objective = { id: uid(), planId: plan.id, title: input.objective.trim(), quarter, status: "active" };
        const nowIso = new Date().toISOString();
        const tasks: Task[] = input.tasks
          .filter((t) => t.title.trim())
          .map((t) => ({
            id: uid(),
            title: t.title.trim(),
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
        return {
          ...s,
          onboarded: true,
          onboarding: freshOnboarding(today),
          // Day 1 counts as the Morning Ritual done — setup asked enough. The ritual starts on day 2.
          logs: { ...s.logs, [today]: { ...(s.logs[today] ?? emptyLog(today)), morningAt: nowIso } },
          compass: input.compass,
          objectives: [...s.objectives, objective],
          tasks: [...tasks, ...s.tasks],
          lastKind: { kind: "objective", objectiveId: objective.id },
        };
      });
    },
    [quarter, today],
  );

  const resetFixtures = useCallback(() => setState((s) => fixtures(today, timeZone, s.settings.locale)), [today, timeZone]);

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
    share,
    dots,
    card,
    tipUnseen,
    actions: {
      addTask,
      toggleDone,
      toggleTop3,
      deleteTask,
      finishMorning,
      skipMorning,
      setIntention,
      closeDay,
      reopenDay,
      updateCompass,
      savePlan,
      openPrototypesOf,
      setActivePlan,
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreState();
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
