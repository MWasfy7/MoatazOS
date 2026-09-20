# W2-01 — ECHO semantic repair checkpoint

Date: 2026-09-20. Owner: Codex in this session.
Base: b7a3a2f495aeaf9764b61089be5c612fc1dd9dad.
Branch: wave2/w2-01-echo-semantic-safety.

Status: locally validated checkpoint; HOLD for native WebKit and independent exact-revision review. No merge or release. W2-02 through W2-10 are not implemented by this change.

## Changes

- Recognize cancellation and restraint before positive action routing. Known English, Egyptian Arabic and Franco examples produce no action proposal.
- Recognize send/delete intent, disclose absent execution services, and clarify unbound outbound payload/recipient references.
- Preserve conversational focus across greetings and negative requests.
- Allocate monotonic turn sequences independent of retained history length and unique proposal IDs per turn within a runtime session.
- Add negative and positive controls, text/transcript parity checks, identity tests and a browser regression.

## Executed validation

| Command | Result |
|---|---|
| npm test -- --run | Exit 0; 196/196 tests in 18 files, including 44 ECHO runtime tests |
| npm run lint | Exit 0; no warnings/errors |
| npm run typecheck | Exit 0 after fixing a possibly-undefined test access |
| npm run build | Exit 0; all 11 routes generated |
| npm run test:e2e -- --project=desktop-chromium | Exit 0; 25/25 tests including two ECHO tests |
| npx playwright install chromium | Exit 0; installed missing browser and FFmpeg |
| npx playwright install webkit | Exit 0 for download; host validation warned of missing libraries |
| npx playwright install-deps webkit | Exit 1; apt could not setgroups/setegid/seteuid in this container |

The earlier browser run failed before launch because Chromium was missing. The successful retry supersedes that environment blocker for desktop only. Chromium tests with mobile viewports or Arabic locale do not constitute native WebKit evidence.

The full unit suite ran immediately before a test-only optional-access correction; the corrected test source then passed typecheck and production compilation. Runtime source remained unchanged during desktop validation.

## Scope and limitations

This remains a bounded deterministic prototype. It has no execution service, no persistent contact-policy store, and no claim of full multilingual understanding. Restraint responses explicitly say no durable policy changed. IDs are unique within an in-memory runtime session, not a durable cross-process identity system. Arbitrary compound requests, quoted instructions, historical queries, and all NLF-50 cases have not been certified by these regressions.

The sixteen-section proposed contract and original NLF-50 need reconciliation in W2-02; this change does not declare them passed. The minimal /echo UI remains a test surface. Existing SalesOS files are untouched and SalesOS release evidence stays on its separate track.

Rollback checkpoint: b7a3a2f495aeaf9764b61089be5c612fc1dd9dad. A reviewer should inspect the exact published repair SHA and run native WebKit in a capable environment before approving promotion.
