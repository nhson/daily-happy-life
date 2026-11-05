<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# daily-happy-life — agent harness

Purpose-aware task manager (Next.js 16 App Router · React 19 · TS · Tailwind 4 · Bun · Vitest). v1 and Phase 2 slices are live on Vercel; work follows the slices in `docs/PLAN.md`.

## Startup Workflow

Before writing code:

1. **Read this file** completely
2. **Read project docs**: `docs/PLAN.md` (phases, slices, architecture, decisions), `docs/SPEC.md` (product), `GLOSSARY.md` (vocabulary — use these terms exactly), `docs/adr/`
3. **Run `harness/init.sh`** — install, typecheck, lint, test, build. If the baseline fails, fix that first before adding new scope.
4. **Read `harness/feature_list.json`** and **`harness/progress.md`** (and `harness/session-handoff.md` if present) to find the active feature
5. **Review recent commits** with `git log --oneline -5`

## Working Rules

- **One feature at a time**: work only on the `in-progress` feature in `harness/feature_list.json`; respect `dependencies`
- **Stay in scope**: don't modify files unrelated to the current feature; note other ideas in `harness/progress.md` instead
- **Human gates**: PLAN.md gates (e.g. Phase 0 owner review) need explicit owner approval — never mark them done yourself
- **Domain is pure and test-first**: `src/domain/` imports nothing from `data/` or `ui/`; write the Vitest test before the code
- **Every DB query takes `userId`** (Slice 1+)
- **All user-facing copy lives in `src/copy/vi.ts` (default) and `src/copy/en.ts`**, read with `useCopy()` — quiet, warm, second person ("bạn"), no "!"; Vietnamese terms per GLOSSARY.md
- **Next.js 16 differs from training data**: read `node_modules/next/dist/docs/` before using a Next API
- **Record decisions**: build-time decisions go in PLAN.md "Decisions made"; architectural ones get an ADR

## Required Artifacts

All in `harness/`, tracked in git (they are the shared memory between sessions and machines):

- `harness/feature_list.json` — feature state tracker (source of truth, mirrors PLAN.md slices)
- `harness/progress.md` — current state + dated session log
- `harness/init.sh` — standard startup and verification path
- `harness/session-handoff.md` — next-session pickup notes when work is mid-flight

## Definition of Done

A feature is done only when ALL of the following are true:

- [ ] The slice's "Done when" in `harness/feature_list.json` / PLAN.md is demonstrably met
- [ ] `harness/init.sh` passes (typecheck, lint, tests, build)
- [ ] Done-criterion proven end to end: `bun run e2e` (and against production after deploy), spec in `e2e/`
- [ ] UI changes checked visually (`bun run dev:review` + `bun run review` → `review/vi/*.png`; add `-- --lang=en` for English)
- [ ] Evidence (command and result) recorded in `harness/feature_list.json` `evidence`
- [ ] Repository remains restartable from `harness/init.sh`

## End of Session

Before ending a session:

1. Update `harness/progress.md` (Current State + new Log entry)
2. Update `harness/feature_list.json` status/evidence
3. Record unresolved risks or blockers; overwrite `harness/session-handoff.md` if work is mid-flight
4. Commit with a descriptive message once the work is in a safe state
5. Leave the repo clean so the next session can run `harness/init.sh` immediately

## Verification Commands

```bash
harness/init.sh        # full gate
bun run typecheck
bun run lint
bun run test           # Vitest — NOT `bun test` (that is Bun's own runner)
bun run build
bun run review         # Playwright screenshots; needs `bun run dev:review` running (signed-out review mode)
bun run e2e            # Playwright, signed in as the e2e test user against a local prod build (real Neon)
E2E_BASE_URL=https://daily-happy-life.vercel.app bun run e2e   # same, against production
bun run db:generate    # Drizzle migration from src/data/db/schema.ts
bun run db:migrate     # apply migrations to Neon (.env.local from `vercel env pull`)
```

## Escalation

- **Architecture decisions**: check `docs/PLAN.md` and `docs/adr/`, otherwise ask the owner
- **Unclear requirements**: check `docs/SPEC.md`, otherwise ask the owner
- **Repeated test failures**: record in `harness/progress.md`, flag for human review
