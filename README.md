# daily-happy-life

**A to-do app that remembers why.** Every task you write down traces back to the life you are designing: a quarterly Objective, the small stuff that keeps life running, or a cheap experiment toward a different future. Each day you can see whether your days match the life you said you wanted.

It is built on two books by Bill Burnett and Dave Evans: *Designing Your Life* (the Compass, three Odyssey Plans, the Good Time Journal, the Health/Work/Play/Love dashboard) and *How to Live a Meaningful Life* (four sources of meaning and five mindsets).

> Working name. Vietnamese by default, English in Settings. For one person for now (sign-in is invite-only), built so it can open to others later.

## How a day feels

- **Morning, about 2 minutes.** One line from your own Compass greets you. Pick today's **Top 3**, then write one if-then **Intention** ("When I sit down after lunch, I will write for twenty minutes").
- **During the day.** Capture a task in a second (`⌘K` on desktop, the `+` button on a phone) and say why it matters: an Objective, Maintenance, or a Prototype. Start a **Focus Session** on any Top 3 task with one tap.
- **Evening, about 60 seconds.** Tick what got done, rate Energy and Engagement from 1 to 5, and tap what made the day meaningful (Wonder, Coherence, Flow, Community). A thin bar shows the week's **Life Share**: how much went to what matters versus what merely had to be done.

## And over longer stretches

- **Weekly Review** (Sunday evening and Monday): the week's numbers, a few short notes and one question from an AI that sees only numbers and titles, never your private notes, and one line you keep.
- **Quarterly Review** (start of each quarter): rate Health, Work, Play and Love; re-rate your three Odyssey Plans; keep or switch the plan you are living; close last quarter's Objectives as Done, Dropped or Carried Forward.
- **Once a year:** rewrite your Compass from a blank page, with last year's words beside you. The old one is kept.
- **The Life page** brings the book exercises back instead of filing them away: your Compass, the three plans with their gauges, this quarter's Objectives, a log of real Decisions, and past weeks and quarters.

## Principles

- **Don't nag.** At most one quiet reminder a day, at a time you pick, and it is a line from your Compass, never "you have 3 tasks".
- **Ask little.** About two minutes in the morning and one in the evening.
- **Every task has a why.**
- **Your data is yours.** Export everything as JSON from Settings.

## It works on your phone

Add it to the Home Screen (Safari → Share → Add to Home Screen) and it behaves like an app: it opens offline to the last copy of Today, and it can send the one daily reminder.

---

## For developers

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Bun · Drizzle ORM on Neon Postgres · Clerk (sign-in) · Upstash QStash + Web Push (reminders) · OpenRouter (Weekly Review notes) · Vitest + Playwright · deployed on Vercel.

### Run it

```bash
bun install
harness/init.sh        # install, typecheck, lint, unit tests, build: the full gate
bun run dev:review     # the app on sample data, no account needed → http://localhost:3210
```

`dev:review` is the easiest way to look around. Handy URL parameters: `?at=21:00` (time of day), `?lang=en`, `?fresh=1` (first run), `?reset=1` (fresh sample data).

The signed-in app (`bun run dev`) needs environment variables for Neon, Clerk and, optionally, QStash, VAPID keys and OpenRouter. With the Vercel project linked, `vercel env pull .env.local` fetches them.

### Commands

| Command | What it does |
|---|---|
| `harness/init.sh` | Full gate: install, typecheck, lint, tests, build |
| `bun run test` | Unit tests (Vitest; not `bun test`) |
| `bun run e2e` | End-to-end tests, signed in as a test user against a local production build |
| `bun run review` | Screenshots of every screen (needs `dev:review` running) |
| `bun run db:generate` / `db:migrate` | Create / apply a database migration |

### Where things live

```
src/domain/    the rules, pure TypeScript, test-first (Logical Day, Life Share, Quarter Close…)
src/data/      database schema, queries and Server Actions; every query takes the user's id
src/features/  screens: today, tasks, life, settings, weekly, focus, onboarding…
src/ui/        design system: sky, sheets, chips, dials
src/copy/      every word on screen, in vi.ts and en.ts
e2e/           Playwright specs, one per feature
drizzle/       SQL migrations
```

### Documents

- [`docs/SPEC.md`](docs/SPEC.md): what the product is and why
- [`docs/PLAN.md`](docs/PLAN.md): how it is built, slice by slice, and the decisions made along the way
- [`GLOSSARY.md`](GLOSSARY.md): the words the app uses, in English and Vietnamese
- [`docs/adr/`](docs/adr/): architecture decisions
- [`AGENTS.md`](AGENTS.md): the working rules for coding agents; [`harness/`](harness/) holds their shared notes between sessions (feature list with test evidence, progress log, handoff)
