# Session Progress Log

Append a new dated entry at the top of **Log** each session. Keep **Current State** accurate.

## Current State

**Last Updated:** 2026-11-04
**Active Feature:** feat-001 — Phase 0 gate (owner design review)
**Branch:** main

### What's Done

- [x] Phase 0 steps 1–6 (feat-000) — prototype on mock data, domain core under Vitest
- [x] Agent harness added: `AGENTS.md` workflow, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`

### What's In Progress

- [ ] feat-001: owner reviews `review/vi/*.png` and `review/en/*.png` (generate with `bun dev` + `bun run review`)
  - Blockers: waiting on owner verdict (approve or redirect)

### What's Next

1. Apply any redirects from the owner's review, re-shoot, get approval → mark feat-001 done
2. Start feat-002 (Slice 1 — Foundation)

## Blockers / Risks

- [ ] Owner approval of Phase 0 is a human gate — agents must not start Slice 1 before it.

## Evidence of Completion

- [x] `./init.sh` — 2026-11-04: typecheck clean, lint clean, Vitest 6 files / 44 tests passed, `next build` OK

## Log

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
