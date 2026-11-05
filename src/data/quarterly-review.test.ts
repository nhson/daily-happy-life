import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { ensurePlans, listPlans, savePlan } from "./plans";
import { getCompass, saveCompass } from "./life";
import { completeQuarterReview, finishQuarterPlans, listCompassVersions, listQuarterReviews, reviewCompass, saveDashboard } from "./quarterly-review";
import { ensureUser, type Db } from "./users";

let db: Db;
let me: string;
let other: string;
const Q = "2026-Q4";
const T0 = "2027-01-02T01:00:00.000Z";
const T1 = "2027-01-02T01:05:00.000Z";

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  other = (await ensureUser(db, "user_other", "Asia/Ho_Chi_Minh")).id;
  await ensurePlans(db, me);
  const [p1, p2] = await listPlans(db, me);
  await savePlan(db, me, { ...p1, title: "Con đường hiện tại", gauges: { resources: 6, likability: 5, confidence: 7, coherence: 6 } });
  await savePlan(db, me, { ...p2, title: "Mở studio gốm nhỏ ở Đà Lạt", gauges: { resources: 3, likability: 9, confidence: 4, coherence: 8 } });
});

describe("a Quarterly Review, step by step", () => {
  it("starts with the dashboard, keeps the plans as rated, then finishes", async () => {
    expect(await saveDashboard(db, me, Q, { health: 6, work: 8, play: 3, love: 9 })).toEqual({ ok: true });
    let [r] = await listQuarterReviews(db, me);
    expect(r).toMatchObject({ quarter: Q, dashboard: { health: 6, work: 8, play: 3, love: 9 }, plans: null, plansReviewedAt: null, completedAt: null });

    const [p1] = await listPlans(db, me);
    expect(await finishQuarterPlans(db, me, Q, T0, [{ planId: p1.id, gauges: { ...p1.gauges, confidence: 9 } }])).toEqual({ ok: true });
    expect((await listPlans(db, me))[0].gauges.confidence).toBe(9);
    [r] = await listQuarterReviews(db, me);
    expect(r.plansReviewedAt).toBe(T0);
    expect(r.plans?.map((p) => [p.slot, p.title, p.gauges.confidence])).toEqual([
      [1, "Con đường hiện tại", 9],
      [2, "Mở studio gốm nhỏ ở Đà Lạt", 4],
    ]);
    expect(r.activePlanId).toBeNull(); // none chosen yet: the implicit Current Path

    expect(await completeQuarterReview(db, me, Q, T1)).toEqual({ ok: true });
    [r] = await listQuarterReviews(db, me);
    expect(r.completedAt).toBe(T1);
  });

  it("a skipped dashboard still starts the review, unrated", async () => {
    await saveDashboard(db, me, Q, { health: null, work: null, play: null, love: null });
    const [r] = await listQuarterReviews(db, me);
    expect(r.dashboard).toEqual({ health: null, work: null, play: null, love: null });
  });

  it("saving the dashboard again changes the ratings, nothing else", async () => {
    await saveDashboard(db, me, Q, { health: 6, work: 8, play: 3, love: 9 });
    await finishQuarterPlans(db, me, Q, T0);
    await saveDashboard(db, me, Q, { health: 7, work: 8, play: 3, love: 9 });
    const [r] = await listQuarterReviews(db, me);
    expect(r.dashboard.health).toBe(7);
    expect(r.plansReviewedAt).toBe(T0);
  });

  it("the plans step records the Active Plan after a switch", async () => {
    const [, p2] = await listPlans(db, me);
    await db.update(schema.odysseyPlans).set({ isActive: true }).where(eq(schema.odysseyPlans.id, p2.id));
    await saveDashboard(db, me, Q, { health: 5, work: 5, play: 5, love: 5 });
    await finishQuarterPlans(db, me, Q, T0);
    const [r] = await listQuarterReviews(db, me);
    expect(r.activePlanId).toBe(p2.id);
  });

  it("steps out of order are refused", async () => {
    expect(await finishQuarterPlans(db, me, Q, T0)).toEqual({ ok: false, error: "not_started" });
    await saveDashboard(db, me, Q, { health: 5, work: 5, play: 5, love: 5 });
    expect(await completeQuarterReview(db, me, Q, T1)).toEqual({ ok: false, error: "not_started" });
    expect(await listQuarterReviews(db, me)).toHaveLength(1);
  });

  it("finishing twice keeps the first time", async () => {
    await saveDashboard(db, me, Q, { health: 5, work: 5, play: 5, love: 5 });
    await finishQuarterPlans(db, me, Q, T0);
    await completeQuarterReview(db, me, Q, T1);
    expect(await completeQuarterReview(db, me, Q, "2027-01-09T00:00:00.000Z")).toEqual({ ok: true });
    expect((await listQuarterReviews(db, me))[0].completedAt).toBe(T1);
  });
});

describe("whose review", () => {
  it("each user sees and changes only their own", async () => {
    await saveDashboard(db, me, Q, { health: 6, work: 8, play: 3, love: 9 });
    expect(await listQuarterReviews(db, other)).toEqual([]);
    const [p1] = await listPlans(db, me);
    await saveDashboard(db, other, Q, { health: 1, work: 1, play: 1, love: 1 });
    // Another user's re-rating can't reach my plans.
    await finishQuarterPlans(db, other, Q, T0, [{ planId: p1.id, gauges: { resources: 0, likability: 0, confidence: 0, coherence: 0 } }]);
    expect((await listPlans(db, me))[0].gauges.resources).toBe(6);
    expect((await listQuarterReviews(db, me))[0].plansReviewedAt).toBeNull();
  });

  it("newest quarter first", async () => {
    await saveDashboard(db, me, "2026-Q3", { health: 1, work: 1, play: 1, love: 1 });
    await saveDashboard(db, me, Q, { health: 2, work: 2, play: 2, love: 2 });
    expect((await listQuarterReviews(db, me)).map((r) => r.quarter)).toEqual([Q, "2026-Q3"]);
  });

  it("goes when the user goes", async () => {
    await saveDashboard(db, me, Q, { health: 6, work: 8, play: 3, love: 9 });
    await db.delete(schema.users).where(eq(schema.users.id, me));
    expect(await db.select().from(schema.quarterlyReviews)).toEqual([]);
  });
});

describe("the yearly Compass (the review of Q4)", () => {
  const OLD = { workview: "Công việc là để học.", lifeview: "Cuộc sống là gia đình." };
  const NEW = { workview: "Công việc là để giúp người khác lớn lên.", lifeview: "Cuộc sống là chậm lại và có mặt." };
  beforeEach(async () => {
    await saveCompass(db, me, OLD);
  });

  it("a rewrite replaces the Compass and keeps the old one, then the review goes on to the dashboard", async () => {
    expect(await reviewCompass(db, me, Q, T0, NEW)).toEqual({ ok: true });
    expect(await getCompass(db, me)).toEqual(NEW);
    const [v] = await listCompassVersions(db, me);
    expect(v).toMatchObject({ ...OLD, replacedAt: T0 });
    expect(v.writtenAt < T0).toBe(true);
    const [r] = await listQuarterReviews(db, me);
    expect(r).toMatchObject({ quarter: Q, compassReviewedAt: T0, dashboardAt: null, dashboard: { health: null } });

    await saveDashboard(db, me, Q, { health: 6, work: 6, play: 6, love: 6 }, T1);
    expect((await listQuarterReviews(db, me))[0]).toMatchObject({ compassReviewedAt: T0, dashboardAt: T1 });
  });

  it("“Still true” keeps the Compass and archives nothing", async () => {
    expect(await reviewCompass(db, me, Q, T0, null)).toEqual({ ok: true });
    expect(await getCompass(db, me)).toEqual(OLD);
    expect(await listCompassVersions(db, me)).toEqual([]);
    expect((await listQuarterReviews(db, me))[0].compassReviewedAt).toBe(T0);
  });

  it("only once per review: a second rewrite (a double tap) archives nothing more", async () => {
    await reviewCompass(db, me, Q, T0, NEW);
    await reviewCompass(db, me, Q, T1, { workview: "khác", lifeview: "khác" });
    expect(await getCompass(db, me)).toEqual(NEW);
    expect(await listCompassVersions(db, me)).toHaveLength(1);
  });

  it("only in the review of Q4, and never with a blank half", async () => {
    expect(await reviewCompass(db, me, "2026-Q3", T0, NEW)).toEqual({ ok: false, error: "not_now" });
    expect(await reviewCompass(db, me, Q, T0, { workview: "  ", lifeview: "x" })).toEqual({ ok: false, error: "empty" });
    expect(await getCompass(db, me)).toEqual(OLD);
  });

  it("each user's own; they go with the user", async () => {
    await reviewCompass(db, me, Q, T0, NEW);
    expect(await listCompassVersions(db, other)).toEqual([]);
    await db.delete(schema.users).where(eq(schema.users.id, me));
    expect(await db.select().from(schema.compassVersions)).toEqual([]);
  });
});
