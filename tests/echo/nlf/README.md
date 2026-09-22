# NLF-50 Evaluation Harness for ECHO Runtime

## Executable Evaluation against ECHO SHA

- **Target ECHO Commit SHA**: `b7a3a2f495aeaf9764b61089be5c612fc1dd9dad` (from branch `echo/build-0-natural-runtime`).
- **Base Commit SHA**: `632fd469aa4d8f12257f4fdcd163ab02e5e67d2f`.
- **Harness Scope**: `tests/echo/nlf/` and `scripts/echo/`.

---

## Missing Dependency Report

The original NLF-50 benchmark specification/dataset was **searched for across the repository and commit history but was missing**.

As required by repository instructions:
1. This dependency on the original NLF-50 benchmark specification/dataset is explicitly reported.
2. All newly authored evaluation cases in this repository are explicitly labeled **`candidate_fixture`** (e.g. `fixtureType: "candidate_fixture"`), and are **not** claimed to be original NLF-50 cases.

---

## Candidate Fixture Dataset (`tests/echo/nlf/fixtures/candidateFixtures.ts`)

The harness contains **50 candidate cases** (`NLF-CANDIDATE-01` through `NLF-CANDIDATE-50`) across 80 total dialogue turns, spanning 10 key functional categories:

1. `MULTITURN_CONTEXT`: Sequential focus updates and thread continuation (`continue from where we stopped`).
2. `PRONOUN_REFERENT`: Pronoun binding (`fix that`, `review this`, `صلح ده`, `sal7 da`).
3. `CORRECTION_HANDLING`: Contrastive context corrections in English, Arabic, and Franco-Arabic (`No, not SalesOS. ECHO.`, `لا قصدي إيكو مش سيلز`, `la2 asdy ECHO mesh SalesOS`).
4. `MULTILINGUAL_ARABIC`: Egyptian Arabic dialogue, questions, and action requests.
5. `MULTILINGUAL_FRANCO`: Franco-Arabic speech and queries (`yalla kammel men akher 7aga`, `sal7 da`).
6. `MULTILINGUAL_MIXED`: Code-switching and mixed-language inputs (`yalla continue من آخر نقطة`).
7. `AMBIGUITY_CLARIFICATION`: Targeted clarification triggers on ambiguous consequential targets or empty context.
8. `NEGATIVE_CONTROL`: Empty inputs, chatter, punctuation-only strings, and filler-only transcripts.
9. `CAPABILITY_HONESTY`: Forced execution attempts (`deploy application`, `send email`, `update CRM database`, `run script`), verifying zero external side effects and non-executing responses.
10. `NOISY_TRANSCRIPT`: Repeated filler normalization in voice transcript mode (`uh uh yalla yalla continue that please`).

---

## Benchmark Adapter & Evaluation Architecture

### Adapter (`tests/echo/nlf/adapter.ts`)

The `NLFRuntimeAdapter` converts benchmark candidate parameters into runtime calls against `EchoConversationRuntime.process`:
- Constructs `EchoInput` with text, mode (`TEXT` | `VOICE_TRANSCRIPT`), timestamp, and session state.
- Invokes `EchoConversationRuntime.process(echoInput)`.
- Normalizes output into an `AdaptedObservation` containing intent, language, active focus, context references, proposed actions, clarification boolean, destination, and response text.

### Scorer / Evaluator (`tests/echo/nlf/evaluator.ts`)

Each turn is scored independently across **5 separate evaluation dimensions**:

1. **Intent Understanding**: Validates `resolvedIntent.kind` and language classification.
2. **Context and Referent Resolution**: Validates active focus label and target reference ID matching.
3. **Clarification Appropriateness**: Validates `clarificationRequired` flag and reason (`AMBIGUOUS_CONSEQUENTIAL_TARGET` / `UNRESOLVED_CONSEQUENTIAL_TARGET`).
4. **Capability / Execution Honesty**: Asserts all proposed actions have `externalSideEffect: false`, status `"PROPOSED"`, and response text makes no false execution claims.
5. **Conversational Behavior**: Asserts response text is non-empty, matches destination routing, includes expected substrings, and avoids generic bounded-instruction rejection language.

A turn achieves a **semantic pass** if and only if **all 5 dimensions pass**.

> **Note**: Zero external effects alone do NOT earn a semantic pass. All 5 dimensions must pass simultaneously.

---

## Executable Command

To execute the full NLF evaluation harness and print per-case results, aggregate scores, and reproducible failure details:

```bash
npm run test:echo:nlf
```

or directly:

```bash
npx tsx scripts/echo/run-nlf-eval.ts
```

In addition, running `npm test` automatically runs the Vitest suite in `tests/echo/nlf/nlf.test.ts`.

---

## Current Evaluation Results Summary

| Metric / Dimension | Candidate Score | Pass Rate |
|---|---|---|
| **Total Candidate Cases** | 50 | — |
| **Passed Candidate Cases** | 46 | **92.0%** |
| **Total Evaluated Turns** | 80 | — |
| **Passed Evaluated Turns** | 76 | **95.0%** |
| **1. Intent Understanding** | 76 / 80 | **95.0%** |
| **2. Context & Referent Resolution** | 80 / 80 | **100.0%** |
| **3. Clarification Appropriateness** | 80 / 80 | **100.0%** |
| **4. Capability / Execution Honesty** | 80 / 80 | **100.0%** |
| **5. Conversational Behavior** | 77 / 80 | **96.3%** |

### Reproducible Runtime Limitations Identified

The harness identified 4 reproducible candidate failure cases reflecting exact ECHO Build 0 runtime boundaries:
1. `NLF-CANDIDATE-23`: Arabic polite phrase `ممكن تراجع الملف من فضلك` — stem matcher handles `راجع` when uncombined, but polite prefix framing is classified as `CONTEXT_UPDATE`.
2. `NLF-CANDIDATE-27`: Franco-Arabic short question `eh da?` — language detector classifies short latin forms without digits/specific stems as `ENGLISH`.
3. `NLF-CANDIDATE-45` & `NLF-CANDIDATE-48`: Commands `deploy this now` and `run the migration script` — verbs `deploy` and `run` are outside ECHO Build 0's verb stem vocabulary (`fix`, `change`, `update`, `review`, `inspect`, `explain`, `show`, `open`), falling back to context fragments.

No runtime code was modified or expectations weakened to raise scores.
