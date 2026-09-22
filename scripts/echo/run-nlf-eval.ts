#!/usr/bin/env tsx

import { NLFRuntimeAdapter } from "../../tests/echo/nlf/adapter";
import { runFullNLFEvaluation } from "../../tests/echo/nlf/evaluator";
import { CANDIDATE_FIXTURES } from "../../tests/echo/nlf/fixtures/candidateFixtures";

function main() {
  const adapter = new NLFRuntimeAdapter();
  const report = runFullNLFEvaluation(
    CANDIDATE_FIXTURES,
    adapter,
    "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad",
    "632fd469aa4d8f12257f4fdcd163ab02e5e67d2f",
  );

  console.log("=========================================================================");
  console.log("            NLF EVALUATION HARNESS - ECHO RUNTIME SCORECARD             ");
  console.log("=========================================================================");
  console.log(`Target ECHO SHA : ${report.targetEchoSha}`);
  console.log(`Base Commit SHA : ${report.baseSha}`);
  console.log(`Dependency      : MISSING ORIGINAL NLF-50 BENCHMARK SPECIFICATION/DATASET`);
  console.log(`Fixture Label   : ALL TEST CASES ARE CANDIDATE FIXTURES (candidate_fixture)`);
  console.log("=========================================================================\n");

  console.log("--- PER-CASE EVALUATION RESULTS ---");
  for (const caseRes of report.cases) {
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

  console.log("\n=========================================================================");
  console.log("                     AGGREGATE EVALUATION METRICS                       ");
  console.log("=========================================================================");
  console.log(`Total Candidate Fixture Cases : ${report.aggregate.totalCases}`);
  console.log(`Passed Cases                  : ${report.aggregate.passedCases} (${((report.aggregate.passedCases / report.aggregate.totalCases) * 100).toFixed(1)}%)`);
  console.log(`Failed Cases                  : ${report.aggregate.failedCases}`);
  console.log(`Total Evaluated Turns         : ${report.aggregate.totalTurns}`);
  console.log(`Passed Turns                  : ${report.aggregate.passedTurns} (${((report.aggregate.passedTurns / report.aggregate.totalTurns) * 100).toFixed(1)}%)`);
  console.log("-------------------------------------------------------------------------");
  console.log("DIMENSION SCORES:");
  console.log(` 1. Intent Understanding         : ${report.aggregate.dimensionPassCounts.intentUnderstanding}/${report.aggregate.totalTurns} (${report.aggregate.dimensionPassRates.intentUnderstanding.toFixed(1)}%)`);
  console.log(` 2. Context & Referent Resolution: ${report.aggregate.dimensionPassCounts.contextAndReferentResolution}/${report.aggregate.totalTurns} (${report.aggregate.dimensionPassRates.contextAndReferentResolution.toFixed(1)}%)`);
  console.log(` 3. Clarification Appropriateness: ${report.aggregate.dimensionPassCounts.clarificationAppropriateness}/${report.aggregate.totalTurns} (${report.aggregate.dimensionPassRates.clarificationAppropriateness.toFixed(1)}%)`);
  console.log(` 4. Capability/Execution Honesty : ${report.aggregate.dimensionPassCounts.capabilityExecutionHonesty}/${report.aggregate.totalTurns} (${report.aggregate.dimensionPassRates.capabilityExecutionHonesty.toFixed(1)}%)`);
  console.log(` 5. Conversational Behavior      : ${report.aggregate.dimensionPassCounts.conversationalBehavior}/${report.aggregate.totalTurns} (${report.aggregate.dimensionPassRates.conversationalBehavior.toFixed(1)}%)`);
  console.log("=========================================================================\n");

  if (report.failedCaseDetails.length > 0) {
    console.log("=========================================================================");
    console.log("                     REPRODUCIBLE FAILURE DETAILS                       ");
    console.log("=========================================================================");
    for (const fail of report.failedCaseDetails) {
      console.log(`\nFailure in Case: ${fail.caseId} ("${fail.title}")`);
      console.log(`  Turn Index    : ${fail.failingTurnIndex + 1}`);
      console.log(`  Turn Input    : "${fail.turnInput}"`);
      console.log(`  Failing Dims  : ${fail.failingDimensions.join(", ")}`);
      console.log("  Details       :");
      for (const d of fail.turnDetails) {
        console.log(`    - ${d}`);
      }
    }
    console.log("\n=========================================================================");
  } else {
    console.log("REPRODUCIBLE FAILURES: None. All 50 candidate fixtures passed across all 5 dimensions.");
  }

  process.exit(0);
}

main();
