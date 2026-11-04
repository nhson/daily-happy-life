# daily-happy-life — Spec v1

> Working name. Final name is **open** (see §11). Renaming = one config value + page titles.

- **Status:** Agreed in design interview, 2026-11-03. Not yet built.
- **Owner:** Hoang Son (sole user for v1).
- **Background research:** [`docs/research/meaningful-life-app.md`](research/meaningful-life-app.md)

---

## 1. What it is

A **purpose-aware task manager** that keeps your life objective in front of you every day. Every task traces back to a life direction, so you can see — daily and weekly — whether your days match the life you're designing.

Grounded in two books by Bill Burnett & Dave Evans:

| Book | What we take from it |
|---|---|
| *Designing Your Life* (2016) | **Compass** (Workview + Lifeview), **Odyssey Plans** (3 alternative 5-year lives + 4 gauges), **Good Time Journal** (energy/engagement), **Health/Work/Play/Love Dashboard**, prototyping |
| *How to Live a Meaningful Life* (2026) | Four **sources of meaning** (Wonder, Coherence, Flow, Community) and the **five mindsets**, used for daily reflection and the rotating Compass line |

The book exercises are the **setup** (first-run). The daily product is the **task manager + daily ritual**.

## 2. Users & scope

- v1 is **for one person** (the owner), built so it **can extend to others** later: real auth, `userId` on every row from day one.
- **Replaces** the owner's personal/life to-do app. Work tickets stay in work tools. No imports or integrations in the MVP.
- **English UI**, all copy in one strings file so Vietnamese can be added later.

## 3. Success criteria (3 months after launch)

1. At least **one real decision** (job, project, habit) was made *because of* the app — recorded in the Decision log.
2. Daily check-in on **≥ 5 days/week**, sustained.

Usage alone is not success.

## 4. Design principles

- **Don't nag.** At most **one** notification per day, at a time the user picks. Its content is a Compass line, never "you have 3 tasks."
- **Ask little each day.** Morning ≈ 2 min, evening ≈ 60 s.
- **Resurface, don't archive.** Book exercises are shown back to you instead of being filed away once and forgotten.
- **Rotate to avoid staleness.** The daily Compass line rotates among several sources.
- **Light onboarding.** Usable on day 1. The full Odyssey exercise unlocks over the first week.
- **Every task has a "why."** Every task is linked to an objective, marked Maintenance, or a Prototype.

*Evidence (see research doc): median 30-day retention for well-being apps is ~3%; push notifications have a small, fading effect; implementation intentions (if-then plans) have strong support; habits take ~66 days and a missed day doesn't break them.*

## 5. Core model: purpose hierarchy

```
Compass (yearly)
  └─ Active Odyssey Plan (1 of 3; switchable at quarterly review)
       └─ Objectives (3–5 per quarter)
            └─ Tasks (daily)

Other 2 Odyssey Plans ──> Prototype tasks (cheap experiments: a conversation, a trial weekend)
Maintenance ──> Tasks with no life objective (taxes, groceries)
```

**Rule:** a task's `kind` is exactly one of `objective | maintenance | prototype`.
- `objective` → requires `objectiveId`
- `prototype` → requires `prototypePlanId` (must be a non-active plan)
- `maintenance` → neither

## 6. Daily ritual

**Morning (~2 min)** on the Today screen:
1. See today's **Compass line** (rotates: Workview → Lifeview → active plan's 6-word title → one of the 5 mindsets).
2. Pick **Top 3** tasks.
3. Write one **if-then intention** ("When I ___, I will ___").

**Evening (~60 s)** — Today switches to check-in mode after a configurable hour:
1. Tick done tasks.
2. Rate **energy** (1–5) and **engagement** (1–5) (from the Good Time Journal).
3. Tap which **sources of meaning** today touched: Wonder / Coherence / Flow / Community.
4. Optional one-line note.

**Reminder:** one web push per day at the user's chosen local time, containing the day's Compass line.

**Logical Day:** a day ends at the user's "day ends at" hour (default 04:00 local), not midnight. Compass line, Top 3, Daily Log and the reminder cron all use the logical date.

**Top 3 carry-over:** Top 3 resets every Logical Day. The morning ritual offers yesterday's unfinished Top 3 as one-tap "carry over" chips.

**Quarter Close:** on first open in a new quarter, each still-active Objective gets Done / Drop / Carry forward (carry forward = copy into the new quarter). This is the whole quarterly review until Phase 2.

**Promoting a plan:** when the Active Plan changes, open Prototype tasks of the newly active plan must be converted (into Objective tasks under a new Objective) or closed. Closed prototypes stay as history.

**Life Share:** count of completed tasks over the last 7 Logical Days, split Objective / Maintenance / Prototype. Shown as one thin three-colour bar on Today in evening mode.

## 7. MVP — navigation & screens

Phone-first PWA; desktop is a wider layout of the same screens. **Three tabs + capture:**

| Tab | Contents |
|---|---|
| **Today** | Compass line, Top 3, if-then intention, remaining tasks. Switches to evening check-in mode in the evening. |
| **Tasks** | List, filter by objective / Maintenance / Prototype. |
| **Life** | One scrolling page with sections: **Compass** (Workview, Lifeview, 5 mindsets as reference) · **Odyssey** (3 plans: 6-word title, questions, 4 gauges 0–10, one active) · **Objectives** (3–5 this quarter, done/total) · **Decisions** (date, decision, what drove it, optional plan). |

- **Settings** behind the avatar: reminder time, timezone, evening-mode hour, day-ends-at hour, push opt-in, **Export all (JSON)**.
- **Capture:** floating ＋ on phone, ⌘K on desktop. Title + kind chips (active Objectives…, Maintenance, Prototype →); the last-used kind is preselected so the common case is type + Enter. No "unsorted" kind.

**First run (progressive):**
- Day 1: short Compass (one sentence each for Workview and Lifeview) → one Objective → first tasks. Usable immediately.
- Days 2–7: Today nudges you to fill Odyssey Plans 1, 2, 3 one at a time (one every couple of days). Until a plan is active, objectives sit under an implicit "Current path" plan (slot 1).

## 8. Data model

```
users         (id, clerkId, timezone, reminderTime, eveningHour, dayEndHour default 4,
               theme sky|light|dark, pushSubscription jsonb, reminderScheduleId?,
               onboardedAt?, createdAt)
compass       (userId PK, workview, lifeview, updatedAt)
odyssey_plans (id, userId, slot 1..3, title, questions, resources 0-10, likability 0-10,
               confidence 0-10, coherence 0-10, isActive, createdAt, updatedAt)
objectives    (id, userId, planId, title, quarter 'YYYY-Qn', status active|done|dropped)
tasks         (id, userId, kind objective|maintenance|prototype, objectiveId?, prototypePlanId?,
               title, dueDate?, top3Date?, doneAt?, closedAt?, createdAt)
               -- in Top 3 ⇔ top3Date = today's logical date
daily_logs    (userId, date, intention, energy 1-5, engagement 1-5,
               meaningSources text[], note, morningAt?, closedAt?; PK(userId, date))
               -- morningAt: ritual done/skipped (runs once per Logical Day)
               -- closedAt: "Close the day" committed (counts toward the 5-of-7 dots)
decisions     (id, userId, date, decision, drivenBy, linkedPlanId?)
```

Constraints:
- At most one `isActive` plan per user. Unique `(userId, slot)`.
- Task kind/link rule from §5: the DB check constraint enforces the kind ↔ link-column shape; "prototype plan must be non-active" (which needs other rows) is enforced in the domain layer and applies to open tasks only.
- Every query is scoped by `userId`.

Phase-2 weekly review and AI read `tasks` + `daily_logs` without schema changes.

## 9. Tech stack

- **App:** Next.js (App Router) + TypeScript, installable **PWA** (phone + desktop)
- **UI:** Tailwind CSS + shadcn/ui
- **DB:** Neon Postgres (via Vercel Marketplace) + Drizzle ORM
- **Auth:** Clerk (via Vercel Marketplace)
- **Push:** Web Push (`web-push`, VAPID keys) triggered by a **per-user Upstash QStash schedule** in the user's timezone (see [ADR 0001](adr/0001-per-user-qstash-schedules-for-reminders.md); Vercel Hobby crons are daily-only). iOS requires the PWA to be added to the Home Screen (iOS 16.4+).
- **Framework details:** Next 16 (`proxy.ts`, Server Actions + `useOptimistic`, React Compiler), Tailwind 4 tokens as CSS variables, shadcn/ui restyled, Motion for gestures/springs, View Transitions between tabs.
- **Auth:** Clerk in restricted mode (owner only) until opening to others; passkey + Google.
- **Hosting:** Vercel

## 10. Build plan

**No deadline — quality sets the pace.** The detailed plan lives in [`docs/PLAN.md`](PLAN.md): Phase 0 design prototype, then vertical slices ordered so Today + Tasks are usable first. Push ships as its own slice.

**Toolchain:** Bun, Vitest, git + private GitHub repo connected to Vercel previews.

**Testing (TDD on core logic only):**
- Compass-line rotation (deterministic per user/date)
- Reminder schedule expression for a timezone + time
- Task kind/link validation
- Objective-vs-Maintenance share calculation

- Logical-date calculation (day-ends-at hour, timezones)

UI is checked by hand, plus one Playwright smoke test of the full ritual (morning → evening) at phone viewport.

**Phase 2 (weeks 2–6)**
1. Focus timer (attached to a task)
2. **Weekly review with AI (Claude):** objective vs Maintenance %, energy/engagement patterns, sources of meaning, prototype progress. Weekly only, never daily chat.
3. **Quarterly review:** Health/Work/Play/Love dashboard, re-rate Odyssey gauges, keep or switch active plan, reset objectives.
4. Yearly: "Rewrite your Compass" prompt.
5. Decide whether to open the app to others (onboarding polish, per-user naming of their instance).
6. Habits / calendar view only if real use shows a need.

## 11. Open questions

| # | Question | Notes |
|---|---|---|
| O1 | **Product name** | Wants something inspired and personal. Shortlist so far: Basecamp, Núi, Ascent, Bearing, Cohere, Hành Trình, La Bàn; option to let each future user name their own instance. Decide before public sharing. Check domain/App Store availability. |

## 12. Out of scope (v1)

Native apps · integrations/imports (Todoist, Calendar) · daily AI chat · social/sharing · habits · calendar view · Vietnamese UI · multi-user onboarding.
