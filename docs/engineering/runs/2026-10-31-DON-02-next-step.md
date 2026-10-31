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
