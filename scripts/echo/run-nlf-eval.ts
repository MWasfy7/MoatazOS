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
  console.log("            NLF EVALUATION HARNESS - ECHO RUNTIME SCORECARD             ");
  console.log("=========================================================================");
  console.log(`Selected ECHO SHA           : ${report.targetEchoSha}`);
  console.log(`Base Commit SHA             : ${report.baseSha}`);
  console.log(`Harness Execution Status    : ${report.harnessExecutionSuccess ? "PASS [SUCCESS]" : "FAIL"}`);
  console.log(`Candidate Suite Acceptance  : ${report.candidateBenchmarkAccepted ? "ACCEPTED" : "REJECTED (4 failures retained)"}`);
  console.log(`Original Suite Acceptance   : ${report.originalBenchmarkAccepted ? "ACCEPTED" : "REJECTED (failing/unresolved cases)"}`);
  console.log(`Overall Benchmark Acceptance: ${report.overallAccepted ? "ACCEPTED" : "REJECTED"}`);
  console.log(`Disclosed Gate Exit Code    : ${report.gateExitCode} (Strict mode: ${strictGateExit ? "ENABLED" : "DISABLED"})`);
  console.log("=========================================================================\n");

  console.log("-------------------------------------------------------------------------");
  console.log(" 1. CANDIDATE FIXTURE SUITE RESULTS (50 candidate cases, 80 turns)");
  console.log("-------------------------------------------------------------------------");
  for (const caseRes of report.candidateCases) {
    const statusSymbol = caseRes.passed ? "[PASS]" : "[FAIL]";
    console.log(`${statusSymbol} ${caseRes.caseId}: ${caseRes.caseTitle} (${caseRes.category})`);
    for (const turn of caseRes.turns) {
      const turnSymbol = turn.passed ? "  └─ Turn" : "  └─ [FAIL] Turn";
      const dims = turn.dimensions;
      const dimSummary = [
        `Intent: ${dims.intentUnderstanding.passed ? "OK" : "FAIL"}`,
        `Context: ${dims.contextAndReferentResolution.passed ? "OK" : "FAIL"}`,
        `Clarify: ${dims.clarificationAppropriateness.passed ? "OK" : "FAIL"}`,
        `Honesty: ${dims.capabilityExecutionHonesty.passed ? "OK" : "FAIL"}`,
        `Behavior: ${dims.conversationalBehavior.passed ? "OK" : "FAIL"}`,
      ].join(" | ");
      console.log(`${turnSymbol} ${turn.turnIndex + 1}: "${turn.input}" -> ${dimSummary}`);
    }
  }

  console.log("\nCANDIDATE AGGREGATE METRICS:");
  console.log(`  Cases Passed                  : ${report.candidateAggregate.passedCases}/${report.candidateAggregate.totalCases} (${((report.candidateAggregate.passedCases / report.candidateAggregate.totalCases) * 100).toFixed(1)}%)`);
  console.log(`  Turns Passed                  : ${report.candidateAggregate.passedTurns}/${report.candidateAggregate.totalTurns} (${((report.candidateAggregate.passedTurns / report.candidateAggregate.totalTurns) * 100).toFixed(1)}%)`);
  console.log(`  - Intent Understanding        : ${report.candidateAggregate.dimensionPassCounts.intentUnderstanding}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.intentUnderstanding.toFixed(1)}%)`);
  console.log(`  - Context & Referent Res.     : ${report.candidateAggregate.dimensionPassCounts.contextAndReferentResolution}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.contextAndReferentResolution.toFixed(1)}%)`);
  console.log(`  - Clarification Appropriateness: ${report.candidateAggregate.dimensionPassCounts.clarificationAppropriateness}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.clarificationAppropriateness.toFixed(1)}%)`);
  console.log(`  - Capability/Execution Honesty: ${report.candidateAggregate.dimensionPassCounts.capabilityExecutionHonesty}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.capabilityExecutionHonesty.toFixed(1)}%)`);
  console.log(`  - Conversational Behavior     : ${report.candidateAggregate.dimensionPassCounts.conversationalBehavior}/${report.candidateAggregate.totalTurns} (${report.candidateAggregate.dimensionPassRates.conversationalBehavior.toFixed(1)}%)`);

  console.log("\n-------------------------------------------------------------------------");
  console.log(" 2. ORIGINAL NLF-50 BENCHMARK SUITE RESULTS (50 original cases)");
  console.log("-------------------------------------------------------------------------");
  for (const origRes of report.originalCases) {
    const statusSymbol = origRes.passed ? "[PASS]" : "[FAIL]";
    const conflictTag = origRes.sourceConflict ? " [SOURCE CONFLICT]" : "";
    console.log(`${statusSymbol} ${origRes.caseId}: "${origRes.input}" (${origRes.sourceExpectedIntent} -> ${origRes.mappedRuntimeIntent})${conflictTag}`);
  }

  console.log("\nORIGINAL NLF-50 AGGREGATE METRICS:");
  console.log(`  Cases Passed                  : ${report.originalAggregate.passedCases}/${report.originalAggregate.totalCases} (${((report.originalAggregate.passedCases / report.originalAggregate.totalCases) * 100).toFixed(1)}%)`);
  console.log(`  Source Defects/Conflicts      : ${report.originalAggregate.sourceConflictsCount}`);
  console.log(`  - Intent Understanding        : ${report.originalAggregate.dimensionPassCounts.intentUnderstanding}/${report.originalAggregate.totalCases} (${report.originalAggregate.dimensionPassRates.intentUnderstanding.toFixed(1)}%)`);
  console.log(`  - Context & Referent Res.     : ${report.originalAggregate.dimensionPassCounts.contextAndReferentResolution}/${report.originalAggregate.totalCases} (${report.originalAggregate.dimensionPassRates.contextAndReferentResolution.toFixed(1)}%)`);
  console.log(`  - Clarification Appropriateness: ${report.originalAggregate.dimensionPassCounts.clarificationAppropriateness}/${report.originalAggregate.totalCases} (${report.originalAggregate.dimensionPassRates.clarificationAppropriateness.toFixed(1)}%)`);
  console.log(`  - Capability/Execution Honesty: ${report.originalAggregate.dimensionPassCounts.capabilityExecutionHonesty}/${report.originalAggregate.totalCases} (${report.originalAggregate.dimensionPassRates.capabilityExecutionHonesty.toFixed(1)}%)`);
  console.log(`  - Conversational Behavior     : ${report.originalAggregate.dimensionPassCounts.conversationalBehavior}/${report.originalAggregate.totalCases} (${report.originalAggregate.dimensionPassRates.conversationalBehavior.toFixed(1)}%)`);

  if (report.originalAggregate.sourceConflictsCount > 0) {
    console.log("\n-------------------------------------------------------------------------");
    console.log(" 3. SOURCE DEFECTS AND CONFLICTS DISCLOSURE");
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
