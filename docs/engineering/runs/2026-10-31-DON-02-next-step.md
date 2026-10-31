# 2026-10-31 DON-02: Next step column, hosted verification

Synthetic data only. No credentials, keys or account emails appear in this record.

## Hosted schema check (read-only)

| Item | Value |
|---|---|
| Code commit under test | `e29498ef3272c12066798e7579699cb0f53e1b04` (branch `donna-live-check`) |
| Hosted project reference | `wtdstuqpbzjcdywqhwgq` |
| Method | Signed in as test account A with the public anon key; one `select next_step ... limit 1` and one `donna_record_event` call that is rejected before anything is stored (valid shape, new `next_step` key, a call id that does not exist). Nothing was written or changed. |
| `donna_events.next_step` column exists | yes |
| `donna_record_event` accepts the `next_step` key | yes (the new version answered `DONNA_UNKNOWN_CALL`; the old version would answer `DONNA_INVALID_PAYLOAD`) |

Not checked from the code side: the dropped old `donna_compare_existing` overload and the extended check constraint
(the read-only dashboard query in `DON-02-SETUP.md` step 3.2 covers both).

## Hosted acceptance

| Item | Value |
|---|---|
| Command | `npm run test:donna-live` (environment loaded from the local gitignored files; no values printed) |
| Code commit | `e29498ef3272c12066798e7579699cb0f53e1b04` (the documentation change that follows touches no code) |
| Started / finished | 2026-10-31T15:05:04Z / 2026-10-31T15:05:46Z |
| Result | **14 passed, 0 failed, 0 skipped** (39.2 s) |
| Covered | 7 database contract scenarios; save, reload and a second authenticated browser context with the exact note and Next step; a note equal to the old versioned-prefix example stays a plain note; phone viewport 390x844 plan-call, outcome, Next step, follow-up, reload; no duplicate outcome on retry/conflict; account B isolation; signed-out refusal; sign-up refusal |

## Limits

- The Supabase migration was applied by the owner earlier; this run only verified it. A second run of the migration file fails with `42701` and changes nothing.
- Voice dictation was tested only with a mocked recognizer. It has not been tried on a real phone or microphone.
- No hosted URL exists. Nothing is deployed.

## Donna workspace slice (Today, drafts, memory, model status)

Added on top of `5edde16`: a Today view (calls due with no outcome, rest-of-today calls, open commitments with overdue/today/upcoming),
follow-up drafts that need operator approval of the exact text before they can be copied (Donna cannot send), a read-only client
memory view with the operator's words untouched plus session-only corrections, and a model/cost status panel.

- Data: existing tables only. No migration, no new network code, no new dependency. Original text is never rewritten.
- Models: **none connected.** Drafts are fixed templates. The status panel states a $0 cap; the safety-boundary test forbids network code in `src/`.
- Corrections are kept only for the page session (saving them would need a database change that has not been approved).
- Hosted acceptance with the new assertions (Today commitment with the exact next step, memory text, draft approval gate on a 390px viewport):
  `npm run test:donna-live`, 2026-10-31T15:22:01Z to 15:22:35Z, **14 passed, 0 failed**, project `wtdstuqpbzjcdywqhwgq`.

## AirLLM inspection (read-only, 2026-10-31)

- Windows: no AirLLM, PyTorch, transformers, Ollama or LM Studio found in either Python install; no listening model server.
- WSL (Ubuntu-24.04): `~/airllm-lab` holds a virtual environment containing only `pip`. A `pip install torch==2.10.0` (CUDA 12.8 build) was still
  running when checked. The `airllm` package is not installed, no model files exist, no server process or port, no API keys or env files.
- Hardware visible from WSL: NVIDIA GeForce RTX 3050 Laptop GPU, 4096 MiB.
- Conclusion: AirLLM is not installed or running, so Donna cannot connect to it. ChatGPT, Claude and Gemini chat subscriptions are not integrated
  and are not API access.
