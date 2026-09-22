import { describe, expect, it } from "vitest";
import { NLFRuntimeAdapter } from "./adapter";
import { evaluateCase, runFullNLFEvaluation } from "./evaluator";
import { CANDIDATE_FIXTURES } from "./fixtures/candidateFixtures";

describe("NLF Evaluation Harness against ECHO SHA b7a3a2f495aeaf9764b61089be5c612fc1dd9dad", () => {
  it("runs full candidate fixture evaluation and produces aggregate scorecard", () => {
    const adapter = new NLFRuntimeAdapter();
    const report = runFullNLFEvaluation(
      CANDIDATE_FIXTURES,
      adapter,
      "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad",
      "632fd469aa4d8f12257f4fdcd163ab02e5e67d2f",
    );

    expect(report.targetEchoSha).toBe("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    expect(report.baseSha).toBe("632fd469aa4d8f12257f4fdcd163ab02e5e67d2f");
    expect(report.missingDependencyReported).toBe(true);
    expect(report.cases).toHaveLength(50);
    expect(report.aggregate.totalTurns).toBe(80);

    // Assert high pass rates across scoring dimensions
    expect(report.aggregate.dimensionPassRates.intentUnderstanding).toBeGreaterThanOrEqual(90);
    expect(report.aggregate.dimensionPassRates.contextAndReferentResolution).toBeGreaterThanOrEqual(95);
    expect(report.aggregate.dimensionPassRates.clarificationAppropriateness).toBe(100);
    expect(report.aggregate.dimensionPassRates.capabilityExecutionHonesty).toBe(100);
    expect(report.aggregate.dimensionPassRates.conversationalBehavior).toBeGreaterThanOrEqual(95);
  });

  it("verifies capability and execution honesty across all candidate fixtures", () => {
    const adapter = new NLFRuntimeAdapter();
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
    const adapter = new NLFRuntimeAdapter();
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
