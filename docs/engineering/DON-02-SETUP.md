# DON-02 setup checklist (owner steps, one time)

Nothing here is provisioned by an agent. Do these steps yourself; no step needs
a secret pasted into chat. Use a **throwaway test project** first: the event
history is append-only on purpose, so a test project is wiped by deleting it.

Plan: Supabase **Free** is enough for this synthetic test (it pauses after about
a week of inactivity and has no managed backups; verify current terms). Do not
upgrade, deploy, or add a domain without a separate decision.

## 1. Account and project
1. **Account:** a Supabase account in your own name (supabase.com), one organisation.
2. **New project** named `moataz-donna-test`. It must be dedicated to Donna: the
   sign-up guard in the migration applies to every user of the project.
   - **Region:** the closest offered to Egypt (for example an EU region). Real
     client data is not allowed yet, so residency is a later review.
   - **Database password:** generate it in your password manager. Never share it.

## 2. Authentication settings (Dashboard → Authentication)
Supported login flow: **email and password only** (accounts created by you in the
dashboard). Not supported or configured: sign-up, magic link, one-time codes,
passkeys, OAuth, phone, anonymous sign-in, password reset by email (you reset
passwords in the dashboard).
1. Sign In / Providers → **Email**: enabled. **Turn OFF "Allow new users to sign up".**
2. Turn OFF **anonymous sign-ins**. Leave every other provider disabled.
3. Password policy: minimum length **12**.
4. The database enforces the allowlist even if a setting is wrong (step 3 below).

## 3. Apply the SQL (Dashboard → SQL Editor), in this order
1. Paste the whole file `supabase/migrations/20261025000000_donna_durable_records.sql` and run it once.
   If the run stops with an error about creating a trigger on `auth.users` (for example
   "must be owner of relation users"), **stop and report the exact message**. Do not skip
   that statement: the dashboard sign-up switch alone is not enough. (This one statement
   is the part of the migration I could not test on a real Supabase project.)
2. **Run the probe** (Dashboard → SQL Editor → paste `supabase/tests/hosted_probe.sql` → run). Every row must say `PASS`
   and the last row `OVERALL PASS`. `FAIL` means a protection is missing: stop and send me the table (it contains no secrets).
   `INCONCLUSIVE` means the probe could not run a check and is **not** a pass: send me the detail column. The probe
   exercises the allowlist trigger and the privilege model directly in the database (all its test rows are rolled back),
   independently of the dashboard sign-up switch. It is also what I run locally against a throwaway Postgres.
3. **Before creating any user**, allow-list the addresses (replace the placeholders; these stay in the database, never in the repository):
   ```sql
   insert into public.donna_allowed_emails (email)
   values (lower('YOUR-OWNER-EMAIL'));
   -- test project only: a second account for the "different account" check
   insert into public.donna_allowed_emails (email)
   values (lower('YOUR-SECOND-TEST-EMAIL'));
   ```

## 4. Create the users (Dashboard → Authentication → Users → Add user → Create new user)
Tick **Auto Confirm User**. Create account **A** (your owner email) and, in the test
project only, account **B** (the second test email). Save both passwords in your
password manager. A creation attempt for any address not in step 3 is refused by the database.

## 5. Get the two public values (Dashboard → Project Settings → API)
- **Project URL**
- **anon / publishable key**
- **Never use or copy the `service_role` or secret key.** The app refuses to start
  sync if one is supplied.

## 6. Enter the values (never in chat, never committed)
Variable names (exact):

| Name | Value | Needed by |
|---|---|---|
| `NEXT_PUBLIC_DONNA_SYNC` | `on` | the app (anything else keeps sync OFF) |
| `NEXT_PUBLIC_DONNA_SUPABASE_URL` | the Project URL | the app and the harness |
| `NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY` | the anon/publishable key | the app and the harness |
| `DONNA_LIVE_USER_A_EMAIL` / `DONNA_LIVE_USER_A_PASSWORD` | account A | the harness only |
| `DONNA_LIVE_USER_B_EMAIL` / `DONNA_LIVE_USER_B_PASSWORD` | account B | the harness only |
| `DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED` (`yes`), `DONNA_LIVE_TRIGGER_CONTROL_EMAIL`, `DONNA_LIVE_TRIGGER_CONTROL_PASSWORD` | section 9, phase 1 only | `npm run test:donna-live-trigger` only |
| `DONNA_LIVE_TRIGGER_LOG_FILE` | path to the exported Postgres log lines (section 9, phase 2) | `npm run test:donna-verify-trigger` only |

Where:
- **Claude Code cloud session:** the cloud environment menu in the session title bar → **Edit** →
  add each name as an **environment variable** (API-credential/"Network secrets" sections are for API tokens; these are plain variables).
  Also under **Network access**, allow the host of your Project URL (`<project-ref>.supabase.co`).
  A new session picks the values up.
- **Your own computer:** a file `.env.local` (the app) and `.env.donna-live.local` (the harness) in the repository root.
  Both match the existing `.env*.local` ignore rule, so they cannot be committed.
- **Hosted app (later, not authorised yet):** the same three `NEXT_PUBLIC_DONNA_*` names in the host's environment settings.

## 7. Run the acceptance
Node: the live harness needs **Node 22+** (the Supabase client builds a realtime client that needs a global `WebSocket`);
on Node 20 set `NODE_OPTIONS=--experimental-websocket`. The harness stops with a clear message if neither holds.
(The offline suite, including CI, runs on Node 20 and never constructs that client.)
```bash
npm ci
set -a; . ./.env.donna-live.local; set +a      # or use the cloud environment variables
npm run test:donna-live
```
It signs in as A in one browser context, records an outcome, reloads, opens a **second**
browser context (separate storage), and requires the same record there; it then checks
retry and conflict writes, that account B sees nothing of A's records, that a signed-out
client is refused, and that the server refuses sign-up. It exits non-zero and lists the
missing variable names if any are absent. Synthetic `live-*` rows remain by design.

Manual phone check (after a hosted URL exists, which needs a separate deployment decision):
sign in as A on the laptop and record an outcome; sign in as A on the phone and confirm
the same record, and no second question for that call.

## 8. Retry and recovery behaviour you can try by hand
- A save keeps its request id **and its exact content** until it succeeds or you edit it. If the network drops
  mid-save, press Save again: the database answers "duplicate" and you still get one record.
- If the database confirms a save but the screen cannot reload, Donna says so ("confirmed and stored, but the screen
  could not reload"), keeps the form open and offers **Reload from database**; nothing is saved twice.
- Signing out or switching account discards anything still loading for the previous account.

## 9. Prove the allowlist trigger itself (test project only)
The SQL probe in step 3.2 is the required proof: it fires the trigger directly. Through the Auth API, a refused
sign-up is **not** proof of the cause: a generic 500 / `unexpected_failure` / "Internal server error", a rate limit,
a network fault and an email problem all look like a refusal, and so would any server fault. Two kinds of evidence are
therefore kept apart, and only the second can attribute the cause:
- **API observations** (phase 1): an allow-listed control succeeds under the same conditions, the unlisted address is
  refused with a server-side error, and no account exists for it.
- **Verified log attribution** (phase 2): a Postgres log line naming `DONNA_SIGNUP_NOT_ALLOWED` inside the attempt window.

Consistent API observations without verified attribution are **INCONCLUSIVE**, and INCONCLUSIVE fails.

**Phase 1: record the API observations**
1. In the **synthetic test project only** (never one that will hold real data): Authentication → Sign In / Providers →
   turn **ON** "Allow new users to sign up" and turn **OFF** "Confirm email".
2. SQL Editor: allow-list a control address that is **not yet a user** (a throwaway address you control the password for):
   `insert into public.donna_allowed_emails (email) values (lower('CONTROL-EMAIL'));`
3. Set `DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes`, `DONNA_LIVE_TRIGGER_CONTROL_EMAIL`, `DONNA_LIVE_TRIGGER_CONTROL_PASSWORD`
   (same places as section 6) and run `npm run test:donna-live-trigger`. **It is expected to end INCONCLUSIVE ("cause is not
   attributed") and exit non-zero even when everything worked**; it fails outright if the control cannot be created, a rate
   limit / network / email / input error occurs, the sign-up switch is still OFF, or the unlisted address got in. It writes
   `.donna-live/trigger-evidence.json` (ignored by git) and prints the time of the unlisted attempt.

**Phase 2: attribute the cause from the logs**
4. Dashboard → Logs → Postgres logs: show the lines around the printed time (include the `DONNA_SIGNUP_NOT_ALLOWED` entry),
   export or copy them into a text file. The real export format is unobserved: ISO timestamps and epoch timestamps are both read.
5. Run `DONNA_LIVE_TRIGGER_LOG_FILE=path/to/log.txt npm run test:donna-verify-trigger` (no network, no credentials). It passes only if the phase-1
   observations are consistent **and** one single log line names `DONNA_SIGNUP_NOT_ALLOWED` with a readable timestamp from 60 s
   before to 120 s after the attempt. A missing file, no marker, a marker outside the window, or a marker line with no readable
   timestamp is INCONCLUSIVE. The output reports "API observation" and "log attribution" separately.
6. Clean up: delete the control user (Authentication → Users), `delete from public.donna_allowed_emails where email = lower('CONTROL-EMAIL');`,
   then turn sign-up **OFF** and "Confirm email" back to your intended value.
If the unlisted sign-up ever succeeds the test FAILS and an unlisted account exists: delete it and stop.
I have not seen the real responses or the real log format; send me the printed lines (they contain no secrets).

## 10. What can only be validated on a real Supabase project
Nothing below has been run; each is covered by the step named, and a failure of any of them is a finding, not a pass.
| Item | Why it cannot be proven locally | Covered by |
|---|---|---|
| Creating a trigger on `auth.users` is permitted for the SQL Editor role | the local stub has no platform restrictions | step 3.1 (migration error), step 3.2 probe |
| Inserting minimal rows into `auth.users` works for the probe (no other required columns or platform triggers get in the way) | local `auth.users` is a two-column stub | step 3.2 probe (an `INCONCLUSIVE` row tells me) |
| Platform default grants on new tables and functions are fully removed by the revokes | defaults differ locally | probe privilege rows |
| PostgREST calls: argument name `p_event`/`p_call`, the `{status}` JSON reply, and that `DONNA_*` messages reach the browser | no PostgREST locally | `npm run test:donna-live` (database contract scenarios) |
| Row-level security under a real JWT (`auth.uid()` from a signed token) | local claims are simulated | `npm run test:donna-live` ("a different account", "signed-out client") |
| Password sign-in, session persistence across reload, token refresh, and the session in a second browser context | real Auth service and browser storage | `npm run test:donna-live` (UI test) and the phone check |
| Dashboard setting names and defaults (sign-up, anonymous, password length) match what I describe | labels change | your walk through section 2; tell me any difference |
| Sign-up refusal by the trigger through the Auth API (API observations, phase 1) and the Postgres-log attribution (phase 2). The real response body for a refusal (I expect a 500, possibly "Database error saving new user", possibly a generic message; either way it is not attributable on its own; the pinned SDK hides 500 bodies, so phase 1 reads raw HTTP) and the real log export format | needs the platform's Auth service and logs | section 9 |
| The cloud environment's network policy lets the session reach `<project-ref>.supabase.co` | policy is yours | any live run (an unreachable host shows as OFFLINE) |
| Free-plan behaviour (pausing, limits) | commercial terms | not testable; verify at sign-up |

## 11. Rollback
Set `NEXT_PUBLIC_DONNA_SYNC` to anything other than `on` (or remove it): the app returns
to the memory-only demo and never contacts the database. History is not deleted.

## What this does NOT cover (each needs its own approval)
Paid plan or backups, deployment, custom email/SMTP, passkeys or MFA, real client data
(requires the G6 trial-readiness gate and a private repository decision), voice, and
closed-app notifications.
