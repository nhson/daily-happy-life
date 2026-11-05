# Session Handoff

## Current Objective

- feat-014 Slice 13 — Quarterly Review: code, unit tests, Export and visual checks done; committed locally, **not pushed**.

## To finish

1. Owner approves applying migration `drizzle/0004_windy_slayback.sql` (new table `quarterly_reviews`, additive) → `bun run db:migrate`.
2. `bun run build && bunx playwright test e2e/quarterly-review.spec.ts e2e/quarter-close.spec.ts` (local prod build, real Neon).
3. Push (Vercel deploys), then `E2E_BASE_URL=https://daily-happy-life.vercel.app bunx playwright test e2e/quarterly-review.spec.ts e2e/quarter-close.spec.ts`.
4. Record evidence in feature_list.json, mark feat-014 done.

Don't push before step 1: `loadLive` reads `quarterly_reviews` on every page.

## Still open

- feat-010/011: owner's iPhone reminder check.
- Watch: INP of the Top-3 star tap (~80–104 ms, budget 100).
