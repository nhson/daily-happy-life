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
    mock-store.ts           Phase 0 in-memory fixtures (deleted after Slice 3)
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
- **One store, two sources.** `mock-store.tsx` takes the server's `LiveData` when signed in; changes apply on screen first, then a Server Action (`src/data/actions.ts`) saves them; a refusal reloads the server's version with a quiet toast. Signed out (design review) it is all sample data, as before.
- **Client-made ids** (UUIDs): the optimistic row and the saved row are the same; a retried create is a no-op.
- **Plan switch is one pure function** (`src/domain/plan-switch.ts`) used by both the browser and the server; the server writes it in one transaction (Neon HTTP `batch`).
- **Smoothness on phones** (owner, 2026-11-05: loading and tab changes felt rough): task rows use `.glass-lite` (same look, no backdrop blur; many blurred layers cost frames on a mid-range Android); tab changes use a 220 ms compositor-only fade/lift instead of a full-page view transition; while loading, a placeholder frame (tab bar, capture, quiet rows) shows instead of an empty sky. `node scripts/perf-nav.mjs` measures frame timing at 4× CPU slowdown.
- **Task sheet**: tap a task's words to edit title, why and due date; "Let it go" closes it (history); "Delete — added by mistake" needs a second tap. Due today or overdue shows in a "Due" section on Today, never in the Top 3 by itself.

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

## Testing

- Vitest, test-first, for everything in `src/domain/`.
- One Playwright smoke test: morning ritual → complete a task → evening check-in, phone viewport.
- UI otherwise checked by hand against the Phase 0 screenshots.
