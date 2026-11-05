# Session Progress Log

Append a new dated entry at the top of **Log** each session. Keep **Current State** accurate.

## Current State

**Last Updated:** 2026-11-05
**Active Feature:** feat-004 — Slice 3 (Morning ritual live)
**Branch:** main

### What's Done

- [x] Phase 0 steps 1–6 (feat-000) — prototype on mock data, domain core under Vitest
- [x] Agent harness added: `AGENTS.md` workflow, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`

### What's In Progress

- [x] feat-001: owner approved the Phase 0 design on 2026-11-04
- [x] feat-002: Slice 1 — Foundation — done 2026-11-05 (owner signed in on production; users row in Neon)
- [x] feat-003: Slice 2 — Tasks + Capture live (owner accepted 2026-11-05)
- [ ] feat-004: Slice 3 — Morning ritual live — built and deployed; waiting on the owner's first run

### What's Next

1. feat-003 (Slice 2 — Tasks + Capture live)
2. Owner (optional): enable passkeys in the Clerk dashboard

## Blockers / Risks

- [x] Owner approval of Phase 0 (granted 2026-11-04).

## Evidence of Completion

- [x] `./init.sh` — 2026-11-04: typecheck clean, lint clean, Vitest 6 files / 44 tests passed, `next build` OK

## Log

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
