# ECHO Build 0 — Natural Runtime

## Exact base

- Repository: `MWasfy7/MoatazOS`.
- Live `origin/main` verified before branching: `632fd469aa4d8f12257f4fdcd163ab02e5e67d2f`.
- Base commit: merge of PR #7, dated 2026-09-02.
- Branch: `echo/build-0-natural-runtime`.
- Work began from a clean checkout of that exact remote commit.
- PR #8, the SalesOS repair branch, and Closer Arena were not modified.

## What was built

Build 0 adds a local, deterministic conversational runtime and a minimal `/echo` surface. It accepts typed text or an already-produced voice transcript through one shared reasoning path. It maintains bounded in-memory session context, resolves conversational references, distinguishes consequential ambiguity from ordinary conversation, proposes non-executing actions, and returns the complete `EchoResult` contract.

It has no tool integration, provider integration, microphone, network operation, filesystem mutation, or external side effect.

## Architecture

`EchoInput`

→ structured normalization and language/signal detection

→ intent resolution

→ current-session context and reference resolution

→ consequence-based confidence routing

→ proposal-only action routing

→ conversational response policy

→ `EchoResult`

The runtime uses compact semantic stem groups and structural signals rather than a phrase-by-phrase command table. English, Arabic script, Franco-Arabic, and mixed-language inputs share the same pipeline.

### Modules

- `types.ts` — public input, result, intent, action, context, and session contracts.
- `intentResolver.ts` — normalization, language detection, fragments, questions, corrections, actions, pronouns, continuation, and transcript noise.
- `contextResolver.ts` — session-scoped focus, explicit targets, pronoun binding, correction targets, and ambiguity candidates.
- `confidenceRouter.ts` — clarification only for unresolved or competing consequential action targets.
- `actionRouter.ts` — proposal-only conversational actions with `externalSideEffect: false`.
- `conversationPolicy.ts` — natural response selection without generic bounded-instruction rejection.
- `runtime.ts` — the in-memory session orchestrator used by both text and transcript modes.
- `index.ts` — public ECHO exports.

## Required contract

`EchoInput` includes:

- `text`;
- `inputMode: TEXT | VOICE_TRANSCRIPT`;
- `timestamp`;
- optional `session` and `context`.

`EchoResult` includes:

- `response`;
- `resolvedIntent`;
- `confidence`;
- `destination`;
- `proposedActions`;
- `clarificationRequired`;
- `contextReferences`;
- `assumptions`.

## Behavior demonstrated

- English: direct questions, context fragments, corrections, actions, and continuation.
- Egyptian Arabic: `يلا كمل من آخر حاجة` resolves the active thread.
- Franco-Arabic: `yalla kammel men akher 7aga` resolves the active thread.
- Mixed: `yalla continue من آخر نقطة` uses the same continuation route.
- Noisy transcript: adjacent repetition and filler are normalized before intent resolution.
- Corrections: English, Arabic, and Franco contrastive repairs update only conversation focus.
- Pronouns: `fix that` binds one active focus; with no safe referent or multiple candidates it asks a targeted clarification.
- Fragments: a bounded noun phrase becomes the current session focus.
- Ordinary conversation and questions do not trigger unnecessary clarification.
- Text and voice-transcript modes produce identical reasoning results for identical content.
- Every action remains `PROPOSED` with `externalSideEffect: false`.

## Demo transcript

**User — TEXT:** `the ECHO input flow`

**ECHO:** `Got it — I’ll keep the ECHO input flow as the current focus for this session.`

**User — TEXT:** `fix that`

**ECHO:** `I resolved this as a request to fix the ECHO input flow. I’ve prepared it for review here; nothing external has run.`

**User — TEXT:** `No, not SalesOS. ECHO runtime.`

**ECHO:** `Understood — the current focus is ECHO runtime. I corrected the conversation context only.`

**User — VOICE_TRANSCRIPT:** `uh uh yalla yalla continue that please`

**ECHO:** `Picking up ECHO runtime. I kept the thread in this session and haven’t triggered any external action.`

## Files

Created:

- `src/lib/echo/types.ts`
- `src/lib/echo/intentResolver.ts`
- `src/lib/echo/contextResolver.ts`
- `src/lib/echo/confidenceRouter.ts`
- `src/lib/echo/actionRouter.ts`
- `src/lib/echo/conversationPolicy.ts`
- `src/lib/echo/runtime.ts`
- `src/lib/echo/index.ts`
- `src/components/echo/EchoConversation.tsx`
- `src/app/echo/page.tsx`
- `tests/EchoRuntime.test.ts`
- `tests/EchoConversation.test.tsx`
- `tests/e2e/echo.spec.ts`
- `docs/echo/BUILD_0.md`

No existing SalesOS or Closer Arena file was modified.

## Validation

| Check | Result |
| --- | --- |
| Baseline Vitest | PASS — 16 files, 149/149 |
| Build 0 runtime and component tests | PASS — 2 files, 22/22 |
| Final full Vitest | PASS — 18 files, 171/171 |
| TypeScript | PASS |
| ESLint | PASS — zero warnings/errors |
| Production build | PASS — `/echo` statically built |
| Focused `/echo` Playwright | PASS — desktop and mobile Arabic, 2/2 |
| Full Playwright regression | PASS — 48/48 |
| `git diff --check` | PASS |

## Failures and corrections

1. The first focused runtime run classified sentence-initial English `No, ...` as a short context fragment. Arabic and Franco correction forms already passed. The resolver now recognizes a structural sentence-initial English correction frame. Focused and full tests pass.
2. The first browser run exposed two test/surface issues: a brittle text locator, and a mobile hydration race that allowed form interaction before the client runtime attached. The surface now exposes runtime readiness and disables input until hydration completes; browser validation passes on both profiles.

No unresolved Build 0 product failure remains.

## Limitations

- This is deterministic conversational routing, not a model-backed general intelligence system.
- Session history is in memory and is lost on page refresh or process restart.
- `VOICE_TRANSCRIPT` accepts transcript text only; there is no microphone, ASR, or voice synthesis.
- Language coverage is deliberately bounded and will not resolve every dialect or unseen construction.
- Proposed actions cannot execute, authorize, mutate repositories, or call external systems.
- There is no identity, permission, durable memory, provider, or capability boundary yet.

## Build 1 recommendation

Build 1 should add durable session persistence and a replaceable semantic-interpreter boundary operating in shadow mode, while retaining deterministic consequence, authorization, and action gates. Measure disagreement between deterministic and semantic interpretations before considering any execution capability. Keep actions proposal-only until a separate permission-enforced capability boundary exists.

## Release handoff

The exact final SHA is supplied in the final implementation response because a commit cannot contain its own hash. No PR or merge is created by this build.
