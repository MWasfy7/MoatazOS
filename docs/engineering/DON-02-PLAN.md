# DON-02 plan: durable, authenticated Donna records across phone and laptop

Status: **APPROVED by the owner on 2026-10-24 (synthetic data only), with
corrections; implemented on `claude/don-02-durable-records` (draft PR).** The
exact setup is in `DON-02-SETUP.md`; the auth decision is `adr/0001-auth.md`.
Corrections the owner required, all implemented: validity enforced in the
database; ownership, append-only, one outcome per call and retry idempotency
enforced there, with a retry distinguished from a conflict; allowlist enforced
server-side; one exact login flow (email and password); sync off by default and a
save shown only after the database acknowledges it. Written against `main@672f054`.

## 1. What exists today (verified)

- No backend, database, authentication, deployment, or hosted environment.
  `main` has no `vercel.json` (PR #8 adds one that disables `main` deploys only; OD-4).
- Donna state is a `useState` in `DonnaProvider`; a reload resets it. DON-01
  is **memory-only and is not persistence**. Do not call any further in-memory
  work persistence.
- `tests/SafetyBoundary.test.ts` forbids, anywhere in `src/`: `fetch`,
  `process.env`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`,
  route handlers, middleware, server actions, any absolute URL, and any runtime
  dependency beyond `next`, `react`, `react-dom`. Any durable store breaks
  several of these, so DON-02 is a deliberate, owner-approved capability change.
- MOS-10 (auth and tenant ADR) is `PROPOSED` and depends on OD-2. OD-2 (repo is
  public) is undecided. `docs/salesos-diagnostic/data-privacy-requirements.md`
  stops real data until authorization, retention, access and deletion are
  decided; RELEASE_GATES G6 needs a private repo, kill switch, trial plan.
- Docker and `psql` are installed in the cloud sandbox; whether a Docker daemon
  runs there is **unverified**. I have not tried it.

## 2. Smallest concrete implementation

**Hosted Postgres with built-in auth and row-level security (Supabase),
called directly from the static Next app. No custom server code.**

Why this is smallest: it needs no route handlers, server actions or
middleware; auth, sessions, TLS and per-user isolation come from the service.
Alternatives considered and rejected for now: Next route handlers plus a
separate database (more code, and breaks the "no route handler" invariant
harder); Cloudflare Worker plus D1 (custom auth to write and secure); a
self-hosted machine (not reachable from a phone without hosting).

### Data model (append-only, mirrors the DON-01 engine)

```sql
donna_calls  (owner_id uuid, id text, client_id text, due_at timestamptz,
              primary key (owner_id, id))
donna_events (owner_id uuid, event_id uuid primary key,   -- client-generated idempotency key
              seq bigint generated always as identity,   -- server order
              call_id text, type text check (type in
                ('QUESTION_DISMISSED','TASK_MARKED_DONE','SNOOZED','OUTCOME_RECORDED')),
              at timestamptz, payload jsonb)
-- exactly one outcome per call, enforced by the database, not the UI:
create unique index one_outcome_per_call on donna_events (owner_id, call_id)
  where type = 'OUTCOME_RECORDED';
-- RLS on both tables: owner_id = auth.uid(); insert-only on donna_events (no update/delete policy).
```

- **No duplicate tasks:** calls upsert on `(owner_id, id)`; events are keyed by
  `event_id`, so a retry or a second device replaying the same write is a no-op
  (`on conflict do nothing`). A second outcome for a call hits the unique index
  and the UI shows the existing `ALREADY_RESOLVED` message ("recorded on
  another device").
- **Concurrent snoozes** on two devices are both kept; the latest `seq` wins
  (the DON-01 repair already implements this).
- Client ids stay pseudonymous (`cl-…`). Real names, phone numbers and emails
  are not stored in DON-02.

### Code shape

- `src/lib/donna/store.ts`: `DonnaStore` interface (`loadState`, `appendEvent`,
  `upsertCalls`). The pure engine (`applyEvent`, `buildInbox`) is unchanged;
  state is rebuilt by folding rows ordered by `seq`.
- `src/lib/donna/remote/supabaseStore.ts`: **the only file** that touches the
  network, the env, and the SDK. `NEXT_PUBLIC_*` URL and anon key only.
- `DonnaProvider` loads on mount, writes through the store, and shows
  loading, offline and "not signed in" states. Offline writes are refused with a
  visible error, not queued silently (queueing is later work).
- Sign-in page: email magic link or passkey, **public sign-up disabled**,
  single allow-listed owner account. Session lives in the SDK's browser storage.
- Fixed UTC+2 stays a labelled demo offset; Africa/Cairo is DON-04.

## 3. Acceptance test (the one you asked for)

1. Device A: sign in, open a due question, record an outcome with a next action.
2. Reload device A: the outcome is still there, one record, no new question.
3. Device B (a different browser profile or the phone): sign in as the same
   account. It shows the **same** outcome and next action, and no duplicate
   questions or tasks.
4. Replay the same write from B: still one outcome.

Evidence rules: steps run against a **real** database through **two separate
browser contexts** (separate storage), automated in Playwright, then repeated
by hand on the owner's actual iPhone and laptop. Fake-store unit tests are
useful but are labelled "contract tests", never "persistence evidence".
Synthetic data only until G6. Negative cases: signed-out read returns nothing;
user B (a second test account) cannot read user A's rows (RLS); second outcome
rejected; future-dated event rejected.

## 4. Required capability changes (all owner-approved, in writing)

| Change | Where | Why |
|---|---|---|
| Amend AGENTS.md invariant 8 and 7: allow network and env **only** in `src/lib/donna/remote/supabaseStore.ts`, and the SDK's auth session in browser storage; domain data is never cached in the browser | AGENTS.md, CLAUDE.md | invariant text names these as forbidden |
| `SafetyBoundary` per-file allowlist (one file, asserted not to grow; `process.env` limited to `NEXT_PUBLIC_*`; no other absolute URL) | `tests/SafetyBoundary.test.ts` | G2 says editing it without owner approval is an automatic failure |
| One new runtime dependency, exact-pinned: `@supabase/supabase-js` | `package.json`, boundary test | invariant 8 limits runtime deps |
| Decide OD-2 (repo visibility) and approve MOS-10 ADR (single-owner auth, RLS, no sign-up) | BACKLOG | MOS-10 depends on OD-2 |
| A hosted app URL so the phone can reach it: owner-approved deploy of a preview only (decide OD-4 `vercel.json`) | owner | acceptance step 3 on a phone needs HTTPS hosting |
| CI keeps `validate` hermetic: real-DB e2e is a **separate** manually-run or secrets-gated job, never required for `main` | `.github/` (always-owner) | no secrets in the default gate |
| A feature flag stays compile-time off by default for Donna sync until sign-in works | `src/lib/donna/index.ts` | rollback without data loss |

## 5. Costs (nothing purchased or provisioned; verify current pricing before signing up)

Figures are from memory and may be stale.

- Supabase **Free**: $0, but projects pause after about a week of inactivity and
  there are no managed backups. Fine for the synthetic acceptance test only.
- Supabase **Pro**: roughly $25 per month per organization. Needed before
  anything the owner depends on (backups, no pausing).
- Hosting (Vercel Hobby is free but restricted to non-commercial use; a sales
  tool likely needs Pro, roughly $20 per user per month) or an equivalent. A
  preview-only test can use the free tier.
- Magic-link email: the built-in sender is heavily rate-limited; a transactional
  email provider (free tier likely sufficient) or passkeys avoids it.
- Optional custom domain, roughly $10-15 per year. No other recurring cost.

Owner decisions: pick the region (data-residency and Egyptian data-protection
review before real data), and who owns the account and billing.

## 6. Delivery sequence

1. Owner approves DON-02, MOS-10, capability changes, and the free-tier test project.
2. **Owner** creates the Supabase project and gives the session its URL and anon
   key via the environment secrets mechanism (never the repo). Agents provision nothing.
3. PR A (docs, ADR 0001 auth, boundary amendment). PR B (store, migration SQL
   in the repo, provider wiring, contract tests). PR C (two-context e2e, runbook).
4. Owner runs the acceptance test on the phone and laptop, then decides on Pro,
   real data (G6), and DON-03/04.

## 7. Risks and unknowns

- A client-side-only engine validates writes; a modified client could write
  odd-but-allowed events. The database enforces the outcome uniqueness and
  ownership only. Acceptable for a single-owner tool; move validation into a
  database function if more users are added.
- No offline queue and no live push between devices: device B sees changes on
  reload or refetch, not instantly. Realtime is optional and not in the smallest slice.
- Hosting and Docker-daemon availability in the cloud sandbox are unverified.
- Real client data stays out until G6 and a private repo.
