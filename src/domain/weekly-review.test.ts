import { describe, expect, it } from "vitest";
import type { FocusSession } from "./focus";
import type { DailyLog, Objective, OdysseyPlan, Task } from "./types";
import { parseReview, reviewPrompt, weekStats, weekToReview } from "./weekly-review";

// 2026-11-08 is a Sunday; the week under review is Mon 2026-11-02 … Sun 2026-11-08.
const SUN = "2026-11-08";
const tz = "Asia/Ho_Chi_Minh";

describe("which week to review", () => {
  it("Sunday evening and night: the week ending today", () => {
    expect(weekToReview(SUN, "evening")).toBe(SUN);
    expect(weekToReview(SUN, "night")).toBe(SUN);
  });
  it("not earlier on Sunday", () => {
    expect(weekToReview(SUN, "day")).toBeNull();
    expect(weekToReview(SUN, "morning")).toBeNull();
  });
  it("all of Monday: the week that just ended", () => {
    expect(weekToReview("2026-11-09", "morning")).toBe(SUN);
    expect(weekToReview("2026-11-09", "evening")).toBe(SUN);
  });
  it("no other day", () => {
    for (const d of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]) expect(weekToReview(d, "evening")).toBeNull();
  });
});

const plan = (slot: 1 | 2 | 3, title: string, isActive = false): OdysseyPlan => ({
  id: `p${slot}`,
  slot,
  title,
  questions: "",
  gauges: { resources: null, likability: null, confidence: null, coherence: null },
  isActive,
});
const plans = [plan(1, "Làm tiếp ở công ty", true), plan(2, "Mở một studio nhỏ"), plan(3, "")];
const objectives: Objective[] = [
  { id: "o1", planId: "p1", title: "Ra mắt bản beta", quarter: "2026-Q4", status: "active" },
  { id: "o2", planId: "p1", title: "Khỏe hơn", quarter: "2026-Q4", status: "active" },
  { id: "o3", planId: "p1", title: "Cũ đã xong", quarter: "2026-Q3", status: "done" },
];
const task = (id: string, kind: Task["kind"], doneAt: string | null, link: Partial<Task> = {}): Task => ({
  id,
  kind,
  objectiveId: kind === "objective" ? "o1" : null,
  prototypePlanId: kind === "prototype" ? "p2" : null,
  title: `Việc riêng tư ${id}`,
  dueDate: null,
  top3Date: null,
  doneAt,
  closedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...link,
});
const tasks: Task[] = [
  task("a", "objective", "2026-11-02T03:00:00.000Z"),
  task("b", "objective", "2026-11-04T03:00:00.000Z"),
  task("c", "objective", "2026-11-08T20:30:00.000Z"), // 03:30 on Mon the 9th → still Sunday's Logical Day
  task("d", "maintenance", "2026-11-05T03:00:00.000Z"),
  task("e", "prototype", "2026-11-06T03:00:00.000Z"),
  task("f", "objective", "2026-11-01T03:00:00.000Z"), // the Sunday before
  task("g", "objective", null, { objectiveId: "o2" }),
];
const log = (date: string, energy: number | null, engagement: number | null, meaningSources: DailyLog["meaningSources"], closed = true): DailyLog => ({
  date,
  intention: { when: "mình mở máy", then: "mình viết trước" },
  energy,
  engagement,
  meaningSources,
  note: "GHI CHÚ RIÊNG TƯ",
  top3TaskIds: [],
  morningAt: null,
  closedAt: closed ? `${date}T15:00:00.000Z` : null,
});
const logs = [log("2026-11-02", 4, 5, ["flow"]), log("2026-11-03", 2, 2, []), log("2026-11-05", 3, 4, ["flow", "community"]), log("2026-10-31", 5, 5, ["wonder"])];
const focus: FocusSession[] = [
  { id: "x", taskId: "a", startedAt: "2026-11-02T02:00:00.000Z", plannedMinutes: 50, endedAt: "2026-11-02T02:50:00.000Z" },
  { id: "y", taskId: "b", startedAt: "2026-11-04T02:00:00.000Z", plannedMinutes: 25, endedAt: "2026-11-04T02:10:00.000Z" },
  { id: "z", taskId: "b", startedAt: "2026-10-30T02:00:00.000Z", plannedMinutes: 25, endedAt: "2026-10-30T02:25:00.000Z" },
];
const stats = () => weekStats({ tasks, logs, focus, objectives, plans }, SUN, tz, 4, new Date("2026-11-08T13:00:00Z"));

describe("the week in numbers", () => {
  it("counts what was done, by kind, on the week's Logical Days only", () => {
    const s = stats();
    expect(s.weekEnd).toBe(SUN);
    expect(s.done).toEqual({ objective: 3, maintenance: 1, prototype: 1, total: 5 });
    expect(s.share).toEqual({ objective: 60, maintenance: 20, prototype: 20 });
  });

  it("each day Monday to Sunday: energy, engagement, whether it was closed", () => {
    const s = stats();
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(s.days[0]).toEqual({ date: "2026-11-02", weekday: "Mon", energy: 4, engagement: 5, closed: true });
    expect(s.days[2]).toEqual({ date: "2026-11-04", weekday: "Wed", energy: null, engagement: null, closed: false });
    expect(s.checkIns).toBe(3);
  });

  it("Sources of Meaning, focus minutes, and progress per Objective and per Prototype plan", () => {
    const s = stats();
    expect(s.meaning).toEqual({ wonder: 0, coherence: 0, flow: 2, community: 1 });
    expect(s.focusMinutes).toBe(60);
    expect(s.objectives).toEqual([
      { title: "Ra mắt bản beta", done: 3 },
      { title: "Khỏe hơn", done: 0 },
    ]);
    expect(s.prototypes).toEqual([{ plan: "Mở một studio nhỏ", done: 1 }]);
    expect(s.activePlan).toBe("Làm tiếp ở công ty");
  });
});

describe("what the AI is asked", () => {
  it("carries the numbers and titles, never notes, Intentions or task titles", () => {
    const { system, user } = reviewPrompt(stats(), "vi");
    const all = system + user;
    expect(all).toContain("Ra mắt bản beta");
    expect(all).toContain("Mở một studio nhỏ");
    expect(all).not.toContain("GHI CHÚ RIÊNG TƯ");
    expect(all).not.toContain("mình viết trước");
    expect(all).not.toContain("Việc riêng tư");
  });

  it("asks for the user's language, and for JSON", () => {
    expect(reviewPrompt(stats(), "vi").system).toMatch(/Vietnamese/);
    expect(reviewPrompt(stats(), "en").system).toMatch(/English/);
    expect(reviewPrompt(stats(), "en").system).toMatch(/JSON/);
  });
});

describe("reading the AI's answer", () => {
  const good = { observations: ["Một.", "Hai.", "Ba."], question: "Điều gì?" };

  it("takes plain JSON, JSON in a code fence, or JSON with words around it", () => {
    expect(parseReview(JSON.stringify(good))).toEqual(good);
    expect(parseReview("```json\n" + JSON.stringify(good) + "\n```")).toEqual(good);
    expect(parseReview("Đây là nhận xét:\n" + JSON.stringify(good) + "\nChúc bạn vui.")).toEqual(good);
  });

  it("keeps at most four short observations and drops empty ones", () => {
    const r = parseReview(JSON.stringify({ observations: ["a", "", "b", "c", "d", "e", "x".repeat(600)], question: "q" }));
    expect(r?.observations).toEqual(["a", "b", "c", "d"]);
    expect(parseReview(JSON.stringify({ observations: ["x".repeat(600)], question: "q" }))?.observations[0]).toHaveLength(400);
  });

  it("gives up on anything without observations", () => {
    expect(parseReview("Xin lỗi, tôi không thể.")).toBeNull();
    expect(parseReview(JSON.stringify({ observations: [], question: "q" }))).toBeNull();
    expect(parseReview("")).toBeNull();
  });

  it("a missing question is fine", () => {
    expect(parseReview(JSON.stringify({ observations: ["Một."] }))).toEqual({ observations: ["Một."], question: null });
  });
});
