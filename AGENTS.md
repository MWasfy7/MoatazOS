# AGENTS.md — MoatazOS engineering instructions

These instructions bind every coding agent working in this repository
(Claude Code, Codex, Jules, Copilot, or anything else) and every human
contributor. `CLAUDE.md` imports this file; keep the rules here, not there.

The owner is a real-estate sales professional with little time for
software. Work must be safe to leave unattended: small, validated,
reviewable, and honest about what was and was not verified.

## What this repository is

MoatazOS is a Next.js 14 (App Router) + React 18 + TypeScript application
("App Studio") that hosts product modules. Today only **SalesOS** is on
`main`: an evidence-first, execution-free sales decision-review product
for Egypt/GCC real-estate sales floors, fully bilingual (English and
Arabic/RTL), running on deterministic synthetic fixtures.

**ECHO** (the conversational counterpart) exists only on branches. See
`docs/engineering/ARCHITECTURE.md` for the real module map and
`docs/engineering/BACKLOG.md` for the current state of every branch and PR.

There is no backend, no database, no authentication, no network call and
no deployment from `main`.

## Commands

Run from the repository root. Node 20+ (CI uses 20; cloud sessions use 22).

| Purpose | Command |
|---|---|
| Install (never `npm install` unless changing dependencies) | `npm ci` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit/component tests (includes the safety boundary test) | `npm test` |
| Production build | `npm run build` |
| Browser tests (desktop Chromium + mobile Arabic) | `npm run test:e2e` |

The full local gate, in order, is:

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e
```

Cloud sessions: the SessionStart hook (`.claude/hooks/session-start.sh`)
installs dependencies and sets `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the
preinstalled Chromium headless shell. When that variable is set, **both**
Playwright projects run on Chromium; the `mobile-arabic` project then keeps
the iPhone 13 viewport, touch and `ar-EG` locale but is **not** WebKit
evidence. Native WebKit runs only in GitHub Actions. Say so in every report.

## Protected invariants (never weaken without written owner approval)

These are product guarantees, enforced by tests. Changing a test that
guards one of them is a change to the guarantee itself.

1. **No execution authority.** No Send, Call, Schedule, CRM-write, pricing,
   billing, discount, override, or auto-contact control or code path. A
   recommendation names a bounded *class* of next step; it never performs it.
2. **NO_ACTION is a protected restraint state**, not an empty state. Buyer
   pauses and "do not contact" signals must produce restraint, and restraint
   must stay visually and logically primary.
3. **Evidence integrity is fail-closed.** `checkSnapshotIntegrity`
   (`src/lib/types.ts`) renders only the integrity-blocked state on any
   mismatch. Decisions cite attributable evidence; never infer or fabricate it.
4. **History is append-only and decision-time evidence is immutable.**
   Later outcomes or snapshots never rewrite an earlier decision; recorded
   chasing violations stay visible; sequences are deep-frozen.
5. **Versioned logic.** Any change to decision behavior in
   `src/lib/decisionEngine/` bumps `EXTRACTOR_VERSION` and/or
   `POLICY_VERSION` so provenance distinguishes old from new decisions.
6. **Future evidence is excluded.** Events later than the import/evaluation
   clock never influence a decision.
7. **Synthetic data only.** No real customer names, phone numbers, emails,
   WhatsApp exports, or CRM rows in the repository, fixtures, tests,
   screenshots, logs, or PR text. This repository is **public**. Imported
   data in the UI is masked (`maskPii`) and memory-only.
8. **No side-effect capability in `src/`.** No network, browser
   persistence, process spawning, server actions, route handlers,
   middleware, or outbound-contact links. Runtime dependencies are limited
   to `next`, `react`, `react-dom`. Enforced by `tests/SafetyBoundary.test.ts`.
9. **ECHO is proposal-only.** Every ECHO action proposal carries
   `externalSideEffect: false`; send/delete/contact requests are clarified
   or declined, never executed; negative and cancellation instructions are
   honored before any action routing.
10. **Bilingual parity.** User-visible copy lives in `src/lib/i18n/en.ts`
    and `src/lib/i18n/ar.ts` together; Arabic renders RTL.

## Hard rules for every agent

- **Never push to `main`.** Never force-push, never rewrite published
  history, never delete branches, never enable auto-merge, never bypass or
  change branch protection.
- **Merge only under the agent merge policy** in
  `docs/engineering/RELEASE_GATES.md`: either owner-directed in a live
  session, or a low-risk docs, records, additive-test, or dev-dependency-patch
  PR that a *different* session verified. Never merge anything touching
  `src/`, CI, agent instructions, authentication, security permissions,
  sensitive data, external execution, deployment, customer communication,
  payments, or a protected invariant.
- **Never modify another agent's or person's branch.** To change work on
  an existing branch, create your own branch from it and open a PR that
  targets it (or targets `main` and says what it supersedes).
- **One backlog task per branch and PR.** Use the task ID from
  `docs/engineering/BACKLOG.md` in the branch name and PR title.
- **Open PRs as drafts.** A PR leaves draft only when it is about to be
  merged under the merge policy, or when the owner moves it.
- **No external side effects**: no deployments, no messages, emails,
  WhatsApp, CRM or calendar writes, no publishing, no new third-party
  services, no secrets in the repository.
- **No new runtime dependency, no major-version upgrade, no new deployment
  config (e.g. `vercel.json`), and no CI permission increase** without an
  approved backlog task that names it.
- **Do not skip, disable, `.only`, or loosen tests** to get green.
  A failing test is a finding: fix the cause or report it.
- **Report honestly.** Distinguish commands you ran (with exit codes and
  counts) from commands you could not run and why. Green CI is not release
  readiness; see `docs/engineering/RELEASE_GATES.md`.
- **Stop when uncertain.** If a task is ambiguous, conflicts with an
  invariant, or needs an owner decision, record it as blocked; don't guess.

## Code conventions

- TypeScript strict with `noUncheckedIndexedAccess`; import via `@/`.
- Domain logic is pure, deterministic, and frozen (`deepFreeze`) in
  `src/lib/<module>/`; components in `src/components/<module>/`; routes
  in `src/app/app-studio/<module>/`.
- Closed string-literal unions for states and reason codes, not free text.
- Fixtures are deterministic; no `Date.now()`/`Math.random()` in logic
  that feeds a decision — pass clocks in explicitly.
- Tests: Vitest + Testing Library in `tests/*.test.ts(x)`, Playwright in
  `tests/e2e/`. New behavior ships with tests in both languages where UI
  copy is involved, and with a negative/restraint case where decisions are
  involved.
- Match surrounding style; keep diffs minimal and on-task.

## Where things are

- `docs/engineering/ARCHITECTURE.md` — real module map and boundaries
- `docs/engineering/BACKLOG.md` — executable task list and PR disposition
- `docs/engineering/RELEASE_GATES.md` — what "done" and "mergeable" mean
- `docs/engineering/AUTONOMOUS_DEVELOPMENT.md` — unattended-run protocol
- `docs/engineering/runs/` — one record per autonomous run
- `docs/salesos-diagnostic/` — data privacy and import requirements
