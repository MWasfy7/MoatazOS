import { describe, expect, it } from "vitest";
import { NLFRuntimeAdapter } from "./adapter";
import { evaluateCase, runFullNLFEvaluation } from "./evaluator";
import { CANDIDATE_FIXTURES } from "./fixtures/candidateFixtures";
import { ORIGINAL_NLF50_CASES } from "./fixtures/originalNlf50";

describe("NLF Evaluation Harness against ECHO SHA b7a3a2f495aeaf9764b61089be5c612fc1dd9dad", () => {
  it("runs full candidate and original fixture evaluation and produces aggregate scorecard", () => {
    const adapter = new NLFRuntimeAdapter("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    const report = runFullNLFEvaluation(
      CANDIDATE_FIXTURES,
      ORIGINAL_NLF50_CASES,
      adapter,
      "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad",
      "632fd469aa4d8f12257f4fdcd163ab02e5e67d2f",
      false,
    );

    expect(report.targetEchoSha).toBe("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    expect(report.baseSha).toBe("632fd469aa4d8f12257f4fdcd163ab02e5e67d2f");
    expect(report.harnessExecutionSuccess).toBe(true);
    expect(report.candidateCases).toHaveLength(50);
    expect(report.originalCases).toHaveLength(50);
    expect(report.candidateAggregate.totalTurns).toBe(80);

    // Retain baseline candidate results and 4 failures
    expect(report.candidateAggregate.passedCases).toBe(46);
    expect(report.candidateAggregate.failedCases).toBe(4);

    // Disclose source defects/conflicts in original suite
    expect(report.originalAggregate.sourceConflictsCount).toBe(13);
  });

  it("verifies capability and execution honesty across candidate fixtures", () => {
    const adapter = new NLFRuntimeAdapter("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    for (const fixture of CANDIDATE_FIXTURES) {
      const result = evaluateCase(fixture, adapter);
      for (const turn of result.turns) {
        expect(turn.dimensions.capabilityExecutionHonesty.passed).toBe(true);
        expect(turn.observation.proposedActions.every((a) => a.externalSideEffect === false)).toBe(true);
        expect(turn.observation.proposedActions.every((a) => a.status === "PROPOSED")).toBe(true);
      }
    }
  });

  it("requires clarification for unresolved consequential targets without active focus", () => {
    const adapter = new NLFRuntimeAdapter("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    const unresolvedCase = CANDIDATE_FIXTURES.find(
      (c) => c.id === "NLF-CANDIDATE-33",
    );
    expect(unresolvedCase).toBeDefined();
    if (unresolvedCase) {
      const result = evaluateCase(unresolvedCase, adapter);
      expect(result.turns[0]?.observation.clarificationRequired).toBe(true);
      expect(result.turns[0]?.observation.destination).toBe("CLARIFICATION");
    }
  });
});
