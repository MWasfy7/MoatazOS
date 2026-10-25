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

Where:
- **Claude Code cloud session:** the cloud environment menu in the session title bar → **Edit** →
  add each name as an **environment variable** (API-credential/"Network secrets" sections are for API tokens; these are plain variables).
  Also under **Network access**, allow the host of your Project URL (`<project-ref>.supabase.co`).
  A new session picks the values up.
- **Your own computer:** a file `.env.local` (the app) and `.env.donna-live.local` (the harness) in the repository root.
  Both match the existing `.env*.local` ignore rule, so they cannot be committed.
- **Hosted app (later, not authorised yet):** the same three `NEXT_PUBLIC_DONNA_*` names in the host's environment settings.

## 7. Run the acceptance
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
The SQL probe in step 3.2 is the required proof: it fires the trigger directly. The dashboard sign-up switch alone
proves nothing about the trigger (with the switch OFF the platform refuses first). To also see the trigger refuse a
real Auth API sign-up:
1. In the **synthetic test project only** (never one that will hold real data): Authentication → Sign In / Providers →
   turn **ON** "Allow new users to sign up".
2. Run `DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes npm run test:donna-live-trigger`. It tries to sign up an unlisted
   address and requires the refusal to be something other than the platform's own `signup_disabled`, and that no account exists afterwards.
3. Turn the switch **OFF** again right away.
If the switch is still OFF the test fails on purpose ("proves nothing about the trigger").
I expect a database error such as "Database error saving new user", but I have not seen the real response: report the
status, code and message the test prints.

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
| Sign-up refusal by the trigger through the Auth API | needs the platform's Auth service | section 9 |
| The cloud environment's network policy lets the session reach `<project-ref>.supabase.co` | policy is yours | any live run (an unreachable host shows as OFFLINE) |
| Free-plan behaviour (pausing, limits) | commercial terms | not testable; verify at sign-up |

## 11. Rollback
Set `NEXT_PUBLIC_DONNA_SYNC` to anything other than `on` (or remove it): the app returns
to the memory-only demo and never contacts the database. History is not deleted.

## What this does NOT cover (each needs its own approval)
Paid plan or backups, deployment, custom email/SMTP, passkeys or MFA, real client data
(requires the G6 trial-readiness gate and a private repository decision), voice, and
closed-app notifications.
