import { addDays, quarterOf } from "@/domain/logical-day";
import type { DailyLog, LogicalDate, Task } from "@/domain/types";
import type { AppState } from "./state";

/** A lived-in week for design review. Dates are relative to `today`. */
export function fixtures(today: LogicalDate, timeZone: string): AppState {
  const q = quarterOf(today);
  const at = (date: LogicalDate, hh: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setHours(hh, 12, 0, 0);
    return d.toISOString();
  };
  const y = addDays(today, -1);

  const t = (id: string, title: string, rest: Partial<Task>): Task => ({
    id,
    title,
    kind: "maintenance",
    objectiveId: null,
    prototypePlanId: null,
    dueDate: null,
    top3Date: null,
    doneAt: null,
    closedAt: null,
    createdAt: at(addDays(today, -8), 9),
    ...rest,
  });

  const log = (date: LogicalDate, e: number, g: number, m: DailyLog["meaningSources"], note = ""): DailyLog => ({
    date,
    intention: null,
    energy: e,
    engagement: g,
    meaningSources: m,
    note,
    morningAt: at(date, 7),
    closedAt: at(date, 21),
  });

  return {
    version: 1,
    userId: "user_owner",
    onboarded: true,
    settings: { timeZone, reminderTime: "07:00", eveningHour: 19, dayEndHour: 4, theme: "sky", sound: true },
    compass: {
      workview: "Work is how I turn curiosity into tools that make other people’s days a little lighter.",
      lifeview: "Life is for the people I love, the mountains I haven’t climbed yet, and learning slowly.",
    },
    plans: [
      {
        id: "plan_1",
        slot: 1,
        title: "Lead AI products, build calmer teams",
        questions: "Can I grow as a leader without giving up deep work?",
        gauges: { resources: 7, likability: 6, confidence: 7, coherence: 8 },
        isActive: true,
      },
      {
        id: "plan_2",
        slot: 2,
        title: "Independent studio, small useful apps",
        questions: "Can a two-person studio support a family?",
        gauges: { resources: 4, likability: 8, confidence: 5, coherence: 7 },
        isActive: false,
      },
      {
        id: "plan_3",
        slot: 3,
        title: "Teach design thinking in the highlands",
        questions: "Would teaching feel like enough? Could we live in Da Lat?",
        gauges: { resources: 3, likability: 9, confidence: 4, coherence: 6 },
        isActive: false,
      },
    ],
    objectives: [
      { id: "obj_1", planId: "plan_1", title: "Ship v1 of this app and use it five days a week", quarter: q, status: "active" },
      { id: "obj_2", planId: "plan_1", title: "Run three mornings a week", quarter: q, status: "active" },
      { id: "obj_3", planId: "plan_1", title: "Write a monthly letter to my team", quarter: q, status: "active" },
    ],
    tasks: [
      t("t1", "Sketch the evening check-in sheet", { kind: "objective", objectiveId: "obj_1", top3Date: y, doneAt: at(y, 15) }),
      t("t2", "Wire the living sky to real time", { kind: "objective", objectiveId: "obj_1", top3Date: y }),
      t("t3", "Morning run along the river", { kind: "objective", objectiveId: "obj_2", top3Date: y, doneAt: at(y, 6) }),
      t("t4", "Draft November team letter", { kind: "objective", objectiveId: "obj_3" }),
      t("t5", "Coffee with Linh about her studio", { kind: "prototype", prototypePlanId: "plan_2" }),
      t("t6", "Ask the Da Lat design school about a weekend workshop", { kind: "prototype", prototypePlanId: "plan_3" }),
      t("t7", "Pay the electricity bill", { kind: "maintenance", dueDate: today }),
      t("t8", "Renew motorbike insurance", { kind: "maintenance" }),
      t("t9", "Groceries for the week", { kind: "maintenance" }),
      t("t10", "Run · intervals", { kind: "objective", objectiveId: "obj_2", doneAt: at(addDays(today, -3), 6) }),
      t("t11", "Outline the onboarding flow", { kind: "objective", objectiveId: "obj_1", doneAt: at(addDays(today, -2), 11) }),
      t("t12", "Fix the leaking tap", { kind: "maintenance", doneAt: at(addDays(today, -2), 18) }),
      t("t13", "Read about studio pricing", { kind: "prototype", prototypePlanId: "plan_2", doneAt: at(addDays(today, -4), 20) }),
      t("t14", "Run · easy 5k", { kind: "objective", objectiveId: "obj_2", doneAt: at(addDays(today, -5), 6) }),
      t("t15", "Tax paperwork", { kind: "maintenance", doneAt: at(addDays(today, -5), 14) }),
    ],
    logs: {
      [addDays(today, -6)]: log(addDays(today, -6), 3, 4, ["flow"]),
      [addDays(today, -5)]: log(addDays(today, -5), 4, 4, ["flow", "community"]),
      [addDays(today, -4)]: log(addDays(today, -4), 2, 3, ["wonder"]),
      [addDays(today, -2)]: log(addDays(today, -2), 4, 5, ["flow", "coherence"], "Two hours on the app without noticing the time."),
      [y]: {
        ...log(y, 4, 4, ["community", "coherence"], "Dinner with the family, phones away."),
        intention: { when: "I sit down after lunch", then: "write for twenty minutes" },
      },
    },
    decisions: [
      {
        id: "dec_1",
        date: addDays(today, -12),
        decision: "Said no to the weekend side contract",
        drivenBy: "Lifeview: family time is not negotiable this quarter.",
        linkedPlanId: "plan_1",
      },
    ],
    lastKind: { kind: "objective", objectiveId: "obj_1" },
  };
}

/** Empty state for reviewing the first run. */
export function blank(timeZone: string): AppState {
  return {
    version: 1,
    userId: "user_owner",
    onboarded: false,
    settings: { timeZone, reminderTime: "07:00", eveningHour: 19, dayEndHour: 4, theme: "sky", sound: true },
    compass: null,
    plans: [1, 2, 3].map((slot) => ({
      id: `plan_${slot}`,
      slot: slot as 1 | 2 | 3,
      title: "",
      questions: "",
      gauges: { resources: null, likability: null, confidence: null, coherence: null },
      isActive: slot === 1,
    })),
    objectives: [],
    tasks: [],
    logs: {},
    decisions: [],
    lastKind: null,
  };
}
