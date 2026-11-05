# Session Handoff

## Current Objective

- feat-015 Slice 14 — Rewrite your Compass: built, unit + visual checked, committed locally, **not pushed**.

## To finish

1. Owner OK → `bun run db:migrate` (migration 0005: new `compass_versions`, two columns on `quarterly_reviews`, backfill `dashboard_at`).
2. `bun run build && bunx playwright test e2e/quarterly-review.spec.ts e2e/quarter-close.spec.ts` (regression: the dashboard step is now marked by `dashboard_at`).
3. Push, then the same specs with `E2E_BASE_URL=https://daily-happy-life.vercel.app`.
4. In January 2027: open Today on production and check the Compass step live; then mark feat-015 done if not already.

Don't push before step 1: `loadLive` reads `compass_versions`.

## Still open

- feat-010/011: owner's iPhone reminder check.
- `e2e/focus.spec.ts` "time is up" fails after ~21:30 ICT (test seeds fixed times yesterday vs the server's 36 h window).
