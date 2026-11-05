import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { patchLog } from "./days";
import * as schema from "./db/schema";
import { completeOnboarding } from "./onboarding";
import { ensurePlans } from "./plans";
import { createTask, setDone } from "./tasks";
import { ensureUser, type Db } from "./users";
import { listReviews, saveTakeaway, startReview, type Reviewer } from "./weekly-review";

let db: Db;
let me: string;
let other: string;
let asked: { system: string; user: string }[];
let answer: () => Promise<{ text: string; model: string }>;

const reviewer: Reviewer = {
  review: async (p) => {
    asked.push(p);
    return answer();
  },
};
const notes = { observations: ["Tuần nghiêng về mục tiêu.", "Năng lượng giữa tuần thấp."], question: "Điều gì giúp thứ Ba nhẹ hơn?" };
const SUN = "2026-11-08";
const MON = new Date("2026-11-09T02:00:00Z"); // 09:00 Monday in Ho Chi Minh City

beforeEach(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
  me = (await ensureUser(db, "user_me", "Asia/Ho_Chi_Minh")).id;
  other = (await ensureUser(db, "user_other", "Asia/Ho_Chi_Minh")).id;
  await ensurePlans(db, me);
  const first = crypto.randomUUID();
  await completeOnboarding(db, me, {
    compass: { workview: "LA BÀN RIÊNG", lifeview: "Cuộc sống dành cho người mình thương." },
    objective: { id: crypto.randomUUID(), title: "Ra mắt bản beta" },
    tasks: [{ id: first, title: "VIỆC RIÊNG", today: true }],
    today: "2026-11-02",
    quarter: "2026-Q4",
  });
  await setDone(db, me, first, "2026-11-03T03:00:00.000Z");
  const chore = crypto.randomUUID();
  await createTask(db, me, { id: chore, title: "Đi chợ", choice: { kind: "maintenance" } });
  await setDone(db, me, chore, "2026-11-10T03:00:00.000Z"); // the week after
  await patchLog(db, me, "2026-11-03", { energy: 2, engagement: 4, meaningSources: ["flow"], note: "NHẬT KÝ RIÊNG", closedAt: "2026-11-03T15:00:00.000Z" });
  asked = [];
  answer = async () => ({ text: JSON.stringify(notes), model: "google/gemma-4-31b-it:free" });
});

describe("starting a Weekly Review", () => {
  it("computes the week from the database, asks once, and keeps the answer", async () => {
    const r = await startReview(db, me, SUN, MON, reviewer);
    expect(r.ok && r.review.stats.done).toEqual({ objective: 1, maintenance: 0, prototype: 0, total: 1 });
    expect(r.ok && r.review.stats.days[1]).toMatchObject({ date: "2026-11-03", energy: 2, engagement: 4, closed: true });
    expect(r.ok && r.review.notes).toEqual(notes);
    expect(r.ok && r.review.model).toBe("google/gemma-4-31b-it:free");
    expect(await listReviews(db, me)).toHaveLength(1);

    // Opening it again doesn't ask again.
    await startReview(db, me, SUN, MON, reviewer);
    expect(asked).toHaveLength(1);
  });

  it("never sends notes, Intentions, the Compass or task titles", async () => {
    await startReview(db, me, SUN, MON, reviewer);
    const sent = JSON.stringify(asked);
    for (const secret of ["NHẬT KÝ RIÊNG", "LA BÀN RIÊNG", "VIỆC RIÊNG"]) expect(sent).not.toContain(secret);
    expect(sent).toContain("Ra mắt bản beta");
  });

  it("keeps the numbers when the AI fails, and asks again next time (up to 5 tries)", async () => {
    answer = async () => {
      throw new Error("429");
    };
    const r = await startReview(db, me, SUN, MON, reviewer);
    expect(r.ok && r.review.notes).toBeNull();
    expect(r.ok && r.review.stats.done.total).toBe(1);

    answer = async () => ({ text: "Không phải JSON", model: "m" });
    expect((await startReview(db, me, SUN, MON, reviewer)).ok).toBe(true);
    answer = async () => ({ text: JSON.stringify(notes), model: "m" });
    const third = await startReview(db, me, SUN, MON, reviewer);
    expect(third.ok && third.review.notes).toEqual(notes);
    expect(asked).toHaveLength(3);
  });

  it("stops asking after 5 failed tries for one week", async () => {
    answer = async () => {
      throw new Error("down");
    };
    for (let i = 0; i < 7; i++) await startReview(db, me, SUN, MON, reviewer);
    expect(asked).toHaveLength(5);
  });

  it("works without an AI at all: numbers only", async () => {
    const r = await startReview(db, me, SUN, MON, null);
    expect(r.ok && r.review.notes).toBeNull();
  });

  it("only for a Sunday that has passed, at most two weeks back", async () => {
    expect(await startReview(db, me, "2026-11-07", MON, reviewer)).toEqual({ ok: false, error: "bad_week" });
    expect(await startReview(db, me, "2026-11-15", MON, reviewer)).toEqual({ ok: false, error: "bad_week" });
    expect(await startReview(db, me, "2026-10-18", MON, reviewer)).toEqual({ ok: false, error: "bad_week" });
    expect(await startReview(db, me, "2026-11-01", MON, reviewer)).toMatchObject({ ok: true });
  });
});

describe("the takeaway", () => {
  it("is the user's one line, kept short, on their own review only", async () => {
    await startReview(db, me, SUN, MON, reviewer);
    expect(await saveTakeaway(db, me, SUN, "  Giữ thứ Ba nhẹ.  ")).toEqual({ ok: true });
    expect((await listReviews(db, me))[0].takeaway).toBe("Giữ thứ Ba nhẹ.");
    expect(await saveTakeaway(db, other, SUN, "x")).toEqual({ ok: false, error: "not_found" });
    await saveTakeaway(db, me, SUN, "y".repeat(500));
    expect((await listReviews(db, me))[0].takeaway).toHaveLength(280);
  });

  it("reviews go when the user goes", async () => {
    await startReview(db, me, SUN, MON, reviewer);
    await db.delete(schema.users).where(eq(schema.users.id, me));
    expect(await db.select().from(schema.weeklyReviews)).toHaveLength(0);
  });
});
