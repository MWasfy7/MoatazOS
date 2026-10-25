/**
 * DON-02: evidence, through the Auth API, that the DATABASE allowlist trigger refuses an unlisted
 * address. Run only in the dedicated SYNTHETIC test project (docs/engineering/DON-02-SETUP.md §9).
 *
 *   DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes npm run test:donna-live-trigger
 *
 * "Sign-up returned some error" is not evidence: rate limits, network failures, email-delivery
 * problems and bad input all produce errors, and the SDK hides the body of HTTP 500 responses, so this test
 * calls the Auth endpoints over raw HTTP and reads the real response body. It therefore needs an allow-listed CONTROL
 * that succeeds under the same conditions, a database-class refusal for the unlisted address, and
 * proof that no account exists. INCONCLUSIVE fails the test; it never passes on weak evidence.
 * The cause is attributed to the trigger by finding DONNA_SIGNUP_NOT_ALLOWED in the Postgres logs
 * for the printed time. The SQL probe (supabase/tests/hosted_probe.sql) fires the trigger directly
 * and is required either way.
 */
import { expect, test } from "@playwright/test";
import { collectTriggerEvidence, createHttpAuth, decideTriggerEvidence } from "../helpers/donnaTriggerEvidence";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const url = process.env.NEXT_PUBLIC_DONNA_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY as string;

test("an allow-listed control succeeds and an unlisted address is refused by the database, under the same conditions", async () => {
  expect(
    process.env.DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED,
    "BLOCKED: set DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes only after turning dashboard sign-up ON and 'Confirm email' OFF in the synthetic test project (DON-02-SETUP.md section 9), and restore both afterwards",
  ).toBe("yes");
  const controlEmail = process.env.DONNA_LIVE_TRIGGER_CONTROL_EMAIL;
  const controlPassword = process.env.DONNA_LIVE_TRIGGER_CONTROL_PASSWORD;
  expect(
    Boolean(controlEmail && controlPassword),
    "BLOCKED: set DONNA_LIVE_TRIGGER_CONTROL_EMAIL and DONNA_LIVE_TRIGGER_CONTROL_PASSWORD: an address you allow-listed in the database that is NOT yet a user (DON-02-SETUP.md section 9)",
  ).toBe(true);

  const unlistedCreds = { email: `stranger-${RUN}@example.test`, password: `Xy-${RUN}-pw-9!` };
  // Control (an address that IS on the allowlist) and then the unlisted address, same client path, same conditions.
  const evidence = await collectTriggerEvidence(createHttpAuth(url, anonKey), { email: controlEmail as string, password: controlPassword as string }, unlistedCreds);
  const verdict = decideTriggerEvidence(evidence);
  const attemptedAt = evidence.unlistedAttemptedAt;

  const refusal = evidence.unlisted.signUpError;
  const observed = refusal ? `${refusal.status ?? "?"} ${refusal.code ?? "?"}: ${refusal.message ?? ""}` : "no error";
  test.info().annotations.push(
    { type: "verdict", description: `${verdict.verdict}: ${verdict.reason}` },
    { type: "unlisted sign-up attempted at (UTC)", description: attemptedAt },
    { type: "observed unlisted refusal", description: observed },
    { type: "next step", description: "Dashboard > Logs > Postgres logs: find DONNA_SIGNUP_NOT_ALLOWED near that time, then delete the control user and its allowlist row" },
  );
  console.log(`[trigger evidence] ${verdict.verdict}: ${verdict.reason}\n[trigger evidence] unlisted sign-up at ${attemptedAt}: ${observed}`);
  expect(verdict.verdict, verdict.reason).toBe("PASS");
});
