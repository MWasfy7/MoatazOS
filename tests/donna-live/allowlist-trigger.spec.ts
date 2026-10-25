/**
 * DON-02, phase 1 of 2: record API observations about the allowlist trigger. Run only in the dedicated
 * SYNTHETIC test project (docs/engineering/DON-02-SETUP.md §9).
 *
 *   DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes npm run test:donna-live-trigger
 *
 * This phase CANNOT pass. An API response never shows WHY an unlisted address was refused: a generic 500 /
 * unexpected_failure / "Internal server error", a rate limit, a network fault or an email problem all look
 * like a refusal, and so would any server fault. Phase 1 therefore records what the API did (an allow-listed
 * control signs up and signs in; the unlisted address gets a server-side refusal and no account) and ends
 * INCONCLUSIVE ("attribution pending") unless it already finds a FAIL. It writes `.donna-live/trigger-evidence.json`.
 *
 * Phase 2 (`npm run test:donna-verify-trigger`) checks an exported Postgres log excerpt for
 * DONNA_SIGNUP_NOT_ALLOWED inside the attempt window. Only that can attribute the refusal to the trigger.
 * The calls use raw HTTP because the pinned SDK discards the body of HTTP 5xx responses.
 * The SQL probe (supabase/tests/hosted_probe.sql) fires the trigger directly and is required either way.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { collectTriggerEvidence, createHttpAuth, decideTriggerEvidence } from "../helpers/donnaTriggerEvidence";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const url = process.env.NEXT_PUBLIC_DONNA_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY as string;
export const EVIDENCE_FILE = path.resolve(process.cwd(), ".donna-live", "trigger-evidence.json");

test("API observations: an allow-listed control succeeds and an unlisted address is refused (attribution is checked in phase 2)", async () => {
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
  const evidence = await collectTriggerEvidence(createHttpAuth(url, anonKey), { email: controlEmail as string, password: controlPassword as string }, unlistedCreds);
  // No attribution is available in this phase, by design.
  const verdict = decideTriggerEvidence(evidence);

  fs.mkdirSync(path.dirname(EVIDENCE_FILE), { recursive: true });
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify({ recordedAt: new Date().toISOString(), apiVerdict: verdict.api, evidence }, null, 2));

  const refusal = evidence.unlisted.signUpError;
  const observed = refusal ? `${refusal.status ?? "?"} ${refusal.code ?? "?"}: ${refusal.message ?? ""}` : "no error";
  test.info().annotations.push(
    { type: "API observation", description: `${verdict.api.observation}: ${verdict.api.reason}` },
    { type: "unlisted sign-up attempted at (UTC)", description: evidence.unlistedAttemptedAt },
    { type: "observed unlisted refusal", description: observed },
    { type: "next step", description: "Dashboard > Logs > Postgres logs: export the lines around that time, save them to a file, then run `DONNA_LIVE_TRIGGER_LOG_FILE=<file> npm run test:donna-verify-trigger`; then delete the control user and its allowlist row" },
  );
  console.log(`[trigger evidence, phase 1] API observation ${verdict.api.observation}: ${verdict.api.reason}\n[trigger evidence, phase 1] unlisted sign-up at ${evidence.unlistedAttemptedAt}: ${observed}\n[trigger evidence, phase 1] evidence written to ${EVIDENCE_FILE}`);

  // PASS is impossible here: a refusal is not attributed until phase 2 verifies the log. INCONCLUSIVE fails, by design.
  expect(verdict.verdict, `${verdict.reason}`).toBe("PASS");
});
