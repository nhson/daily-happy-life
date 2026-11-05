# Session Progress Log

Append a new dated entry at the top of **Log** each session. Keep **Current State** accurate.

## Current State

**Last Updated:** 2026-11-05
**Active Feature:** feat-014 Slice 13 — Quarterly Review (built and unit-tested; waits on migration 0004 → E2E → push)
**Branch:** main

### What's Done

- [x] Phase 0 steps 1–6 (feat-000) — prototype on mock data, domain core under Vitest
- [x] Agent harness added: `AGENTS.md` workflow, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`

### What's In Progress

- [x] feat-001: owner approved the Phase 0 design on 2026-11-04
- [x] feat-002: Slice 1 — Foundation — done 2026-11-05 (owner signed in on production; users row in Neon)
- [x] feat-003: Slice 2 — Tasks + Capture live (owner accepted 2026-11-05)
- [x] feat-004: Slice 3 — Morning ritual live (E2E 4/4 local + production)
- [x] feat-005: Slice 4 — Evening check-in live (E2E 7/7 local + production)
- [x] feat-006: Slice 5 — First run (E2E local + production)
- [x] feat-007: Slice 6 — Life page live (E2E local + production)
- [x] feat-008: Slice 7 — Quarter Close (E2E local + production)
- [x] feat-009: Slice 8 — Settings + Export (E2E local + production)
- [~] feat-010 (pending owner confirm): Slice 9 — PWA + Reminder (built, proven on production except push; VAPID + QStash live, signed round trip proven; waits on owner's iPhone)
- [~] feat-011 (pending owner confirm): Slice 10 — Finish (perf + a11y budgets met on production; iOS install check with the owner)
- [x] feat-012: Slice 11 — Focus timer (Phase 2 · 1), proven on production
- [x] feat-013: Slice 12 — Weekly Review with AI (Phase 2 · 2), proven on production with a real free model
- [~] feat-014: Slice 13 — Quarterly Review (Phase 2 · 3): built, unit + visual checked; migration 0004 not yet on Neon

### What's Next

0. Owner OK → `bun run db:migrate` (adds `quarterly_reviews`), then E2E `e2e/quarterly-review.spec.ts` + `e2e/quarter-close.spec.ts` locally, push, re-run on production. **Don't push before the migration**: `loadLive` reads the new table.
1. Owner: on the iPhone Home-Screen app, turn on reminders and confirm one arrives (closes feat-010 and feat-011); a Focus Session's end push can be checked the same way
2. Owner: pick the next Phase 2 item (quarterly review, yearly Compass rewrite)
3. Owner (optional): enable passkeys in the Clerk dashboard

## Blockers / Risks

- [x] Owner approval of Phase 0 (granted 2026-11-04).

## Evidence of Completion

- [x] `./init.sh` — 2026-11-04: typecheck clean, lint clean, Vitest 6 files / 44 tests passed, `next build` OK

## Log

### 2026-11-05 — Slice 13: Quarterly Review (Phase 2 · 3)

- Owner picked the Quarterly Review, extending Quarter Close. One card on Today: Life Dashboard (Health/Work/Play/Love 0–10) → plans' Gauges (dials; "Re-rate" opens sliders) + keep/switch via the existing switch sheet (moved to `src/features/life/promotion-form.tsx`) → leftovers → Decision (not asked again after a switch) → add one?/closing line. Life lists finished quarters.
- `quarterly_reviews` (migration 0004), saved step by step so a reload resumes; re-rated Gauges travel with the plans step so the snapshot can't miss them. In Export.
- Found in the visual walk: once complete, the store has no quarter waiting, so the closing step vanished — the card now keeps its quarter until left.
- Blocked: applying migration 0004 to Neon was refused by the permission check; needs the owner's OK. Committed locally, not pushed.

### 2026-11-05 — Slice 12: Weekly Review with AI (Phase 2 · 2)

- Owner picked: free OpenRouter model (Gemma 4 31B → Nemotron 3 Ultra → openrouter/free), numbers + titles only, card Sunday evening–Monday, AI notes + own takeaway saved. Owner added OPENROUTER_API_KEY (Production, sensitive).
- Live on production: Gemma was rate-limited upstream (429), Nemotron answered in Vietnamese with the app's terms. The client tries models one by one and logs why one was skipped.
- `review/` is git-ignored (screenshots) — the UI folder is `src/features/weekly/`.
- INP regression from Slices 11–12 found by the perf spec and fixed (lazy focus layer); the Top-3 star tap stays close to the 100 ms budget — watch it.
- Flake: one `bun run test` run had 1 failure (not captured); the next two runs were 232/232. Likely a PGlite test timing out under load — capture it if it recurs.

### 2026-11-05 — Slice 11: Focus timer (Phase 2 · 1)

- Owner picked: one tap on a Top 3 row (last length) or 15/25/50 in the task sheet; sessions saved and shown in the evening; chime in-app + delayed QStash push at the end; ask done / another round / leave it.
- `focus_sessions` (migration 0002, applied to Neon), in Export. E2E focus spec 5/5 local + production; QStash delayed publish + cancel proven live.
- Risk: `a11y › AA at night` failed once in a full 36-test run, passed 4/4 alone — watch for a flake.
- Ideas for later (not built): show which device gets the end push; focus minutes per Objective in the future weekly review.

### 2026-11-05 — Slice 10: budgets measured and met

- Slices 9 and 10 marked **pending-confirmation**: all agent-verifiable checks pass on production; the owner's iPhone check (Home-Screen install + a reminder arriving at the chosen minute) is the one thing left. v1 (Slices 1–10) is otherwise complete.

- Perf on production (mid phone, 4G, CPU 4×): Today interactive 1.28 s cold / 1.15 s repeat; INP 72 ms worst. A11y: axe WCAG 2.2 AA clean in every sky state/theme and the ritual; 44px targets everywhere (mindset strip made focusable; `.hit` touch areas). Chromium installability clean on production. `bun run smoke` = the ritual spec.
- Slice 9: VAPID keys in Vercel env; QStash install waits on the owner accepting Upstash's Marketplace terms (https://vercel.com/hoang-son-ngs-projects/~/integrations/accept-terms/upstash?source=cli).
- QStash provisioned (EU region → client passes QSTASH_URL); `bun run check:qstash` proves schedule + signed delivery on production (200).
- E2E: `wipe()` helper so the first-run test starts from a brand-new account regardless of spec order.

### 2026-11-05 — Slice 8 proven on production; Slice 9 built, waiting on services

- Slice 8 production: e2e/settings.spec.ts 3/3 (signed-out check loosened: production's 404 page names the app).
- Slice 9: manifest + icons (`scripts/make-icons.mjs`), `public/sw.js` (offline pages, push, notification click), install prompt + push opt-in in Settings, `src/data/reminders.ts` (schedule sync, send, forget gone devices; tested with fakes), `src/data/push-services.ts` (QStash/web-push adapters, null until configured), `/api/remind` (public, signature-checked), offline capture draft. E2E e2e/pwa.spec.ts.
- Blocked: provisioning QStash and VAPID keys is the owner's call; done-criterion needs the owner's iPhone.

### 2026-11-05 — Slice 7 proven on production; Slice 8: Settings + Export

- Slice 7 production: e2e/quarter-close.spec.ts 1/1.
- Slice 8: server-side Export all (`/api/export`) covering every table; `importAll` restores it (round trip in Vitest on a fresh PGlite and in E2E on Neon); Settings input validated server-side. E2E e2e/settings.spec.ts (settings persist across reload + DB; export download → restore → identical export; signed out gets nothing).

### 2026-11-05 — Slice 6 proven on production; Slice 7: Quarter Close

- Slice 6 production: e2e/life.spec.ts 3/3.
- Slice 7: `leftovers` / `settleLeftover` (test-first, incl. the 1 January boundary), `carried` Objective status (migration 0001 applied to Neon before deploy — widens a check, no data change), server computes the quarter itself, non-blocking card on Today ending with a Decision and "add one?". Leftovers stay a "why" in capture until settled. E2E e2e/quarter-close.spec.ts (Q3 leftovers in Q4).

### 2026-11-05 — Slice 5 proven on production; Slice 6: Life page settles plan switches

- Slice 5 production: e2e/onboarding.spec.ts 3/3.
- Slice 6: one sheet for every plan switch (old Objectives Keep/Drop, new Prototypes fold/close, then a pre-filled Decision); Objective Done asks close/move for open tasks. Domain `switchPlan(…, Settle)` and `finishObjective` (test-first), server writes in one transaction; action input sanitised. E2E e2e/life.spec.ts (UI flow + server refusing unsettled Prototypes + finish/move). Review shots 08b/08c added.

### 2026-11-05 — Slice 4 done; Slice 5: onboarding follows you across devices

- Slice 4: "Close yesterday?" step (ratings, sources, note; no task ticking) offered once when the ritual opens by itself; `missedCheckIn` domain rule. E2E `e2e/evening.spec.ts` (00:40 check-in → previous Logical Day; close yesterday counts toward dots; skip is final). 7/7 local and on production.
- Slice 5: onboarding progress saved as events (`applyOnboarding` / `recordOnboarding`), applied server-side to the stored state with the server's own Logical Day — a stale device can't undo another. E2E `e2e/onboarding.spec.ts` checks each card from a second browser context.
- Found while testing: Playwright's `page.clock` (setFixedTime too) stops the animation timeline, so every exit transition hung under test. `at()` now shifts `Date` only. Not an app bug.

### 2026-11-05 — E2E harness; Slice 3 proven

- `bun run e2e`: Playwright signed in as a dedicated Clerk test user (alias of the owner's address; created via the Backend API with the allowlist widened only for that call), rows wiped each run. Local prod build or `E2E_BASE_URL` (production).
- e2e/day-one.spec.ts 4/4 locally and on production (twice). Browser date pinned with `clock.setFixedTime` (not `install`, which fakes animation frames and froze a transition once).

### 2026-11-05 — Slice 3: Morning ritual live, mock store gone

- Everything the signed-in app shows now comes from Neon: Compass, Daily Logs, Decisions, onboarding progress joined tasks/plans/objectives/settings.
- Carry-over reads the logged Top 3 (most recent Top 3 day within 7 days). Day 1 setup saves in one transaction.
- `mock-store.tsx` → `store.tsx`; sample data only for signed-out review. `instant = false` kept (client-only shell, device clock) — see PLAN.
- Owner's account has no onboarded_at yet, so the next visit opens the first run.

### 2026-11-05 — Slice 2: Tasks + Capture live

- Owner chose to pull Objectives (and so Odyssey Plans) forward so real tasks have a real why.
- Data layer `src/data/{tasks,plans,live,actions}.ts`, every query by userId; store live mode with optimistic changes + resync on refusal.
- Task sheet (edit title/why/due, let go, delete for mistakes), due labels, "Due" section on Today.
- Smoothness pass (owner feedback): blur-free task rows, light tab fade, loading placeholder; worst tab-switch frame 117 → 67 ms (dev, 4× CPU).
- Next: owner verifies on the phone; then Slice 3 (Morning ritual live, mock store deleted).

### 2026-11-05 — Slice 1 closed

- Owner signed in on production with Google; `users` row created (timezone Asia/Ho_Chi_Minh, locale vi). feat-002 done; feat-003 started.

### 2026-11-04 — Slice 1: Foundation

- GitHub (public, owner's choice) + Vercel project `daily-happy-life`; Neon and Clerk via the Vercel Marketplace.
- Drizzle schema per SPEC §8 with check constraints (kind/link shape, ranges, enums, one Active Plan); tested by running the real migration on PGlite (13 tests). Applied to Neon.
- `ensureUser` (test-first) creates the user row on first sign-in from the `(app)` layout; timezone guess from `x-vercel-ip-timezone`.
- `ritualMode` (test-first) reads hours in the user's timezone; the store uses it.
- `src/proxy.ts` protects everything but `/sign-in`; Clerk allowlist = owner's email; sign-in page in the sky, Vietnamese copy, no sign-up link. Verified on production: a stranger's sign-up is refused.
- Kept `instant = false` until the mock store goes (Slice 3); dev validation can't see past the client-only shell. Review now runs with `bun run dev:review`.
- Clerk runs its development instance in production (needs an owned domain for a production instance); one Neon DB for every environment for now. Both recorded in PLAN.

### 2026-11-04 — Phase 0 approved

- Owner approved the design after reviewing `review/vi` and `review/en`. feat-001 done; Slice 1 is next.

### 2026-11-04 — Review prep: a fully Vietnamese prototype

- Sample content follows the language: `fixtures(today, tz, locale)` holds the sample in vi and en (Compass, plans, objectives, tasks, notes, intention, decision); `?reset=1&lang=…` and Settings "reset" use it. Fixed the English sample intention reading "When I I sit down…".
- The check-in sheet's submit button is "Lưu và khép lại" in Vietnamese, so it no longer repeats the "Khép lại ngày" label used by the Today button and the sheet title (the Evening Check-in term).
- Review script types the intention in the review language; `review/vi` and `review/en` re-shot, no console errors.

### 2026-11-04 — Life page: more emotional and inspiring (owner request)

- Hero: "Who you are becoming" as the headline (word-by-word reveal), a reflective intro, and a "Living toward" pill with the Active Plan.
- Compass cards read as the user's manifesto: warm/rose wash, large quote mark, "— in your own words".
- Mindsets: "Five ways to meet a day", each with its own hue and icon, the line first; today's Compass Line mindset is marked "Today".
- Odyssey cards get a horizon wash per slot (dawn / sky / dusk); a closing line ends the page. Copy in en + vi.
- Unwritten Odyssey cards became invitations: slot hue and icon (footprints / signpost / dice), prompt, "No need to be right, only honest. About ten minutes.", a real button.
- Each Odyssey card opens with a drawn SVG scene in its hue (`src/features/life/plan-scene.tsx`): road into sunrise / fork with signpost / balloons under stars; gently animated, reduced-motion safe. Plan B is "Lối rẽ khác" in Vietnamese.
- Objectives: quarter strip (sun travelling along week N of 13, `quarterProgress` in domain, test-first), card grid with a glowing progress bar, finished objectives glow, a dashed "room for N more" tile. Decisions: glowing timeline of cards, "what drove it" as a quote, plan chip in its hue; empty state localized (was hard-coded English) with a CTA.
- Objectives capped at 3 active per quarter (was 5): `objectiveRoom` in `src/domain/objectives.ts` (test-first), enforced in the store; full quarter shows a quiet note. Plan switch respects it too: with three active, the sheet folds open Prototypes into a chosen existing Objective (moves under the new plan) — `checkFold`, test-first. Fixed squashed sheet buttons on phone (`flex-1` in a column).

### 2026-11-04 — Vietnamese localization (default language)

- Grilled and settled (Q1–Q7): Vietnamese default, English in Settings, `users.locale`; "bạn"; typed dictionaries + `useCopy()`; everything the user reads follows the language, user content and export field names don't.
- `src/copy/index.ts` (`useCopy`, `useLocale`, `useFormatDate`, `LOCALE_TAG`), `src/copy/vi.ts`; ~35 hard-coded strings moved into copy; Mindset lines now keys in the domain (`MINDSET_KEYS`), words in copy (test-first).
- Owner approved the term table (GLOSSARY.md "Vietnamese") and Noto Serif Display, narrowed; Instrument Serif and Newsreader removed.
- Review script reads button names from the dictionaries: `review/vi/` and `review/en/` (`--lang=en`), no console errors. Fixed from the Vietnamese shots: gauge label truncation, Active badge wrap, intention text under the edit pencil, English "When I / I will" on Today.
- Not done: fixture content (sample tasks, Compass) is still English — it's "user content"; push reminder text gets localized server-side in Slice 9.

### 2026-11-04 — Onboarding & tutorial prototype (feat-006 design, on mock data)

- Grilled and settled the design (SPEC §7 "First run", §8 `users.onboarding`).
- Built on mock data: "Which of these is for today?" setup step (day 1 = morning done), six one-time tips (`src/ui/tip.tsx`), one-card-at-a-time Today slot (`src/features/onboarding/today-card.tsx`), Odyssey nudges with `/life?plan=N`, reminder ask, Settings "Show tips again".
- Rules in `src/domain/onboarding.ts`, test-first (19 tests). Review: `?day=N`; review script shots 14–23.
- Also: UX pass on the prototype (wrapping task titles, multi-line strike, wrapping capture chips, pinned "Close the day", one-line date).

### 2026-11-04 — Spec/plan grilling

- Settled 17 edge-case decisions (plan switch, Quarter Close, Done vs Closed, missed check-in, carry-over lookback, Top 3 history, due dates, offline capture, term disambiguation).
- Updated GLOSSARY.md, SPEC §6–8 and §10, PLAN slices 1–4/6/7/9, feature_list.json descriptions.
- Renamed vitest.config.ts → vitest.config.mts to clear Vite's ESM config warning.

### 2026-11-04 — Harness setup

- Scaffolded harness with the `harness-creator` skill (walkinglabs/learn-harness-engineering).
- Fixed generated `init.sh`: `bun test` → `bun run test` (bare `bun test` runs Bun's runner, not Vitest).
- Seeded `feature_list.json` from `docs/PLAN.md` phases/slices.
