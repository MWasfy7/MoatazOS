import { describe, expect, it } from "vitest";
import { NLFRuntimeAdapter } from "./adapter";
import { evaluateCase, runFullNLFEvaluation } from "./evaluator";
import { CANDIDATE_FIXTURES } from "./fixtures/candidateFixtures";
import { ORIGINAL_NLF50_CASES } from "./fixtures/originalNlf50";

describe("W2-02 Canonical Gate v2 against ECHO SHA b7a3a2f495aeaf9764b61089be5c612fc1dd9dad", () => {
  it("runs full candidate and original fixture evaluation and produces Gate v2 scorecard", () => {
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
    expect(report.candidateCases.length).toBeGreaterThanOrEqual(50);
    expect(report.originalCases).toHaveLength(50);

    // Verify Counts by Status taxonomy
    expect(report.countsByStatus.VALID).toBeGreaterThan(0);
    expect(report.countsByStatus.INVALID_SOURCE_EXPECTATION).toBeGreaterThan(0);
    expect(report.countsByStatus.REQUIRES_MISSING_CONTEXT).toBeGreaterThan(0);
    expect(report.countsByStatus.OUT_OF_SCOPE_CAPABILITY).toBeGreaterThan(0);

    // Verify source conflict entries in original suite
    expect(report.originalAggregate.sourceConflictsCount).toBe(14);
  });

  it("verifies focus preservation and capability honesty across safety set fixtures", () => {
    const adapter = new NLFRuntimeAdapter("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    const safetyCases = CANDIDATE_FIXTURES.filter((c) =>
      c.evaluationSets.includes("SAFETY_SET"),
    );
    for (const fixture of safetyCases) {
      const result = evaluateCase(fixture, adapter);
      for (const turn of result.turns) {
        expect(turn.dimensions.capabilityExecutionHonesty.passed).toBe(true);
        expect(turn.observation.proposedActions.every((a) => a.externalSideEffect === false)).toBe(true);
        expect(turn.observation.proposedActions.every((a) => a.status === "PROPOSED")).toBe(true);
      }
    }
  });

  it("evaluates Egyptian Arabic and Franco-Arabic negation without false send actions", () => {
    const adapter = new NLFRuntimeAdapter("b7a3a2f495aeaf9764b61089be5c612fc1dd9dad");
    const negationCase = CANDIDATE_FIXTURES.find(
      (c) => c.id === "NLF-CANDIDATE-53",
    );
    expect(negationCase).toBeDefined();
    if (negationCase) {
      const result = evaluateCase(negationCase, adapter);
      expect(result.turns[0]?.observation.proposedActions.every((a) => a.externalSideEffect === false)).toBe(true);
    }
  });
});
