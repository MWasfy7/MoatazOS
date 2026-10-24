# MoatazOS architecture (as built)

Verified against `origin/main` at `632fd46` and the open branches on
2026-10-18. This describes the code that exists, not a target design.
Target-state ideas belong in `BACKLOG.md` as proposed tasks.

## 1. System shape

One Next.js 14 App Router application (`moatazos-app-studio`), fully
client-side in practice: every route renders from deterministic, in-repo
synthetic data. There is no API layer, database, authentication, network
access, persistence, or deployment from `main`.

```
App Studio shell (src/app/app-studio, src/components/app-studio)
 └─ SalesOS module                                  on main
     ├─ Real Input        CSV / WhatsApp text → NormalizedSalesEvent[]
     ├─ Decision Engine   events → evidence signals → DecisionSequence
     ├─ Decision Card     fixture DecisionSnapshot → bounded review UI
     ├─ Lead Loss Report  decision sequences → semantic metrics
     ├─ Pilot Evidence    frozen synthetic aggregate review
     └─ Operator Runtime  queue + learning loop     PR #8 (not on main)
 └─ ECHO module                                     branches only
     └─ Natural Runtime   text/transcript → EchoResult (proposal-only)
```

## 2. SalesOS on `main`

| Layer | Path | Responsibility |
|---|---|---|
| Domain model | `src/lib/types.ts` | Four decision states (`NO_ACTION`, `NEXT_STEP_READY`, `INSUFFICIENT_EVIDENCE`, `CONTRADICTORY_EVIDENCE`), evidence, signals, history, provenance, manager intervention, pilot evidence, and `checkSnapshotIntegrity` (fail-closed). No action fields by design. |
| Fixtures | `src/lib/fixtures/` | Deterministic synthetic opportunities for every decision state, including intentionally malformed and Arabic-authored cases. |
| Real Input | `src/lib/realInput/` | `parseCrmCsv`, `parseWhatsappExport` → `ImportResult` (events + typed `ImportIssue`s); explicit fixed timezone offsets; `stableHash` identities; `maskPii` + `createImportPreview` for display. Memory-only. |
| Decision Engine | `src/lib/decisionEngine/` | `extractEvidence` (lexicon, `EXTRACTOR_VERSION` `salesos-evidence-v0.1.0`) → `buildDecisionSequence` (`POLICY_VERSION` `salesos-policy-v0.1.0`). Re-evaluates at material boundaries (buyer request, pause, re-engagement, procurement, contradiction) and appends snapshots, never edits them. Records chasing findings. Output deep-frozen. |
| Lead Loss Report | `src/lib/leadLossReport/` | `buildLeadLossReport`: first-response, restraint, and freshness metrics with explicit exclusions. |
| i18n | `src/lib/i18n/` | `en.ts`, `ar.ts`, `LocaleProvider`; Arabic is RTL. |
| UI | `src/components/salesos/` | `OpportunityList`, `DecisionCard/` (state panels, actionless `InspectionRail`, `SnapshotComparison`), `RealInputWorkspace`, `DecisionEngineReview`, `LeadLossReportView`, `PilotEvidenceReview`. |

Routes on `main` (`next build`): `/` → `/app-studio` → `/app-studio/salesos`
(Command Center), `/salesos/opportunity/[opportunityId]`,
`/salesos/import`, `/salesos/decision-engine`, `/salesos/lead-loss-report`,
`/salesos/pilot-evidence`.

### Data flow

```
CSV / WhatsApp text ──parse──▶ NormalizedSalesEvent[] (+ ImportIssue[])
                                   │
                                   ▼
                     extractEvidence ──▶ EvidenceSignal[] (bounded pointers)
                                   │
                                   ▼
                     buildDecisionSequence ──▶ DecisionSequence
                       { extraction, snapshots[] (append-only), current }
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
       DecisionEngineReview UI              buildLeadLossReport
```

The Command Center's Decision Cards use the hand-authored fixture
snapshots in `src/lib/fixtures`; they are not yet produced by the
Decision Engine. Unifying the two is a backlog item (MOS-02).

## 3. SalesOS Operator Runtime (PR #8, not on `main`)

`src/lib/operatorRuntime/` adds an in-memory operator loop on top of the
engine: Command Queue sections (`ACT_NOW`, `COMMITMENTS_DUE`, `REVIEW`,
`WAIT_PROTECTED`, `AT_RISK_NEGLECT`), an `EvidenceContract` per item,
operator Quick Capture, append-only disagreement records, an operator
profile and performance ledgers, versioned doctrine, experiment
candidates, seven-day trial signals, and allowlisted JSON/Markdown export.
Routes: `/salesos/operator-runtime` and (PR #8 only) `/salesos/mobile`
(Arabic mobile follow-up). It is memory-only, with no network, no
persistence, and no doctrine auto-mutation.

Two diverged lines exist:

- `feat/salesos-operator-runtime` (PR #8): runtime, PR #10 evidence-timing
  fix, the Arabic mobile screen, and `vercel.json`.
- `codex/salesos-build4-gate-repair` (no PR): the same base plus
  `d7c80ca`, which adds a required `asOf` import clock, rejects
  future-dated events (`FUTURE_EVENT_TIMESTAMP`, 5-minute tolerance),
  normalizes `meta_due_at`, and adds bilingual queue explanations.

They merge without textual conflicts, but the result **does not
typecheck**: `MobileFollowUp.tsx` calls `parseWhatsappExport` without
`asOf`. That is backlog task SOS-01.

## 4. ECHO

Two separate lineages exist. They share no code beyond the SalesOS base.

### 4a. In-app ECHO: `MWasfy7/MoatazOS`, branches only

- `echo/build-0-natural-runtime` (`b7a3a2f`, no PR to `main`):
  `src/lib/echo/` deterministic pipeline: `intentResolver` →
  `contextResolver` → `confidenceRouter` → `actionRouter` (proposal-only,
  `externalSideEffect: false`) → `conversationPolicy` → `EchoResult`.
  English, Arabic, Franco-Arabic, and mixed input; text and voice-transcript
  parity; minimal `/echo` route. No tools, providers, network, or storage.
- `wave2/w2-01-echo-semantic-safety` (PR #12, draft, base = build-0):
  negative/cancellation instructions handled before action routing,
  unbound send/delete clarified, focus kept across greetings, unique
  turn/proposal IDs per session.
- PR #11 (`jules-…`, base `main`): NLF-50 evaluation harness. Its unit
  test runs `git fetch`/`git archive`/`npx esbuild` at test time to load
  ECHO code that is not on `main`. See BACKLOG ECH-03.

### 4b. Desktop ECHO: `MWasfy7/ECHO` (private)

A fork of MoatazOS `main@632fd46` with Builds 1–11 on
`echo/build-11-opportunity-discovery` (default branch) and a linear stack
of 12 unreviewed fix commits ending at
`fix/echo-cognitive-brain-v1-shadow-hardening` (no PRs). It is a
**Windows desktop agent**: SQLite (`node:sqlite`) durable memory,
PowerShell-based perception and app control, Codex/Claude provider
orchestration via CLI, an Obsidian vault writer, Windows startup
registration (`bin/echo.cjs`), and a localhost-only execution bridge.
It has real local side effects and must never be run, only statically
tested, by unattended cloud sessions.

Which lineage is canonical for the product is an open owner decision
(BACKLOG OD-3).

## 4c. Donna (DON-01, branch `claude/donna-client-outcome-recovery-v4vwzb`)

`src/lib/donna/` derives one outcome question per planned call from the call,
an append-only event log and an explicit clock (`buildInbox`, `applyEvent`;
`DONNA_LOGIC_VERSION`). Snooze, dismissal and "task done" never resolve a
question; an outcome (`SPOKE`, `NO_ANSWER`, `DID_NOT_CALL`, `CANCELLED`) does.
An internal follow-up date and a client-confirmed appointment are separate
types. UI: `src/components/donna/`, route `/app-studio/donna`, and an app-open
banner in the App Studio layout. Synthetic and memory-only; persistence, voice,
sync and closed-app notifications are not built. Independent of the ECHO runtime.

## 5. Boundaries and integration contracts

| Boundary | Contract | Enforced by |
|---|---|---|
| Input → engine | `NormalizedSalesEvent` (`src/lib/realInput/types.ts`) | Typecheck; `tests/RealInput.test.ts` |
| Engine → UI/report | `DecisionSequence`, `DeterministicDecisionSnapshot` | `tests/DecisionEngine*.test.*` |
| Fixture snapshot → UI | `DecisionSnapshot` + `checkSnapshotIntegrity` | `tests/Integrity.test.ts` |
| Engine → Operator Runtime | `OperatorOpportunity`, `EvidenceContract` (PR #8) | `tests/OperatorRuntime.test.ts` |
| ECHO → anything | `EchoResult.proposedActions[*].externalSideEffect: false` | `tests/EchoRuntime.test.ts` (branch) |
| App → outside world | none permitted | `tests/SafetyBoundary.test.ts` |

Not yet built anywhere: authentication, multi-tenant data separation,
persistence, real integrations (CRM, WhatsApp, calendar), and any
SalesOS↔ECHO runtime connection. Each needs an approved design task
before code.

## 6. Test and delivery infrastructure

- Vitest (jsdom) — `tests/*.test.ts(x)`; main: 17 files / 152 tests.
- Playwright — `tests/e2e/`; projects `desktop-chromium` and
  `mobile-arabic` (iPhone 13 → WebKit in CI; Chromium emulation when
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is set). main: 46 tests.
- GitHub Actions `.github/workflows/m0-salesos-validation.yml`, job
  `validate`: `npm ci` → typecheck → lint → build → unit → Playwright
  (with WebKit) → evidence artifact upload. Runs on every PR and on
  pushes to `main`.
- Cloud sessions: `.claude/hooks/session-start.sh`.
- Known dependency debt: `npm audit` reports 28 advisories (3 critical:
  `next` <15 line, `vitest` 2.1.2, `tinypool`). See ENG-01/ENG-02.
