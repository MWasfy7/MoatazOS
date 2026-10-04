#!/usr/bin/env tsx

import { NLFRuntimeAdapter } from "../../tests/echo/nlf/adapter";
import { runFullNLFEvaluation } from "../../tests/echo/nlf/evaluator";
import { CANDIDATE_FIXTURES } from "../../tests/echo/nlf/fixtures/candidateFixtures";
import { ORIGINAL_NLF50_CASES } from "../../tests/echo/nlf/fixtures/originalNlf50";

function parseArgs() {
  const args = process.argv.slice(2);
  let sha = process.env.ECHO_SHA || "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad";
  let strictGateExit = false;

  for (const arg of args) {
    if (arg.startsWith("--sha=")) {
      sha = arg.split("=")[1]?.trim() || sha;
    } else if (arg === "--strict" || arg === "--gate") {
      strictGateExit = true;
    }
  }

  return { sha, strictGateExit };
}

function main() {
  const { sha, strictGateExit } = parseArgs();
  const adapter = new NLFRuntimeAdapter(sha);

  const report = runFullNLFEvaluation(
    CANDIDATE_FIXTURES,
    ORIGINAL_NLF50_CASES,
    adapter,
    sha,
    "632fd469aa4d8f12257f4fdcd163ab02e5e67d2f",
    strictGateExit,
  );

  console.log("=========================================================================");
  console.log("          W2-02 CANONICAL EVALUATION GATE v2 - ECHO RUNTIME             ");
  console.log("=========================================================================");
  console.log(`Target ECHO SHA           : ${report.targetEchoSha}`);
  console.log(`Base Commit SHA             : ${report.baseSha}`);
  console.log(`Canonical Fixture Version   : v2.0 (Candidate + Original Transcribed)`);
  console.log(`Harness Execution Status    : ${report.harnessExecutionSuccess ? "PASS [SUCCESS]" : "FAIL"}`);
  console.log(`Candidate Suite Acceptance  : ${report.candidateBenchmarkAccepted ? "ACCEPTED" : "REJECTED"}`);
  console.log(`Original Suite Acceptance   : ${report.originalBenchmarkAccepted ? "ACCEPTED" : "REJECTED (source defects / conflicts present)"}`);
  console.log(`Overall Benchmark Acceptance: ${report.overallAccepted ? "ACCEPTED" : "REJECTED / HOLD"}`);
  console.log(`Gate Exit Code Disclosed    : ${report.gateExitCode} (Strict Mode: ${strictGateExit ? "ENABLED" : "DISABLED"})`);
  console.log("=========================================================================\n");

  console.log("-------------------------------------------------------------------------");
  console.log(" 1. FIXTURE STATUS BREAKDOWN");
  console.log("-------------------------------------------------------------------------");
  for (const [status, count] of Object.entries(report.countsByStatus)) {
    console.log(`  - ${status.padEnd(28)} : ${count}`);
  }

  console.log("\n-------------------------------------------------------------------------");
  console.log(" 2. EVALUATION SET SCORES (Candidate & Adversarial Suites)");
  console.log("-------------------------------------------------------------------------");
  console.log(`  Set A: SEMANTIC GOLD SET    : ${report.goldSetScores.passedCases}/${report.goldSetScores.totalCases} passed (${report.goldSetScores.passRate.toFixed(1)}%) | S4/S5 Failures: ${report.goldSetScores.s4s5Failures}`);
  console.log(`  Set B: SAFETY / BOUNDARY SET : ${report.safetySetScores.passedCases}/${report.safetySetScores.totalCases} passed (${report.safetySetScores.passRate.toFixed(1)}%) | S4/S5 Failures: ${report.safetySetScores.s4s5Failures}`);
  console.log(`  Set C: ADVERSARIAL MENA SET : ${report.adversarialSetScores.passedCases}/${report.adversarialSetScores.totalCases} passed (${report.adversarialSetScores.passRate.toFixed(1)}%) | S4/S5 Failures: ${report.adversarialSetScores.s4s5Failures}`);

  console.log("\n-------------------------------------------------------------------------");
  console.log(" 3. CANDIDATE & ADVERSARIAL SUITE SCORECARD (55 cases)");
  console.log("-------------------------------------------------------------------------");
  for (const caseRes of report.candidateCases) {
    const statusSymbol = caseRes.passed ? "[PASS]" : "[FAIL]";
    console.log(`${statusSymbol} ${caseRes.caseId}: ${caseRes.caseTitle} (${caseRes.category}) [Status: ${caseRes.fixtureStatus} | Severity: ${caseRes.severity}]`);
    for (const turn of caseRes.turns) {
      const turnSymbol = turn.passed ? "  └─ Turn" : "  └─ [FAIL] Turn";
      const dims = turn.dimensions;
      const dimSummary = [
        `Intent: ${dims.intentUnderstanding.passed ? "OK" : "FAIL"}`,
        `Cap: ${dims.capabilityAvailability.passed ? "OK" : "FAIL"}`,
        `Context: ${dims.contextAndReferentResolution.passed ? "OK" : "FAIL"}`,
        `Focus: ${dims.focusPreservation.passed ? "OK" : "FAIL"}`,
        `Clarify: ${dims.clarificationAppropriateness.passed ? "OK" : "FAIL"}`,
        `Honesty: ${dims.capabilityExecutionHonesty.passed ? "OK" : "FAIL"}`,
        `Behavior: ${dims.conversationalBehavior.passed ? "OK" : "FAIL"}`,
      ].join(" | ");
      console.log(`${turnSymbol} ${turn.turnIndex + 1}: "${turn.input}" -> ${dimSummary}`);
    }
  }

  console.log("\nCANDIDATE SUITE DIMENSION SCORES:");
  console.log(`  - 1. Intent Understanding        : ${report.candidateAggregate.dimensionPassCounts.intentUnderstanding}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.intentUnderstanding.toFixed(1)}%)`);
  console.log(`  - 2. Capability Availability      : ${report.candidateAggregate.dimensionPassCounts.capabilityAvailability}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.capabilityAvailability.toFixed(1)}%)`);
  console.log(`  - 3. Context & Referent Res.     : ${report.candidateAggregate.dimensionPassCounts.contextAndReferentResolution}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.contextAndReferentResolution.toFixed(1)}%)`);
  console.log(`  - 4. Focus Preservation           : ${report.candidateAggregate.dimensionPassCounts.focusPreservation}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.focusPreservation.toFixed(1)}%)`);
  console.log(`  - 5. Clarification Appropriateness: ${report.candidateAggregate.dimensionPassCounts.clarificationAppropriateness}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.clarificationAppropriateness.toFixed(1)}%)`);
  console.log(`  - 6. Capability/Execution Honesty: ${report.candidateAggregate.dimensionPassCounts.capabilityExecutionHonesty}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.capabilityExecutionHonesty.toFixed(1)}%)`);
  console.log(`  - 7. Conversational Behavior     : ${report.candidateAggregate.dimensionPassCounts.conversationalBehavior}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.conversationalBehavior.toFixed(1)}%)`);

  console.log("\n-------------------------------------------------------------------------");
  console.log(" 4. ORIGINAL NLF-50 BENCHMARK SUITE SCORECARD (50 cases)");
  console.log("-------------------------------------------------------------------------");
  for (const origRes of report.originalCases) {
    const statusSymbol = origRes.passed ? "[PASS]" : "[FAIL]";
    console.log(`${statusSymbol} ${origRes.caseId}: "${origRes.input}" (${origRes.sourceExpectedIntent} -> ${origRes.mappedRuntimeIntent}) [Status: ${origRes.fixtureStatus}]`);
  }

  console.log("\nORIGINAL NLF-50 AGGREGATE METRICS:");
  console.log(`  Cases Passed                  : ${report.originalAggregate.passedCases}/${report.originalAggregate.totalCases} (${((report.originalAggregate.passedCases / report.originalAggregate.totalCases) * 100).toFixed(1)}%)`);
  console.log(`  Source Defects / Conflicts    : ${report.originalAggregate.sourceConflictsCount}`);

  if (report.originalAggregate.sourceConflictsCount > 0) {
    console.log("\n-------------------------------------------------------------------------");
    console.log(" 5. SOURCE DEFECTS AND CONFLICTS LEDGER (13 Documented Entries)");
    console.log("-------------------------------------------------------------------------");
    for (const item of report.originalAggregate.sourceConflicts) {
      console.log(`  - ${item.caseId}: ${item.conflict}`);
    }
  }

  if (report.failedCaseDetails.length > 0) {
    console.log("\n=========================================================================");
    console.log("                     REPRODUCIBLE FAILURE DETAILS                       ");
    console.log("=========================================================================");
    for (const fail of report.failedCaseDetails) {
      console.log(`\nFailure in [${fail.suite.toUpperCase()}] Case: ${fail.caseId} ("${fail.title}")`);
      console.log(`  Severity      : ${fail.severity}`);
      console.log(`  Turn Index    : ${fail.failingTurnIndex + 1}`);
      console.log(`  Turn Input    : "${fail.turnInput}"`);
      console.log(`  Failing Dims  : ${fail.failingDimensions.join(", ")}`);
      console.log("  Details       :");
      for (const d of fail.turnDetails) {
        console.log(`    - ${d}`);
      }
    }
    console.log("=========================================================================");
  }

  process.exit(report.gateExitCode);
}

main();
