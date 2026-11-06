# REMINDME — project status and what's next

*Written 6 Nov 2026. A note to come back to; the live state is in [`harness/progress.md`](harness/progress.md) and [`harness/feature_list.json`](harness/feature_list.json).*

## What it is

A to-do app that remembers why. Every task serves a quarterly **Objective**, keeps life running (**Maintenance**), or tests a different future (**Prototype**), based on *Designing Your Life* and *How to Live a Meaningful Life*. The daily rhythm is about two minutes in the morning (your Compass words, Top 3, an if-then Intention) and one minute in the evening (Energy, Engagement, what felt meaningful), with weekly, quarterly and yearly look-backs on top. Vietnamese by default, for one person (you), installable as a phone app.

**How it's built:** Next.js 16 on Vercel, Neon Postgres, Clerk sign-in, QStash and Web Push for reminders, a free OpenRouter model for weekly notes. About 11k lines of app code, 6 database migrations, 53 commits since 4 Nov. Rules live in a pure, test-first core (`src/domain`); every database query is scoped to the signed-in user. Each feature shipped as a thin slice: test, build, deploy, end-to-end test on production.

## What is done

| Area | Status |
|---|---|
| **v1** (Slices 1–8): sign-in, tasks and capture, morning ritual, evening check-in, first-run setup, Life page, Quarter Close, Settings and Export | Done, proven on production |
| **Slice 9**: phone app and daily reminder | Built; reminder delivery proven on production. **Waiting on your iPhone check** |
| **Slice 10**: speed and accessibility budgets | Met on production: interactive in ~1.2 s on a mid-range phone, accessibility clean in every sky state |
| **Phase 2 · 1** Focus timer | Done, proven on production |
| **Phase 2 · 2** Weekly Review with AI | Done; a real free model answered on production; the AI never sees private notes |
| **Phase 2 · 3** Quarterly Review | Done, proven on production |
| **Phase 2 · 4** Rewrite your Compass | Live; can only be seen for real from **1 January 2027** |

**Quality:** 260 unit and integration tests passing; 12 end-to-end test files run signed in against a real database, locally and on production; each feature's evidence is recorded in `harness/feature_list.json`. The README explains the app with screenshots.

## To do — checklist

- [ ] **iPhone check** (closes Slices 9 and 10): Safari → https://daily-happy-life.vercel.app → Share → Add to Home Screen → open it, sign in → Settings → turn reminders on, set the time a few minutes ahead → the reminder should arrive at that minute.
- [ ] **January 2027** (closes Slice 14): open Today on production; the Quarterly Review looking back on Q4 should start with "A new year. Is your Compass still true?"
- [ ] **Use it daily** and see what real use says (see 1 below).
- [ ] Decide when to do the small cleanup slice (items 3–4 below).
- [ ] After a few weeks of use, decide on Phase 2 · 5 (opening the app to others).
- [ ] Optional: enable passkeys in the Clerk dashboard.

## What to improve, and why

1. **Use it daily — the biggest open item.** Success in the spec is checking in ≥5 days a week for 3 months and making at least one real decision because of the app, not usage alone. The app was built in three days, so none of that is tested yet. Most improvements should wait for what daily use shows.

2. **Close the open checks** (iPhone reminder, January Compass step). The iPhone reminder is the one thing automation can't prove, and it is the app's only nudge.

3. **Make the tests reliable.**
   - `e2e/focus.spec.ts` "time is up" fails after ~21:30 Vietnam time: it seeds sessions at fixed times yesterday while the server loads only the last 36 hours. Fix: seed relative to the real now.
   - The night-mode accessibility test and one unit test each failed once, then passed.
   - Why: a test that sometimes fails teaches you to ignore failures, and these tests are what prove each feature on production.

4. **Run end-to-end tests on a separate copy of the database.** Today they create and wipe a test account in the production database. Safe now (cleanup touches only the test user's rows), but one bad cleanup command could reach real data. A separate Neon branch for tests removes the risk.

5. **Watch speed.** Tapping the Top 3 star responds in ~80–104 ms against a 100 ms budget after Phase 2. It's tapped many times a day, so it's the first thing to feel slow if more is added.

6. **Make the store easier to change.** `src/data/store.tsx` is one ~700-line file with all state and actions; each Phase 2 feature made it bigger. Splitting it by area (tasks, ritual, reviews) makes later changes cheaper and safer.

7. **Before opening the app to others (Phase 2 · 5)** — none of these matter while it's only for you; all of them matter for strangers:
   - Clerk runs in development mode (shows a "Development mode" strip); switching it off needs a domain you own.
   - The product name is still open (SPEC §11, O1).
   - Reminders reach only the last device that turned them on.
   - Offline is read-only; nothing typed offline syncs later.

8. **The free AI model can be busy.** One model was rate-limited during testing and the next in line answered. The review still works without the AI (numbers only); if notes go missing often, a small paid model is the fix.

**Suggested order:** daily use and the iPhone check now → a small cleanup slice for 3–4 → decide on Phase 2 · 5 after a few weeks of real use.
