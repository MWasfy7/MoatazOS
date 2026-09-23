# NLF-50 Evaluation Harness for ECHO Runtime

## Executable Evaluation against Selectable ECHO SHA

- **Default ECHO Commit SHA**: `b7a3a2f495aeaf9764b61089be5c612fc1dd9dad` (from branch `echo/build-0-natural-runtime`).
- **Base Commit SHA**: `632fd469aa4d8f12257f4fdcd163ab02e5e67d2f`.
- **Harness Scope**: `tests/echo/nlf/` and `scripts/echo/`.

---

## Package Dependencies & `package.json` Changes

To support executable evaluation scripts and CJS bundling for dynamic runtime extraction in shallow CI environments, the following dependencies were added:
- **`devDependencies`**:
  - `tsx` (v4.23.15) — TypeScript CLI execution runner.
- **`scripts`**:
  - `"test:echo:nlf": "tsx scripts/echo/run-nlf-eval.ts"` — Executable command running the full NLF evaluation scorecard.

---

## Benchmark Datasets

The harness maintains two separate test suites:

1. **Original NLF-50 Benchmark Suite (`tests/echo/nlf/fixtures/originalNlf50.ts`)**:
   - Transcribed directly from the user-supplied 50 original inputs, source expected intents, and source clarification flags.
   - Preserves source intent labels and documents their adapter mapping to actual ECHO runtime intent kinds.
   - Explicitly flags 11 source defects/conflicts (`NLF-008`, `NLF-009`, `NLF-011`, `NLF-012`, `NLF-019`, `NLF-025`, `NLF-027`, `NLF-028`, `NLF-029–031`, `NLF-043`, `NLF-050`) as `source_conflict` / `needs_context`.

2. **Candidate Fixture Suite (`tests/echo/nlf/fixtures/candidateFixtures.ts`)**:
   - 50 candidate cases (`NLF-CANDIDATE-01` through `NLF-CANDIDATE-50`) across 80 dialogue turns.
   - Explicitly labeled `candidate_fixture` (`fixtureType: "candidate_fixture"`).
   - Retains candidate results and 4 baseline runtime failures (92.0% case pass rate / 95.0% turn pass rate).

---

## Adapter Mapping Table

The adapter maps original benchmark intent labels to actual ECHO runtime `EchoIntentKind` values:

| Source Intent Category | ECHO Runtime Intent Kind (`mappedRuntimeIntent`) | Destination |
|---|---|---|
| `GREETING_ORIENTATION` | `GREETING` | `CONVERSATION` |
| `STATUS_AND_PLANNING_QUERY`, `STATUS_QUERY`, `DECISION_INSPECTION_QUERY`, `INSPECTION_QUERY`, `DIAGNOSTIC_QUERY`, `PROBLEM_REPORT_INSPECTION`, `AUDIT_LOG_EXPLANATION`, `HISTORICAL_BUILD_INSPECTION`, `CONSULTATION_ADVISORY`, `CONNECTIVITY_CHECK` | `INFORMATION_REQUEST` | `CONVERSATION` |
| `RESUME_CONTEXTUAL_WORK`, `AMBIGUOUS_RESUME` | `CONTINUE` | `CONTEXT` / `CLARIFICATION` |
| `AMBIGUOUS_FIX_REQUEST`, `UPDATE_PROJECT_STATUS`, `DESTRUCTIVE_ACTION_AMBIGUOUS`, `RESCHEDULE_EVENT`, `SCHEDULE_COMMUNICATION`, `DESTRUCTIVE_ACTION_UNBOUND`, `ARCHIVE_ENTITY`, `AMBIGUOUS_ACTION_FRUSTRATED`, `SEARCH_AND_REOPEN_TICKET`, `REVERT_WORKSPACE_VERSION`, `INITIATE_CONTACT_AMBIGUOUS` | `ACTION_REQUEST` | `ACTION_REVIEW` / `CLARIFICATION` |
| `MODIFY_MISSION_TARGET`, `CRITIQUE_AND_REDESIGN_REQUEST`, `ABORT_DISPATCH`, `REJECTION_OR_EXCLUSION`, `CORRECT_ENTITY_BINDING`, `CONSTRAIN_SCOPE` | `CORRECTION` | `CONTEXT` |
| `CONSTRAIN_ACTION_RESTRAINT`, `DEPLOYMENT_REQUEST`, `MODIFY_SPECIFICATION`, `SYSTEM_MAINTENANCE_ACTION`, `DISAMBIGUATION_SELECTION`, `ARTIFACT_SELECTION`, `CONFIRMATION_MULTI_SELECTION`, `ARTIFACT_RETRIEVAL`, `OUTBOUND_DISPATCH_UNBOUND`, `SET_COMMUNICATION_MODE_QUIET`, `DISPATCH_CONTRACT_AMBIGUOUS`, `CATASTROPHIC_DESTRUCTIVE_COMMAND` | `CONTEXT_UPDATE` | `CONTEXT` |

---

## Executable Command & Selectable SHA Options

To execute the evaluation harness against the default ECHO SHA (`b7a3a2f495aeaf9764b61089be5c612fc1dd9dad`):

```bash
npm run test:echo:nlf
```

To run against a specific selectable ECHO SHA:

```bash
npx tsx scripts/echo/run-nlf-eval.ts --sha=<TARGET_COMMIT_SHA>
```

or using environment variables:

```bash
ECHO_SHA=<TARGET_COMMIT_SHA> npm run test:echo:nlf
```

To enable strict benchmark acceptance gate mode (producing exit code 1 if benchmark acceptance is rejected):

```bash
npm run test:echo:nlf -- --strict
```

---

## Distinction: Harness Execution Success vs Benchmark Acceptance

- **Harness Execution Success (`harnessExecutionSuccess`)**: Indicates whether the evaluation runner extracted the runtime SHA, set up test fixtures, and executed all candidate and original cases without crashing (`PASS [SUCCESS]`).
- **Benchmark Acceptance (`overallAccepted`)**: Indicates whether 100% of benchmark cases passed across all 5 scoring dimensions. If failing cases remain or source defects exist, benchmark acceptance is reported as `REJECTED`.
- **Gate Exit Code Disclosed**: By default, CLI reports results and exits with 0 for inspection. In `--strict` gate mode, unresolved benchmark acceptance produces exit code 1.
