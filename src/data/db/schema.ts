import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { OnboardingState } from "@/domain/onboarding";
import type { PlanRating } from "@/domain/quarterly-review";
import type { ReviewNotes, WeekStats } from "@/domain/weekly-review";

/**
 * SPEC §8. The database enforces every rule that one row can check on its own
 * (shapes, ranges, enums, one Active Plan); rules that need other rows live in `src/domain/`.
 * Every table but `users` hangs off `user_id` and goes when the user goes.
 */

const at = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const between = (col: unknown, lo: number, hi: number) => sql`${col} is null or ${col} between ${sql.raw(String(lo))} and ${sql.raw(String(hi))}`;


export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull().unique(),
    timezone: text("timezone").notNull(),
    reminderTime: text("reminder_time").notNull().default("07:00"),
    eveningHour: smallint("evening_hour").notNull().default(19),
    dayEndHour: smallint("day_end_hour").notNull().default(4),
    theme: text("theme", { enum: ["sky", "light", "dark"] }).notNull().default("sky"),
    locale: text("locale", { enum: ["vi", "en"] }).notNull().default("vi"),
    pushSubscription: jsonb("push_subscription"),
    reminderScheduleId: text("reminder_schedule_id"),
    onboardedAt: at("onboarded_at"),
    onboarding: jsonb("onboarding").$type<OnboardingState>(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("users_theme", sql`${t.theme} in ('sky', 'light', 'dark')`),
    check("users_locale", sql`${t.locale} in ('vi', 'en')`),
    check("users_evening_hour", sql`${t.eveningHour} between 0 and 23`),
    check("users_day_end_hour", sql`${t.dayEndHour} between 0 and 23`),
    check("users_reminder_time", sql`${t.reminderTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

export const compass = pgTable("compass", {
  userId: owner().primaryKey(),
  workview: text("workview").notNull(),
  lifeview: text("lifeview").notNull(),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

export const odysseyPlans = pgTable(
  "odyssey_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    slot: smallint("slot").notNull(),
    title: text("title").notNull().default(""),
    questions: text("questions").notNull().default(""),
    resources: smallint("resources"),
    likability: smallint("likability"),
    confidence: smallint("confidence"),
    coherence: smallint("coherence"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("odyssey_plans_user_slot").on(t.userId, t.slot),
    uniqueIndex("odyssey_plans_one_active").on(t.userId).where(sql`${t.isActive}`),
    check("odyssey_plans_slot", sql`${t.slot} between 1 and 3`),
    check("odyssey_plans_resources", between(t.resources, 0, 10)),
    check("odyssey_plans_likability", between(t.likability, 0, 10)),
    check("odyssey_plans_confidence", between(t.confidence, 0, 10)),
    check("odyssey_plans_coherence", between(t.coherence, 0, 10)),
  ],
);

export const objectives = pgTable(
  "objectives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => odysseyPlans.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    quarter: text("quarter").notNull(),
    status: text("status", { enum: ["active", "done", "dropped", "carried"] }).notNull().default("active"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("objectives_user_quarter").on(t.userId, t.quarter),
    check("objectives_quarter", sql`${t.quarter} ~ '^[0-9]{4}-Q[1-4]$'`),
    check("objectives_status", sql`${t.status} in ('active', 'done', 'dropped', 'carried')`),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    kind: text("kind", { enum: ["objective", "maintenance", "prototype"] }).notNull(),
    objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "cascade" }),
    prototypePlanId: uuid("prototype_plan_id").references(() => odysseyPlans.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    top3Date: date("top3_date", { mode: "string" }),
    doneAt: at("done_at"),
    closedAt: at("closed_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tasks_user_open").on(t.userId).where(sql`${t.doneAt} is null and ${t.closedAt} is null`),
    // SPEC §5: every task has exactly one "why".
    check(
      "tasks_kind_link",
      sql`(${t.kind} = 'objective' and ${t.objectiveId} is not null and ${t.prototypePlanId} is null)
       or (${t.kind} = 'prototype' and ${t.prototypePlanId} is not null and ${t.objectiveId} is null)
       or (${t.kind} = 'maintenance' and ${t.objectiveId} is null and ${t.prototypePlanId} is null)`,
    ),
  ],
);

export const dailyLogs = pgTable(
  "daily_logs",
  {
    userId: owner(),
    date: date("date", { mode: "string" }).notNull(),
    intention: jsonb("intention").$type<{ when: string; then: string }>(),
    energy: smallint("energy"),
    engagement: smallint("engagement"),
    meaningSources: text("meaning_sources").array().notNull().default(sql`'{}'::text[]`),
    note: text("note").notNull().default(""),
    top3TaskIds: text("top3_task_ids").array().notNull().default(sql`'{}'::text[]`),
    morningAt: at("morning_at"),
    closedAt: at("closed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("daily_logs_energy", between(t.energy, 1, 5)),
    check("daily_logs_engagement", between(t.engagement, 1, 5)),
    check("daily_logs_meaning_sources", sql`${t.meaningSources} <@ array['wonder', 'coherence', 'flow', 'community']::text[]`),
    check("daily_logs_top3", sql`cardinality(${t.top3TaskIds}) <= 3`),
  ],
);

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
  decision: text("decision").notNull(),
  drivenBy: text("driven_by").notNull().default(""),
  linkedPlanId: uuid("linked_plan_id").references(() => odysseyPlans.id, { onDelete: "set null" }),
  createdAt: at("created_at").notNull().defaultNow(),
});

/** Focus Sessions (Phase 2): a timer on one task. `push_message_id`: the queued end-of-focus push, cancelled on an early stop. */
export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    startedAt: at("started_at").notNull(),
    plannedMinutes: smallint("planned_minutes").notNull(),
    endedAt: at("ended_at"),
    pushMessageId: text("push_message_id"),
  },
  (t) => [
    index("focus_sessions_user_started").on(t.userId, t.startedAt),
    check("focus_sessions_minutes", sql`${t.plannedMinutes} between 1 and 180`),
  ],
);

/** Weekly Reviews (Phase 2): the week's numbers, the AI's notes (null if it couldn't answer), the user's one line. */
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    userId: owner(),
    /** The Sunday that ends the week. */
    weekEnd: date("week_end", { mode: "string" }).notNull(),
    stats: jsonb("stats").$type<WeekStats>().notNull(),
    notes: jsonb("notes").$type<ReviewNotes>(),
    model: text("model"),
    attempts: smallint("attempts").notNull().default(0),
    takeaway: text("takeaway").notNull().default(""),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekEnd] }), check("weekly_reviews_takeaway", sql`char_length(${t.takeaway}) <= 280`)],
);

/**
 * Quarterly Reviews (Phase 2): one per quarter looked back on. Saved step by step: each `*_at` marks
 * a step passed (`compass_reviewed_at` only in the review of Q4), `completed_at` the end.
 */
export const quarterlyReviews = pgTable(
  "quarterly_reviews",
  {
    userId: owner(),
    quarter: text("quarter").notNull(),
    health: smallint("health"),
    work: smallint("work"),
    play: smallint("play"),
    love: smallint("love"),
    plans: jsonb("plans").$type<PlanRating[]>(),
    activePlanId: uuid("active_plan_id").references(() => odysseyPlans.id, { onDelete: "set null" }),
    /** Only when looking back on Q4: the Compass rewritten or kept. */
    compassReviewedAt: at("compass_reviewed_at"),
    dashboardAt: at("dashboard_at"),
    plansReviewedAt: at("plans_reviewed_at"),
    completedAt: at("completed_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.quarter] }),
    check("quarterly_reviews_quarter", sql`${t.quarter} ~ '^[0-9]{4}-Q[1-4]$'`),
    check("quarterly_reviews_health", between(t.health, 0, 10)),
    check("quarterly_reviews_work", between(t.work, 0, 10)),
    check("quarterly_reviews_play", between(t.play, 0, 10)),
    check("quarterly_reviews_love", between(t.love, 0, 10)),
  ],
);

/** Past Compasses (Phase 2): the pair a yearly rewrite replaced, with when it was written and replaced. */
export const compassVersions = pgTable(
  "compass_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    workview: text("workview").notNull(),
    lifeview: text("lifeview").notNull(),
    writtenAt: at("written_at").notNull(),
    replacedAt: at("replaced_at").notNull(),
  },
  (t) => [index("compass_versions_user").on(t.userId, t.replacedAt)],
);
