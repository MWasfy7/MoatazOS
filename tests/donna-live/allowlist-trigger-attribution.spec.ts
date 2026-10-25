/**
 * DON-02, phase 2 of 2: attribute the phase-1 refusal to the trigger by checking an exported Postgres log
 * excerpt. Needs no network and no credentials.
 *
 *   DONNA_LIVE_TRIGGER_LOG_FILE=<exported log lines> npm run test:donna-verify-trigger
 *
 * PASS requires BOTH the phase-1 API observations to be consistent AND a single log line naming
 * DONNA_SIGNUP_NOT_ALLOWED with a readable timestamp inside the attempt window (60 s before to 120 s after).
 * A missing, empty or non-matching excerpt is INCONCLUSIVE and fails. API observations and log attribution
 * are reported separately.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { decideTriggerEvidence, verifyLogAttribution, type TriggerEvidenceInput } from "../helpers/donnaTriggerEvidence";

const EVIDENCE_FILE = path.resolve(process.cwd(), ".donna-live", "trigger-evidence.json");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

test("the logged cause of the phase-1 refusal is DONNA_SIGNUP_NOT_ALLOWED", async () => {
  expect(fs.existsSync(EVIDENCE_FILE), `BLOCKED: no phase-1 evidence at ${EVIDENCE_FILE}; run npm run test:donna-live-trigger first (DON-02-SETUP.md section 9)`).toBe(true);
  const recorded = JSON.parse(fs.readFileSync(EVIDENCE_FILE, "utf8")) as { recordedAt: string; evidence: TriggerEvidenceInput & { unlistedAttemptedAt: string } };
  const age = Date.now() - Date.parse(recorded.recordedAt);
  expect(age >= 0 && age < MAX_AGE_MS, `the phase-1 evidence is stale (recorded ${recorded.recordedAt}); run phase 1 again`).toBe(true);

  const logFile = process.env.DONNA_LIVE_TRIGGER_LOG_FILE;
  expect(Boolean(logFile && fs.existsSync(logFile)), "BLOCKED: set DONNA_LIVE_TRIGGER_LOG_FILE to a file holding the exported Postgres log lines (DON-02-SETUP.md section 9)").toBe(true);
  const attribution = verifyLogAttribution(fs.readFileSync(logFile as string, "utf8"), recorded.evidence.unlistedAttemptedAt);
  const verdict = decideTriggerEvidence(recorded.evidence, attribution);

  test.info().annotations.push(
    { type: "API observation", description: `${verdict.api.observation}: ${verdict.api.reason}` },
    { type: "log attribution", description: attribution.status === "VERIFIED" ? `VERIFIED at ${attribution.at}: ${attribution.matchedLine}` : attribution.status === "REJECTED" ? `REJECTED: ${attribution.reason}` : "NOT_SUPPLIED" },
  );
  console.log(`[trigger evidence, phase 2] API observation: ${verdict.api.observation}\n[trigger evidence, phase 2] log attribution: ${attribution.status}\n[trigger evidence, phase 2] verdict ${verdict.verdict}: ${verdict.reason}`);
  expect(verdict.verdict, verdict.reason).toBe("PASS");
});
