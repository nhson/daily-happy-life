# Implementation Plan

Companion to [`SPEC.md`](SPEC.md). Vocabulary: [`GLOSSARY.md`](../GLOSSARY.md). No deadline — quality sets the pace.

## Design direction (agreed)

| Topic | Decision |
|---|---|
| Device | Phone-first PWA; desktop = two columns (Today ∣ Tasks) + keyboard (`⌘K`, `/`, `j/k`, `x`, `t`, `⌘1–9`) |
| Aesthetic | **Living sky**: background gradient follows local time (pre-dawn → dawn → day → dusk → night); faint contour-line texture |
| Theme | Sky drives light/dark; override in Settings (Follow sky / Light / Dark) |
| Type | Noto Serif Display, narrowed (Compass line, headings; has Vietnamese glyphs) · Geist Sans (UI) · Geist Mono tabular (numbers, gauges) |
| Navigation | 3 tabs — **Today · Tasks · Life** — plus floating ＋ / `⌘K` capture; Settings behind avatar |
| Morning | Guided full-screen flow once per Logical Day: Compass line (word-by-word) → Top 3 (carry-over chips) → Intention (two inline blanks). Skippable. |
| Evening | One bottom sheet: tick tasks · Energy & Engagement as 5 stops · 4 meaning glyphs · note · **Close the day** → sky settles to night |
| Progress | 7 week-dots, "5 of 7" target. No streaks, no points, no confetti |
| Celebration | Strike-through draw + spring collapse; all Top 3 → sky brightens; day closed → sunset |
| Odyssey | 3 cards (carousel on phone), radial gauge dials, active glow; unwritten plans as dashed ghost cards with the book prompt |
| First run | 3 full-screen steps over a sky that brightens from pre-dawn to sunrise |
| Copy | Quiet, warm, second person, short. No "!", no guilt. All strings in `src/copy/vi.ts` (default) and `src/copy/en.ts`, read through `useCopy()` |
| A11y | AA contrast in every sky state (frosted surfaces where needed), 44px targets, focus rings, reduced-motion = static fades, SR labels |
| Perf budget | Today interactive < 1.5 s (mid phone, 4G) · INP < 100 ms · feedback within one frame · clean PWA install iOS/Android |

## Architecture

```
src/
  app/                      Next 16 App Router
    (app)/today|tasks|life|settings
    api/remind/route.ts     QStash → web push
  domain/                   pure TS, no I/O — the TDD core
    logical-day.ts          logical date from instant + tz + dayEndHour
    compass-line.ts         deterministic rotation per user/date
    task-rules.ts           kind/link validation, plan-promotion effects
    life-share.ts           7-day Objective/Maintenance/Prototype split
    sky.ts                  sky phase + colour stops from local time
    reminder-schedule.ts    QStash cron expression from tz + time
    types.ts
  data/
    store.ts                interface the UI calls (Server Actions in prod)
    store.tsx               the one client store: server data when signed in, sample data in design review
    actions.ts              Server Actions (each acts as the signed-in user only)
    db/schema.ts, queries   Drizzle (Slice 1+)
  ui/                       design system: tokens, Sky, Sheet, Chip, Dial, Glyphs…
  features/                 today/, tasks/, life/, capture/, onboarding/
  copy/en.ts
```

Rule: `domain/` imports nothing from `data/` or `ui/`. Every DB query takes `userId`.

## Phase 0 — Design prototype (inside the real project)

Goal: nail the feel before any backend exists. Mock data only; components are kept.

1. Scaffold: Next 16 + TS + Tailwind 4 + Bun, git init, Vitest, Playwright.
2. Domain core, test-first: `logical-day`, `compass-line`, `task-rules`, `life-share`, `sky`.
3. Design tokens + `<Sky>` (time-driven gradient + contours, `?at=HH:MM` override for review).
4. Primitives: tab bar, sheet, chips, rating stops, meaning glyphs, gauge dial, task row (swipe/strike).
5. Screens on mock data: morning flow, Today (day), evening sheet, night summary, Tasks + capture, Life (Compass, Odyssey, Objectives, Decisions), first run.
6. Copy deck in `copy/en.ts`.
7. **Gate:** Playwright screenshots of every screen × sky state at phone + desktop sizes, plus a morning-ritual recording. Owner approves or redirects.

**Status (2026-11-04):** steps 1–6 built; awaiting the owner's review at the gate. Run `bun dev`, then `bun run review` → `review/*.png`.

Decisions made while building Phase 0:
- **Contrast veil.** Dawn and dusk gradients span dark→bright, so no single ink passes AA everywhere. `skyAt` blends in the lightest haze that keeps every text level AA (tested every 15 min, all day).
- **Capture shortcuts are ⌘1–9**, not bare 1–9, so digits can still be typed in task titles.
- **Ink choice** = whichever ink has the best worst-case contrast across the whole gradient (not just the lower half).
- **Vietnamese is the default language** (owner, 2026-11-04). Typed dictionaries `src/copy/vi.ts` + `en.ts` (same `Copy` shape, missing key fails typecheck) read through `useCopy()`; no i18n library. Locale lives in settings (`users.locale`), not the URL. Mindset lines are keys in the domain, words in the copy. Dates via `Intl` (vi-VN / en-GB). Terms in GLOSSARY.md "Vietnamese".
- **Serif = Noto Serif Display, narrowed** (`wdth` 72, weight 380). Instrument Serif has no Vietnamese glyphs; Newsreader read too wide.
- **Plan title length is per language**: six words in English, 6–10 syllables in Vietnamese (`copy.life.titleRange`), since every Vietnamese word is one syllable.
- **At most 3 active Objectives a quarter** (owner, 2026-11-04; was 5). Rule in `src/domain/objectives.ts`; the store refuses a 4th and won't reactivate a Done/Dropped one while full. On a plan switch with three active, open Prototypes fold into an existing Objective, which moves under the new plan (`checkFold`).
- **Review in both languages**: `bun run review` → `review/vi/`, `bun run review -- --lang=en` → `review/en/`; `?lang=vi|en` switches the prototype.
- Phase 0 opts out of Next's instant-navigation validation (`instant = false`); it stays until the mock store goes (Slice 3): the app shell renders client-only, so Next can't validate the pages below it (tried in Slice 1: dev reports every page as a dropped segment).
- **Tasks tab = Open ∣ Done** segmented control. A search button beside the tabs opens the search bar on demand (`/` on desktop); the why-filter lives inside it as a menu, the active filter as a removable token. Closing search clears both. Done shows the last 7 Logical Days only, grouped by day, newest first.
- Review URLs: `?at=HH:MM` pins time of day, `?reset=1` reloads fixtures, `?fresh=1` starts the first run.

Onboarding & tutorial (settled 2026-11-04, SPEC §7 "First run"): built in the Phase 0 prototype on mock data first, wired to the backend in Slice 5. Review URL `?day=N` pretends it is Logical Day N since setup.

Edge-case rules settled 2026-11-04 (plan switch, Quarter Close, task endings, missed check-in, carry-over, Top 3 history, due dates, offline) live in SPEC §6–8 and are folded into the slices below.

Decisions made in Slice 1 (2026-11-04):
- **Repo** public at `github.com/nhson/daily-happy-life` (owner's choice); Vercel project `daily-happy-life` deploys `main` to production and every PR to a preview.
- **Clerk and Neon via the Vercel Marketplace** (free plans, env vars provisioned). Clerk runs its development instance on all environments: a production instance needs a domain we own, `*.vercel.app` won't do. Its sign-in card shows a "Development mode" strip until then.
- **Owner-only = Clerk allowlist** holding the owner's email; there is no sign-up page, and the card's sign-up link is hidden. (Clerk won't let this plan also check the allowlist at sign-in; with no other account able to exist, sign-up is the gate that matters.)
- **One Neon database for all environments** while it's one user. Previews write to the owner's data; split with Neon branches before anyone else signs in.
- **The database refuses bad shapes itself** (check constraints, partial unique index for one Active Plan); tests run the real migrations on PGlite.
- **User row on first sign-in** is created from the `(app)` layout (`ensureUser`, idempotent); first timezone guess is Vercel's `x-vercel-ip-timezone`, falling back to Asia/Ho_Chi_Minh.
- **Ritual mode reads the user's timezone** (`src/domain/ritual-mode.ts`), not the device clock.
- **Design review runs signed out**: `bun run dev:review` (`DHL_REVIEW=1`, honoured by `next dev` only) before `bun run review`.

Decisions made in Slice 2 (2026-11-05):
- **Objectives and Odyssey Plans went live with Tasks** (owner's choice): a real task can't point at a sample Objective. Every user gets three plan rows on first load (slot 1 = implicit Current Path); adding an Objective, Done/Drop, writing a plan and switching the Active Plan save for real. Compass, Decisions, Daily Logs and onboarding stay sample until their slices.
- **Settings on the user row are live too** (timezone, hours, theme, language, reminder time): the Logical Day the browser shows must match the one the server writes. "Sound" stays per device.
- **One store, two sources.** The store (`mock-store.tsx` then, `store.tsx` since Slice 3) takes the server's `LiveData` when signed in; changes apply on screen first, then a Server Action (`src/data/actions.ts`) saves them; a refusal reloads the server's version with a quiet toast. Signed out (design review) it is all sample data, as before.
- **Client-made ids** (UUIDs): the optimistic row and the saved row are the same; a retried create is a no-op.
- **Plan switch is one pure function** (`src/domain/plan-switch.ts`) used by both the browser and the server; the server writes it in one transaction (Neon HTTP `batch`).
- **Smoothness on phones** (owner, 2026-11-05: loading and tab changes felt rough): task rows use `.glass-lite` (same look, no backdrop blur; many blurred layers cost frames on a mid-range Android); tab changes use a 220 ms compositor-only fade/lift instead of a full-page view transition; while loading, a placeholder frame (tab bar, capture, quiet rows) shows instead of an empty sky. `node scripts/perf-nav.mjs` measures frame timing at 4× CPU slowdown.
- **Task sheet**: tap a task's words to edit title, why and due date; "Let it go" closes it (history); "Delete — added by mistake" needs a second tap. Due today or overdue shows in a "Due" section on Today, never in the Top 3 by itself.

Decisions made in Slice 3 (2026-11-05):
- **"Mock store deleted" = nothing the signed-in app shows is sample data any more.** Compass, Daily Logs (morning and evening fields), Decisions and onboarding progress went live with the morning ritual; the store file is now `src/data/store.tsx`. Sample data remains only for signed-out design review (`dev:review`), kept in localStorage there. Slices 4–6 keep their behaviour work (missed check-in, tips across devices, the promotion sheet settling old Objectives, Objective Done asking about open tasks); their data is already live.
- **Device preferences stay on the device**: sound and the last "why" used in capture.
- **The logged Top 3 follows every change** to a day's Top 3 (`snapshotTop3`, same transaction), so `daily_logs.top3TaskIds` holds the final Top 3 once the day is over. Carry-over (`src/domain/carry-over.ts`) reads it: the most recent day with a Top 3, up to 7 days back, still-open tasks in that day's order.
- **A fresh account goes through the real first run** (`users.onboarded_at` is null until Day 1 setup, which saves Compass, Objective, tasks, Top 3 and the morning in one transaction).
- **`instant = false` stays.** It was meant to go with the mock store, but the shell still renders client-only for a different reason: the sky, ritual mode and Logical Day follow the device clock. Rendering the shell on the server is its own piece of work (Slice 10, perf).

Decisions made in Slice 4 (2026-11-05):
- **"Close yesterday?" is offered only when the ritual opens by itself** (morning mode, first visit of the Logical Day), and only for yesterday: the account existed then and the day isn't closed. Skipping it or opening the ritual by hand never brings it back. Its answers (ratings, sources, note) close yesterday's Daily Log, so the day counts toward the week dots; no task ticking (`src/domain/missed-check-in.ts`).
- **Step transitions slide over each other** (`AnimatePresence mode="popLayout"`), and the leaving step is `inert` (`src/ui/step.tsx`), so only the present step can be acted on.
- **E2E keeps the browser clock within a day of the real one**: Clerk drops a session whose tokens look issued in the future/past by more. Each spec seeds its own account history in the past instead of moving the clock far. The clock is moved by shifting `Date` only (`e2e/support.ts` `at`): Playwright's `clock.setFixedTime`/`install` also stop the animation timeline, which hung every exit transition under test (not for real users).

Decisions made in Slice 5 (2026-11-05):
- **Onboarding progress is saved as events, not snapshots.** A device reports "tip seen", "tips reset", "reminder asked" or "not now on Plan N"; the server applies it to what it has stored (`applyOnboarding`, `recordOnboarding`) and works out today from the user's timezone. A stale phone can't bring back a tip dismissed on the laptop, two devices' "not now"s add up, and the server no longer stores whatever shape a client sends.
- **The first run itself was finished in Slice 3** (Day 1 setup in one transaction); Slice 5 proves the rest end to end: tips, the reminder ask after the first closed day, Odyssey nudges and "Show tips again", each checked from a second browser with no shared storage.

Decisions made in Slice 6 (2026-11-05):
- **Every plan switch goes through the sheet**, even without Prototypes: it settles the old plan's still-active Objectives (Keep preselected — it loses nothing) and ends with the pre-filled Decision, skippable. Old Objectives are settled first, so dropping one makes room for folding Prototypes into a new Objective (`switchPlan` with `Settle`).
- **Objective Done always settles its open tasks**: closed by default, or moved to another active Objective of the same quarter; finished tasks stay with the Objective they were done for. The server applies it even when only the status is sent (`finishObjective`).

Decisions made in Slice 7 (2026-11-05):
- **A Carried Forward Objective keeps its own status, `carried`** (migration 0001 widens the check), so last quarter's history shows what happened to it without counting it as Done or Dropped. The copy in the new quarter is a new Objective; only open tasks move to it.
- **Done at Quarter Close closes the Objective's open tasks**, like Drop and like Objective Done's default.
- **Leftovers stay usable**: until settled, last quarter's active Objectives count as active everywhere a "why" is chosen. The server works out the new quarter from the user's own Logical Day.
- **The card's ending is not saved**: once the last leftover is settled, the Decision question and "add one?" show in the same card; leaving the page skips them.

Decisions made in Slice 8 (2026-11-05):
- **Export all is built on the server** (`GET /api/export`, `src/data/export.ts`): the screen only holds recent Daily Logs, so a browser-side dump was not the whole account. Field names are the schema's; no user id, Clerk id or push subscription.
- **"Round-trips every table" is proven with `importAll`**, which restores an export into an account in one transaction. It is not in the UI (SPEC: no imports) — it is for recovery and for the tests (PGlite: fresh database; E2E: real Neon).
- **Settings ignore values that aren't real** (bad time, hour out of range, unknown zone/theme/language) instead of letting the database refuse the whole change. The day can end between 00:00 and 06:00.

Decisions made in Slice 9 (2026-11-05):
- **Reminders stay off until their services are configured**: QStash (`QSTASH_TOKEN`, signing keys) and VAPID keys are read from the environment; without them Settings says reminders aren't on yet and `/api/remind` answers 503. `/api/remind` is the one public API path; it accepts only QStash-signed calls.
- **One device receives the reminder** — the last one switched on in Settings (one subscription on the user row). A device the push service reports gone is forgotten along with the schedule.
- **Offline is read-only**: the service worker keeps the last good copy of each page (Today first); capture keeps typed words as a device draft and saves nothing until online. No background sync.
- **The service worker registers only in production builds**, so dev and design review never serve stale pages.

Decisions made in Slice 10 (2026-11-05):
- **The budgets are measured, not estimated**: `e2e/perf.spec.ts` runs against production on Lighthouse's mobile profile; "interactive" means a tap on capture actually opens the sheet. `e2e/a11y.spec.ts` runs axe (WCAG 2.2 AA) in every sky state and theme and checks 44px targets.
- **Small-looking controls keep their look** and get an invisible 44×44 touch area (`.hit` in globals.css) rather than being drawn bigger.
- **`instant = false` stays**: Today is interactive in ~1.2–1.3 s on the mid-phone profile, inside budget, so server-rendering the shell isn't needed now.

Decisions made in Slice 11 — Focus timer (2026-11-05, owner picked each):
- **Where**: one tap on a Top 3 row starts the last length used on this device; the task sheet offers 15 / 25 / 50 minutes. No Pomodoro cycles or breaks.
- **Saved**: `focus_sessions` (task, start, planned minutes, end), server clock; one running per user (starting another ends it); finishing or letting go of a task ends its session; deleting the task removes them. In Export (optional field, so older exports still import).
- **End signal**: a chime and a tap when the app is open. When it isn't, the server queues one delayed QStash message to `/api/remind` (`{userId, focusId}`) for users with push on; an early stop cancels it, and the endpoint re-checks the session before sending, so a stopped session never rings.
- **The answer**: Mark it done (task Done, session ends at its planned end) · Another round (same length) · Leave it (also what dismissing the sheet means). A finished session stops asking 12 hours after its end.

## Slices (each one demoable end-to-end: schema + action + UI + test)

| # | Slice | Done when |
|---|---|---|
| 1 | **Foundation**: Clerk (restricted, passkey + Google), Neon + Drizzle schema with check constraints, user row on first sign-in, Vercel deploy + GitHub previews. Evening-mode hour must use the user's timezone, not the device clock | Owner signs in on a deployed URL; others cannot sign up |
| 2 | **Tasks + Capture** live: create (kind required, last kind preselected), complete, edit, **close** (history) vs **delete** (mistakes only), due date via edit + due/overdue on Today, filters; optimistic | Phone capture is type + Enter; DB rejects a kind/link mismatch |
| 3 | **Morning ritual** live: Compass line, Top 3 + carry-over (last Top 3 day within 7 days), Intention → `daily_logs`; final Top 3 snapshot in `top3TaskIds` | Flow runs once per Logical Day; mock store deleted |
| 4 | **Evening check-in** live: sheet, close the day, Life Share bar, week dots; "Close yesterday?" step next morning (once, no task ticking) | Check-in at 00:40 lands on the previous day |
| 5 | **First run**: Compass → Objective → tasks → "for today" (Top 3) under the implicit Current Path; six in-context tips; Odyssey nudges days 2/4/6; reminder ask after first closed day; `users.onboarding` jsonb | Fresh account usable in < 3 min; tips and nudges follow you across devices |
| 6 | **Life page** live: Compass edit, Odyssey (gauges, set active + promotion sheet settling old Objectives and new Prototypes, ending with a pre-filled Decision), Objectives (max 3 active; Done asks close/move open tasks), Decisions | Promoting a plan with open Prototypes forces convert/close |
| 7 | **Quarter Close** card: non-blocking; carry forward moves open tasks, drop closes them; ends with Decision prompt + "add one?" if < 3 | Q4 leftovers on 1 Jan get Done / Drop / Carry forward, stay usable until settled |
| 8 | **Settings + Export**: times, timezone, day-ends-at, theme, JSON export | Export round-trips every table |
| 9 | **PWA + Reminder**: manifest, icons, SW cache of Today, install prompt, web push, QStash schedule per user; offline capture keeps draft (no sync) | Push arrives at the chosen minute on iPhone Home-Screen app |
| 10 | **Finish**: perf budget, a11y audit in all sky states, Playwright ritual smoke test, polish | Every budget in the table above is met |
| 11 | **Focus timer** (Phase 2 · 1): start from a Top 3 row (one tap, last length) or a task's sheet (15/25/50 min); bar above the tab bar; at the end chime + tap if open, a push if not (one delayed QStash message, cancelled on an early stop); "Mark it done / Another round / Leave it"; minutes focused shown in the Evening Check-in; `focus_sessions` table, in Export | A session survives a reload, only one runs, its end asks, and the evening shows today's minutes |

## Testing

- Vitest, test-first, for everything in `src/domain/`.
- One Playwright smoke test: morning ritual → complete a task → evening check-in, phone viewport.
- UI otherwise checked by hand against the Phase 0 screenshots.
