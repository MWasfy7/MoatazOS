# MoatazOS engineering backlog

Single source of truth for what may be worked on. Autonomous runs may pick
**only** tasks with status `APPROVED` whose dependencies are `DONE`.
Existing unfinished work comes before new features.

Statuses: `APPROVED` (may be picked) · `PROPOSED` (owner must approve
first: change it to `APPROVED` in a commit or PR comment) · `BLOCKED`
(reason stated) · `IN_REVIEW` (PR open; link it) · `DONE` (merged; link it)
· `OWNER` (owner action; agents cannot do it).

Each task also has a **`Merge:`** field. `agent` means a later run may
merge it under the agent merge policy (`RELEASE_GATES.md`, Case 2) once
every condition holds. `owner` means only the owner, or an owner-directed
session, merges it. Agents never change a `Merge:` field.

Branch naming: `claude/auto-<task-id>-<short-slug>` (lowercase).
PR title: `<TASK-ID>: <summary>`. Last verified: 2026-10-18 against
`origin/main@632fd46`.

---

## 0. Current state (audit 2026-10-18)

### Merged to `main`
PR #15 (engineering foundation, merged 2026-10-18 as `2aafeef`, owner-directed).
PRs #1–#7: SalesOS M0 clickable product, M1A NO_ACTION restraint, M1B
manager intervention, M1C pilot evidence, S1 real input layer, S2
deterministic decision engine, S3 lead loss report.

### Open PR disposition

| PR | Branch → base | State | Evidence (this audit) | Disposition |
|---|---|---|---|---|
| #8 | `feat/salesos-operator-runtime` → `main` | open, CI green | typecheck/lint/build pass; 187/187 unit; 70/70 e2e (Chromium) | **Not mergeable yet.** Missing the Codex gate repair (SOS-01). Adds `vercel.json` (OD-4). Needs exact-head review (SOS-02). |
| — | `codex/salesos-build4-gate-repair` (no PR) | unreviewed | 191/191 unit; 58/58 e2e; build pass | Complete but orphaned. **Merging into #8 breaks typecheck/build and 2 e2e tests.** Folded into SOS-01. |
| #9 | `feat/salesos-operator-runtime-7143966066775475898` → `feat/salesos-operator-runtime` | open, no CI run | typecheck/lint/build pass; 180/180 unit (older runtime head) | Duplicate of an older operator-runtime head plus `AUDIT.md` (product critique). **Close without merging**; its audit findings are captured in SOS-10/SOS-11. |
| #10 | `fix/salesos-build4-validation-blockers` | merged into #8's branch | — | Done. |
| #11 | `jules-…7e516cba` → `main` | open, CI green | typecheck/lint/build pass; 152/152 unit (passes only because the ECHO commit is reachable locally) | **Rework (ECH-02).** Its unit test runs `git cat-file`/`git fetch`/`git archive`/`npx esbuild` against a SHA not on `main`, so `npm test` becomes network- and history-dependent. Adds `tsx` with a caret range. |
| #12 | `wave2/w2-01-echo-semantic-safety` → `echo/build-0-natural-runtime` | draft, CI green (incl. WebKit) | typecheck/lint/build pass; 196/196 unit; 50/50 e2e (Chromium) | Hold for independent exact-revision review (ECH-01). |
| #13 | `jules-…079d0f07` → `main` | open, CI green | typecheck/lint/build pass; 150/150 unit | Small test-only PR; **mergeable to `main` as-is** (owner). It conflicts with the Codex repair's new required `asOf`; SOS-01 resolves that. |
| #14 | `feat/salesos-prompt-evaluation-set-…` → `main` | open, CI green | typecheck/lint/build pass; 159/159 unit. Probe: `عايز شقة في الدور العالي` ("I want a high-floor apartment") → **HIGH-confidence `OBJECTION`**; `انا ساكن جنب تاون سنتر` → `PROPERTY_REQUIREMENT` | **Do not merge as-is.** It changes the extractor lexicon without bumping `EXTRACTOR_VERSION` (provenance break) and adds over-broad Arabic terms. Superseded by SOS-03. |

### Other branches
- `echo/build-0-natural-runtime`: ECHO Build 0, no PR to `main`. Gated on OD-3.
- `claude/echo-natural-speech-forensics-x80h5a`: self-described superseded sketch. Prune (OD-5).
- `claude/add-mcp-integrations-4uln82`: 11 commits behind; adds `.mcp.json`
  with unpinned `@latest` MCP servers run through `npx -y`, a supply-chain
  risk. Do not merge. Prune (OD-5).
- `feat/m0…`, `feat/m1a/b/c…`, `feat/salesos-real-input-v0`,
  `feat/salesos-decision-engine-v0`, `feat/salesos-lead-loss-report-v0`:
  fully merged. Prune (OD-5).

### Private `MWasfy7/ECHO`
Default branch `echo/build-11-opportunity-discovery` (Builds 1–11), plus an
unreviewed linear stack of 12 commits ending at
`fix/echo-cognitive-brain-v1-shadow-hardening`. No PRs. Repo CI is the
copied SalesOS workflow. See ARCHITECTURE §4b and OD-3.

---

## 1. Owner actions (agents cannot do these)

### OD-1 Protect `main` — `OWNER` — do first
- **Why:** `main` has no branch protection and no rulesets (verified via
  the GitHub API). Any agent with push access can push to it directly.
  Agents can't set this: the session's GitHub tools expose no
  repository-settings or branch-protection endpoint (re-checked
  2026-10-18).
- **Steps:** GitHub → MoatazOS → Settings → Branches → Add branch ruleset
  (or classic rule) for `main`: require a pull request before merging;
  require status check **`validate`**; block force pushes; restrict
  deletions. Leave "bypass" empty.
- **Done when:** a direct `git push origin main` is rejected.

### OD-2 Repository visibility — `OWNER`
- **Finding:** MoatazOS is public. History contains no secrets and no
  real-format phone numbers; commit emails are GitHub noreply addresses;
  data is synthetic. What is exposed is product IP: SalesOS doctrine and
  policy logic, Egypt/GCC evaluation prompts (#14), the ECHO roadmap, and
  agent-operation docs.
- **Recommendation:** make it **private** (Settings → General → Danger
  zone → Change visibility). On a free personal account, private repos
  lose branch protection/rulesets, so pair it with GitHub Pro, or keep it
  public until protection can be kept. Either way, never commit real data
  (AGENTS.md invariant 7).
- **Also:** enable Settings → Code security → secret scanning and push
  protection (free on public repos).

### OD-3 Choose the canonical ECHO lineage — `OWNER`
- **Options:** (a) the in-app deterministic runtime in MoatazOS
  (`echo/build-0` + PR #12): small, safe, proposal-only; or (b) the
  private desktop agent in `MWasfy7/ECHO` (Builds 1–11 + 12 fix commits):
  large, with real local side effects (PowerShell, app control, SQLite,
  provider CLIs).
- **Recommendation:** (a) for the product surface inside MoatazOS; keep
  (b) as a separate private research track with no cloud execution.
  Record the decision here; it unblocks ECH-02, ECH-03, ECH-04.

### OD-4 Vercel previews in PR #8 — `OWNER`
- `vercel.json` disables deploys for `main` only, so **every other branch
  push**, including nightly agent branches, triggers a public Vercel
  preview if the Vercel GitHub app is connected. Decide: keep, add
  `"*": false`, or remove the file before #8 merges.

### OD-5 Prune branches — `OWNER`
Delete the fully merged and superseded branches listed under "Other
branches". Agents never delete branches.

### OD-6 Review PROPOSED tasks — `OWNER`
Change a task's status to `APPROVED` to let the nightly routine pick it.

---

## 2. Approved queue (priority order)

### SOS-01 Integrate the Build 4 gate repair into the operator runtime — `IN_REVIEW`
- **Merge:** `owner`
- **Goal / value:** One correct operator-runtime line. Future-dated
  evidence is rejected everywhere, queue explanations are bilingual, and
  orphaned Codex work isn't lost.
- **Scope:** new branch from `origin/feat/salesos-operator-runtime`;
  `git merge --no-ff origin/codex/salesos-build4-gate-repair` and, if #13
  has merged, `origin/main`; fix
  `src/components/salesos/MobileFollowUp.tsx` `checkChat` to pass
  `asOf: new Date().toISOString()` (the same import clock
  `RealInputWorkspace` uses); add a unit or component test proving a
  future-dated pasted WhatsApp message is rejected with
  `FUTURE_EVENT_TIMESTAMP` on the mobile path. PR **targets
  `feat/salesos-operator-runtime`** (the owner's branch), not `main`.
- **Dependencies:** none.
- **Acceptance:** merge commit (no rebase or force); typecheck, lint,
  build pass; unit ≥ 192 tests, 0 failures; e2e ≥ 70 passed, including
  `mobile-follow-up.spec.ts`; `tests/SafetyBoundary.test.ts` passes; no
  changes outside the merge, `MobileFollowUp.tsx`, and the new test.
- **Tests:** full local gate; new mobile future-timestamp test.
- **Risks:** silently dropping either side's behavior in conflict
  resolution. Compare queue output for `SYNTHETIC_OPERATOR_OPPORTUNITIES`
  before and after.
- **Done:** draft PR open against `feat/salesos-operator-runtime`, gate
  results in the body, run record committed.

### ENG-01 Non-breaking dependency security patch — `APPROVED`
- **Merge:** `agent`
- **Goal / value:** Remove critical dev-toolchain advisories (Vitest API
  server RCE, `tinypool` prototype-pollution RCE) without behavior change.
- **Scope:** `package.json` / `package-lock.json` only. `vitest` 2.1.2 →
  2.1.9 (exact pin), then `npm audit fix` **without** `--force`. No major
  bumps; no `next`, `tailwindcss`, `eslint-config-next`, or
  `@playwright/test` changes (ENG-02/ENG-04).
- **Dependencies:** none.
- **Acceptance:** `npm audit` critical count drops from 3 to ≤ 1 (only
  `next` may remain); before/after audit summary in the PR; full gate
  green; no source changes.
- **Tests:** full local gate.
- **Risks:** lockfile conflicts with open PRs (#11, #14). Resolve by
  regenerating the lockfile, never by hand-editing.
- **Done:** draft PR to `main` with audit diff.

### ECH-01 Independent exact-revision review of PR #12 — `IN_REVIEW`
- **Merge:** `agent`
- **Goal / value:** PR #12 is held for "independent exact-revision
  review". This produces that review so ECHO can move forward.
- **Scope:** review `wave2/w2-01-echo-semantic-safety@f3dd965` against
  base `b7a3a2f`: run the full gate in a worktree; confirm the GitHub
  Actions WebKit result on that exact SHA; check invariant 9 (negative
  and cancellation before routing; every proposal has
  `externalSideEffect: false`; send/delete clarified); probe with at
  least 10 new adversarial inputs (EN/AR/Franco/mixed) via a throwaway
  test. Write findings to
  `docs/engineering/reviews/PR-12-f3dd965.md` (verdict APPROVE or
  REQUEST_CHANGES, with reproducible cases). Any probe worth keeping
  becomes a proposed follow-up task, not an edit to PR #12.
- **Dependencies:** none.
- **Acceptance:** review file with exact SHA, commands and exit codes,
  CI run link, verdict, and case list; no change to PR #12's branch.
- **Tests:** gate on the PR #12 tree (record results in the review).
- **Risks:** reviewing a moving target. Pin the SHA, and abort if the
  head changed.
- **Done:** docs-only draft PR to `main` with the review.

### SOS-02 Exact-head release review of PR #8 — `APPROVED` (after SOS-01)
- **Merge:** `agent`
- **Goal / value:** PR #8 requires an independent approval of its exact
  head before merge. This gives the owner a merge/no-merge answer.
- **Scope:** after SOS-01 is merged into `feat/salesos-operator-runtime`,
  review the new head against `RELEASE_GATES.md` G1–G6: invariants 1–8,
  the evidence contract, restraint behavior, bilingual parity, and the
  OD-4 decision. Write `docs/engineering/reviews/PR-8-<sha>.md`.
- **Dependencies:** SOS-01 `DONE`; OD-4 decided (otherwise the review
  records it as an open blocker).
- **Acceptance:** review file with exact SHA, gate results, a verdict,
  and findings each tied to a file:line.
- **Tests:** full gate on that SHA.
- **Risks:** none beyond scope creep. Review only; fixes become tasks.
- **Done:** docs-only draft PR to `main`.

### SOS-03 Versioned, safer prompt-evaluation lexicon (supersedes #14) — `APPROVED`
- **Merge:** `owner`
- **Goal / value:** Keep #14's Egypt/GCC evaluation set while preserving
  provenance and avoiding false objection and requirement signals.
- **Scope:** new branch from `origin/feat/salesos-prompt-evaluation-set-2389864744267045459`;
  bump `EXTRACTOR_VERSION` to `salesos-evidence-v0.2.0`; replace bare
  `عالي` with phrase-level terms (e.g. `السعر عالي`) and drop bare `تاون`;
  add negative tests: `عايز شقة في الدور العالي`, `الدور عالي وفيو حلو`
  must not yield `OBJECTION`; `انا ساكن جنب تاون سنتر` must not yield
  `PROPERTY_REQUIREMENT`; `السعر عالي شوية` must still yield `OBJECTION`
  (all four were probed against #14 on 2026-10-18; the first three
  misfire today). Matching is raw substring (`includes`), so prefer
  phrase-level terms; revert the unrelated `fsevents` lockfile
  churn. PR to `main`; body states it supersedes #14.
- **Dependencies:** none.
- **Acceptance:** full gate green; `tests/PromptEvaluationSet.test.ts`
  plus new negatives pass; existing decision-engine tests pass unchanged
  except expected version strings.
- **Tests:** full gate; new negative lexicon tests.
- **Risks:** fixtures asserting the old version string. Update those
  assertions only, in the same commit, and list them.
- **Done:** draft PR to `main`.

### ENG-03 Refresh README to match the code — `IN_REVIEW`
- **Merge:** `agent`
- **Goal / value:** The README still says the code is "untested against a
  real compiler", and its architecture tree omits Real Input, the Decision
  Engine, and the Lead Loss Report. That misleads anyone reading it.
- **Scope:** `README.md` only. Correct the architecture tree and known
  limitations, and link `AGENTS.md` and `docs/engineering/`.
- **Dependencies:** none. **Acceptance:** every path in the README exists
  on `main`; no claims beyond the verified ones. **Tests:** none
  (docs-only; CI still runs). **Risks:** none. **Done:** draft PR to `main`.

---

### GOV-01 Low-risk agent merge policy — `IN_REVIEW`
- **Merge:** `owner` (merged only on owner direction; this policy file is never agent-eligible)
- **Goal / value:** let routine engineering finish without the owner
  operating GitHub, while every risky change still waits for the owner.
- **Scope:** `AGENTS.md`, `CLAUDE.md`, `RELEASE_GATES.md` (agent merge
  policy), `AUTONOMOUS_DEVELOPMENT.md` (Step 1b merge pass, saved prompt),
  this file (`Merge:` fields).
- **Acceptance:** policy lists eligible classes and never-eligible paths
  and domains, requires a different-session re-verification, pinned SHA,
  green CI, and a GitHub-confirmed merge; full gate green.
- **Done:** merged on owner direction.

### DON-01 Donna client-outcome recovery, synthetic slice — `DONE`
- **Merge:** `owner` (touches `src/`, adds a user-facing surface; never agent-eligible)
- **Authorization:** owner-directed in a live session on 2026-10-24 from the
  Notion brief "Donna v0.1 — Voice and Proactive Client Outcome Recovery".
  Covers implementation, tests, branch and draft PR only. No merge, deploy,
  paid service, live CRM write or client contact.
- **Goal / value:** a planned client call that passes its due time without
  feedback raises exactly one unresolved question ("Did you speak with this
  client?"); ignoring it never completes it.
- **Scope:** `src/lib/donna/` (pure, deep-frozen, explicit clocks),
  `src/components/donna/`, route `/app-studio/donna`, an app-open banner and
  sidebar entry (compile-time flag `DONNA_ENABLED`), EN/AR copy, tests. Built
  on `main`, independent of ECHO branches, PR #12 and PR #25 (not touched).
- **Verified claims:** deterministic derivation from the same in-memory
  state. **Not** restart persistence: reloading the page resets the demo.
  Quiet hours use a fixed UTC+2 *demo* offset; production must use
  Africa/Cairo with daylight-saving handling.
- **Not implemented (subsequent work, labelled in the UI):** durable storage,
  voice capture and spoken replies, cross-device sync, closed-app
  notifications and any server scheduler, opt-out handling, client-identity
  clarification, batching, and the SalesOS/ECHO connection.
- **Acceptance:** options Spoke / No answer / Didn't call / Snooze / Cancel;
  snooze, dismiss and "task done" leave the question open; internal
  follow-up date and client-confirmed appointment are distinct types, and an
  appointment needs explicit client confirmation and a conversation; EN and
  AR/RTL; no execution control; `SafetyBoundary` unchanged and passing.
- **Done:** merged as PR #27 (merge commit `672f054`, owner-directed, head `b4dc39d`); run record in `docs/engineering/runs/`.

### DON-02 Durable, authenticated Donna records (synthetic data only) — `IN_REVIEW`
- **Merge:** `owner` (touches `src/`, `AGENTS.md`, `SafetyBoundary`, a dependency, a hosted database)
- **Authorization:** owner-directed on 2026-10-24: DON-02 with synthetic data only; single-owner
  Supabase auth, public sign-up disabled, per-user row security; narrow amendments to AGENTS.md and
  `SafetyBoundary`; one exact-pinned `@supabase/supabase-js`; migration SQL, provider integration,
  contract tests, and a separate real-database acceptance harness; a draft PR. **No** merge,
  deployment, provisioning, paid plan, or real client data. Repository visibility unchanged (OD-2 open).
- **Plan / setup / auth decision:** `docs/engineering/DON-02-PLAN.md`, `DON-02-SETUP.md`, `adr/0001-auth.md`
  (the ADR covers MOS-10 for this scope only).
- **Scope:** `supabase/migrations/20261025000000_donna_durable_records.sql`; `src/lib/donna/{store,memoryStore}.ts`,
  `src/lib/donna/remote/{config,supabaseStore}.ts`; provider and sync panel; EN/AR copy; tests;
  `npm run test:donna-db` and `npm run test:donna-live`.
- **Acceptance (all required before the owner treats DON-02 as done):**
  1. Database rules proven on a throwaway local Postgres: invalid types/payloads, future events, bad call
     references, appointment/outcome inconsistencies, ownership, append-only, one outcome per call,
     retry vs conflict, parallel races, allowlist, isolation (`npm run test:donna-db`). **Done locally.**
  2. Browser rules and provider behaviour proven with a mock store (labelled MOCK). **Done locally.**
  3. **Live, against a real hosted project (blocked on owner setup):** save an outcome, reload, a second
     authenticated browser context shows the same record; retry and conflicting writes create no
     duplicate outcome; a different account cannot access the records; sign-up is refused;
     then repeat by hand on the owner's phone and laptop.
- **Not done:** hosted verification, deployment, Africa/Cairo quiet hours (DON-04), offline queue, voice, real data.

## 3. Blocked

### ECH-02 Make the NLF-50 harness hermetic (rework #11) — `BLOCKED` on OD-3, ECH-01
- **Goal / value:** A reproducible natural-language evaluation gate for
  ECHO.
- **Scope:** port #11's fixtures and evaluator onto the ECHO branch chosen
  in OD-3; import `@/lib/echo` directly; delete the git/esbuild
  extraction adapter; put the scorecard behind a separate script, not
  `npm test`; pin any new dev dependency exactly.
- **Acceptance:** `npm test` makes no network or git calls (verify by
  running offline); scorecard is reproducible across two runs.
- **Tests:** full gate offline. **Risks:** the fixtures encode expectations
  that conflict with W2-01 semantics. Record them; don't "fix" the
  runtime to match. **Done:** draft PR to the ECHO branch.

### ECH-03 Integration PR: ECHO Build 0 + W2-01 → `main` — `BLOCKED` on OD-3, ECH-01
- **Scope:** one PR merging the reviewed ECHO branch into `main`; confirm
  `/echo` passes `SafetyBoundary` and that SalesOS tests are unchanged.
- **Acceptance:** full gate; no SalesOS file modified.

### ECH-04 Review the private ECHO control-intent stack — `BLOCKED` on OD-3
- **Scope (if OD-3 keeps the desktop track):** in `MWasfy7/ECHO`, open a
  draft PR from `fix/echo-cognitive-brain-v1-shadow-hardening` to the
  default branch, run its tests (static only, never the desktop runtime),
  and write a review. Audit evidence (2026-10-18, Node 22): default
  branch `113555c` passes typecheck, lint, and build, and 29/29 test
  files once a Chromium binary matching Playwright 1.47.2 is present
  (without one, the 10 browser tests in `EchoBuild6.test.ts` fail to
  launch); stack tip `4f75f1d` passes typecheck, lint, build, and
  1483/1483 tests in 42 files.

---

## 4. Proposed (owner approval required before any code)

Each item lists goal, scope, dependencies, acceptance, tests, and risks
in compact form. Before approval, refine it to the SOS-01 level of detail.

| ID | Workstream | Goal / value | Scope | Depends on | Acceptance & tests | Risks / constraints |
|---|---|---|---|---|---|---|
| ENG-02 | Platform | Clear the `next` critical advisory (DoS in the self-hosted image optimizer and RSC; not exploitable while nothing is deployed) | Upgrade Next 14 → 15 (React 19), then evaluate 16 | ENG-01 | Full gate plus manual route parity; screenshots compared | Breaking App Router and React changes; large diff |
| ENG-04 | Platform | Remove the Chromium mismatch and the Playwright advisory | `@playwright/test` → current 1.x; drop the executable override if it becomes unnecessary | ENG-01 | e2e green in CI (WebKit) and cloud | CI browser download size and time |
| MOS-01 | MoatazOS | Versioned shared data contracts between modules | `docs/engineering/CONTRACTS.md` plus contract tests for `NormalizedSalesEvent`, `DecisionSequence`, `EvidenceContract`, `EchoResult` | OD-3 | Contract tests fail on any breaking field change | Over-specifying early |
| MOS-02 | SalesOS | Command Center cards produced by the Decision Engine, not hand-authored fixtures | Adapter from `DeterministicDecisionSnapshot` to the `DecisionSnapshot` view model | SOS-02 | Every existing fixture state reproducible; integrity tests pass | Two models drift; integrity semantics |
| MOS-10 | MoatazOS | Authentication and tenant boundary design (ADR only). Donna-only scope approved: `adr/0001-auth.md` (general design still open) | `docs/engineering/adr/0001-auth.md` | OD-2 | Owner-approved ADR | Must not add a backend without approval |
| MOS-11 | MoatazOS | Agent coordination: a nightly status digest the owner can read in 2 minutes | Routine writes a summary issue comment | routine live | Digest lists runs, PRs, blockers | Outward-facing noise |
| SOS-10 | SalesOS | Follow-up recommendations: suggested channel and timing class for `NEXT_STEP_READY`, never message sending | `src/lib/operatorRuntime` recommendation class plus UI | SOS-02 | Restraint wins over any recommendation; tests in EN/AR | Must not become drafted outreach without approval |
| SOS-11 | SalesOS | KPI learning: analyze disagreement and outcome ledgers into doctrine *candidates* (never auto-applied) | Pure analysis functions over ledgers | SOS-02 | Candidates cite ledger evidence; doctrine unchanged without an operator | Causal over-claiming |
| SOS-12 | SalesOS | Permission-controlled integrations (CRM, WhatsApp, calendar) design (ADR only) | ADR covering scopes, consent, audit log, kill switch | MOS-10 | Owner-approved ADR; no code | Real-customer-data exposure |
| ECH-10 | ECHO | Durable session memory for in-app ECHO | Memory-only → explicit export/import, then a persistence ADR | ECH-03 | Restart-safe without browser storage until approved | Invariant 8 (persistence) |
| ECH-11 | ECHO | Routing reliability: NLF-50 pass rate tracked per build | Uses ECH-02 scorecard | ECH-02 | Trend table in the PR | Teaching to the test |
| ECH-12 | ECHO | Tool orchestration design (ADR only) | Permission model, proposal → approval → execution separation | ECH-03, MOS-10 | Owner-approved ADR | External side effects |
| DON-03 | Donna | Voice capture with reviewable transcript | Tap to speak, review, confirm; EN, Egyptian Arabic and Franco tests; text fallback | DON-02 | Transcript and extracted facts reviewable; unclear client identity not guessed; real-device check | Provider and recurring cost named before paid use |
| DON-04 | Donna | Closed-app reminders | Server scheduler and supported notification delivery; quiet hours in the Africa/Cairo time zone with DST handling (DON-01 uses a fixed UTC+2 demo offset); batching | DON-02 | Distinguish scheduled, provider-accepted, device-received, acknowledged; verified on the owner's actual iPhone | Outbound delivery; mock delivery must be labelled mocked |
| DON-05 | Donna | Connect the prepared SalesOS action card | Opt-out blocks outreach but not record keeping; nothing is sent automatically | DON-01, SOS-10 | Restraint wins; tests in EN/AR | Invariants 1 and 2 |
