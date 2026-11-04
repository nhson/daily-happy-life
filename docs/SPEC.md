# daily-happy-life — Spec v1

> Working name. Final name is **open** (see §11). Renaming = one config value + page titles.

- **Status:** Agreed in design interview, 2026-11-03; edge cases settled 2026-11-04. Phase 0 prototype built — see [`PLAN.md`](PLAN.md).
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
       └─ Objectives (at most 5 active per quarter, ideally ≥ 3)
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

**Missed check-in:** if yesterday's check-in was never closed, the next Morning Ritual opens with an optional "Close yesterday?" step: energy, engagement, sources of meaning, note — no task ticking (tasks ticked now count as Done today). Allowed once, for the previous Logical Day only; it counts toward the week dots.

**Reminder:** one web push per day at the user's chosen local time, containing the day's Compass line.

**Logical Day:** a day ends at the user's "day ends at" hour (default 04:00 local), not midnight. Compass line, Top 3, Daily Log and the reminder cron all use the logical date.

**Top 3 carry-over:** Top 3 resets every Logical Day. The morning ritual offers the unfinished Top 3 of the most recent Logical Day that had one (looking back at most 7 days) as one-tap "carry over" chips. Each day's Top 3, as it stood when the day ended, is kept in that day's Daily Log.

**Due dates:** optional, set by editing a task (not in capture). Shown as a small label; tasks due today or overdue appear on Today. Never added to Top 3 automatically, never a notification.

**Quarter Close:** in a new quarter, a card at the top of Today (not blocking) asks each still-active Objective of the last quarter: Done / Drop / Carry forward. Carry forward copies the Objective into the new quarter and moves its open tasks to the copy; Drop closes its open tasks. Until the card is finished, last quarter's active Objectives stay usable. It ends with: an optional "Did you decide anything this quarter? Because of what?" → saves a Decision; and, if fewer than 3 Objectives are active, a gentle "Add one?". This is the whole quarterly review until Phase 2.

**Promoting a plan:** when the Active Plan changes, one sheet settles both sides:
- each still-active Objective of the old plan → **Drop** (its open tasks are closed) or **Keep** (moves under the new plan);
- open Prototype tasks of the newly active plan → converted (into Objective tasks under a new Objective) or closed.

The sheet ends with a pre-filled, skippable Decision ("Switched to ‹plan›", linked to the plan) asking what drove it.

**Ending tasks:** a task ends **Done** (counts toward Life Share) or **Closed** (let go; kept as history). Any open task can be Closed by the user. **Delete** exists only for mistakes (typo, duplicate) and leaves no trace.

**Finishing an Objective:** marking an Objective Done mid-quarter asks once about its open tasks: close them (default) or move them to another active Objective.

**Life Share:** count of completed tasks over the last 7 Logical Days, split Objective / Maintenance / Prototype. Shown as one thin three-colour bar on Today in evening mode.

## 7. MVP — navigation & screens

Phone-first PWA; desktop is a wider layout of the same screens. **Three tabs + capture:**

| Tab | Contents |
|---|---|
| **Today** | Compass line, Top 3, if-then intention, remaining tasks. Switches to evening check-in mode in the evening. |
| **Tasks** | List, filter by objective / Maintenance / Prototype. |
| **Life** | One scrolling page with sections: **Compass** (Workview, Lifeview, 5 mindsets as reference) · **Odyssey** (3 plans: 6-word title, questions, 4 gauges 0–10, one active) · **Objectives** (at most 5 active this quarter, done/total) · **Decisions** (date, decision, what drove it, optional plan). |

- **Settings** behind the avatar: reminder time, timezone, evening-mode hour, day-ends-at hour, push opt-in, **Export all (JSON)**.
- **Capture:** floating ＋ on phone, ⌘K on desktop. Title + kind chips (active Objectives…, Maintenance, Prototype →); the last-used kind is preselected so the common case is type + Enter. No "unsorted" kind.
- **Offline:** writes need a connection (no background sync in v1). Offline, capture keeps the draft and says so quietly; it saves when you're back.

**First run (progressive):** setup is the only thing up front; everything else is taught in context.
- **Day 1 setup (required, ~3 min):** short Compass (one sentence each for Workview and Lifeview) → one Objective → up to three first tasks → **"Which of these is for today?"** (all preselected; tap to deselect) → sunrise. The picks become today's Top 3 — chosen by the user, never automatic. Day 1 counts as Morning Ritual done, with no Intention; the real ritual starts on day 2. Lands on a calm Today.
- **Tips:** six one-time inline cards (one or two quiet sentences + "Got it"; no overlays, no arrows), each shown the first time you reach its moment:
  1. first Top 3 on Today — tap the circle or swipe right to finish; the star or a long-press sets Top 3;
  2. first capture — every task needs a why; the last one is preselected (desktop also: ⌘K, ⌘1–9);
  3. first Morning Ritual (day 2) — the Compass Line, why only three, why an if-then plan;
  4. first evening — what the check-in is for, ~60 s;
  5. first closed day — the week dots and Life Share; a missed day breaks nothing;
  6. first visit to Life — Compass, Odyssey, Objectives in two lines.
  At most one tip per screen visit. Settings has **Show tips again**.
- **Odyssey nudges:** a Today card asks you to write Plan 1 (Current Path) on Logical Day 2 since setup, Plan 2 on day 4, Plan 3 on day 6 — or the next visit after. **Write it** opens that plan on Life; **Not now** hides it for 2 days; after 3 "not now"s that plan's nudge stops for good (the dashed ghost card on Life remains). Until a plan is active, objectives sit under an implicit "Current path" plan (slot 1).
- **Reminder ask:** once, after the first closed day — "Want one quiet note each morning?", with Home-Screen install steps on iOS. Never in setup, never repeated (Settings still has it).
- **One card at a time:** Today shows at most one onboarding card, in priority tip → reminder ask → Odyssey nudge; the rest wait for a later visit.

## 8. Data model

```
users         (id, clerkId, timezone, reminderTime, eveningHour, dayEndHour default 4,
               theme sky|light|dark, pushSubscription jsonb, reminderScheduleId?,
               onboardedAt?, onboarding jsonb, createdAt)
               -- onboarding: { setupDate, seenTips[], reminderAskedAt?,
               --   nudges: { "<slot>": { snoozedUntil?, notNowCount } } } — UI progress only
compass       (userId PK, workview, lifeview, updatedAt)
odyssey_plans (id, userId, slot 1..3, title, questions, resources 0-10, likability 0-10,
               confidence 0-10, coherence 0-10, isActive, createdAt, updatedAt)
objectives    (id, userId, planId, title, quarter 'YYYY-Qn', status active|done|dropped)
tasks         (id, userId, kind objective|maintenance|prototype, objectiveId?, prototypePlanId?,
               title, dueDate?, top3Date?, doneAt?, closedAt?, createdAt)
               -- in Top 3 ⇔ top3Date = today's logical date
daily_logs    (userId, date, intention, energy 1-5, engagement 1-5,
               meaningSources text[], note, top3TaskIds text[], morningAt?, closedAt?;
               PK(userId, date))
               -- top3TaskIds: that day's final Top 3 (history; tasks.top3Date is only "today")
               -- morningAt: ritual done/skipped (runs once per Logical Day)
               -- closedAt: "Close the day" committed (counts toward the 5-of-7 dots)
decisions     (id, userId, date, decision, drivenBy, linkedPlanId?)
```

Constraints:
- At most one `isActive` plan per user. Unique `(userId, slot)`.
- At most 5 `active` Objectives per user per quarter (domain layer).
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

**Phase 2 (after v1 is in daily use)**
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
