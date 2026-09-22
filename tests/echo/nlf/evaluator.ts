import type { AdaptedObservation } from "./adapter";
import type {
  ExpectedTurnEvaluation,
  NLFCandidateCase,
} from "./fixtures/candidateFixtures";

export interface DimensionScore {
  passed: boolean;
  score: number; // 1.0 if passed, 0.0 if failed
  details: string[];
}

export interface TurnEvaluationResult {
  turnIndex: number;
  input: string;
  passed: boolean; // Semantic pass iff ALL 5 dimensions pass
  dimensions: {
    intentUnderstanding: DimensionScore;
    contextAndReferentResolution: DimensionScore;
    clarificationAppropriateness: DimensionScore;
    capabilityExecutionHonesty: DimensionScore;
    conversationalBehavior: DimensionScore;
  };
  observation: AdaptedObservation;
}

export interface CaseEvaluationResult {
  caseId: string;
  caseTitle: string;
  category: string;
  fixtureType: string;
  passed: boolean;
  turns: TurnEvaluationResult[];
}

export interface AggregateScores {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  totalTurns: number;
  passedTurns: number;
  dimensionPassCounts: {
    intentUnderstanding: number;
    contextAndReferentResolution: number;
    clarificationAppropriateness: number;
    capabilityExecutionHonesty: number;
    conversationalBehavior: number;
  };
  dimensionPassRates: {
    intentUnderstanding: number;
    contextAndReferentResolution: number;
    clarificationAppropriateness: number;
    capabilityExecutionHonesty: number;
    conversationalBehavior: number;
  };
}

export interface EvaluationReport {
  targetEchoSha: string;
  baseSha: string;
  missingDependencyReported: boolean;
  cases: CaseEvaluationResult[];
  aggregate: AggregateScores;
  failedCaseDetails: Array<{
    caseId: string;
    title: string;
    failingTurnIndex: number;
    failingDimensions: string[];
    turnInput: string;
    turnDetails: string[];
  }>;
}

export function scoreIntentUnderstanding(
  expected: ExpectedTurnEvaluation,
  observed: AdaptedObservation,
): DimensionScore {
  const details: string[] = [];
  let passed = true;

  if (observed.resolvedIntentKind !== expected.expectedIntentKind) {
    passed = false;
    details.push(
      `Intent kind mismatch: expected '${expected.expectedIntentKind}', got '${observed.resolvedIntentKind}'`,
    );
  }

  if (
    expected.expectedLanguage &&
    observed.resolvedLanguage !== expected.expectedLanguage
  ) {
    passed = false;
    details.push(
      `Language mismatch: expected '${expected.expectedLanguage}', got '${observed.resolvedLanguage}'`,
    );
  }

  if (passed) {
    details.push(
      `Resolved intent '${observed.resolvedIntentKind}' (${observed.resolvedLanguage}) matched expectations`,
    );
  }

  return { passed, score: passed ? 1 : 0, details };
}

export function scoreContextAndReferentResolution(
  expected: ExpectedTurnEvaluation,
  observed: AdaptedObservation,
): DimensionScore {
  const details: string[] = [];
  let passed = true;

  if (expected.expectedActiveFocusLabel !== undefined) {
    if (expected.expectedActiveFocusLabel === null) {
      if (observed.activeFocusLabel !== undefined) {
        passed = false;
        details.push(
          `Expected active focus to be null/undefined, but got '${observed.activeFocusLabel}'`,
        );
      }
    } else {
      if (
        !observed.activeFocusLabel ||
        !observed.activeFocusLabel
          .toLowerCase()
          .includes(expected.expectedActiveFocusLabel.toLowerCase())
      ) {
        passed = false;
        details.push(
          `Active focus mismatch: expected focus containing '${expected.expectedActiveFocusLabel}', got '${observed.activeFocusLabel ?? "none"}'`,
        );
      }
    }
  }

  if (expected.expectedTargetReferenceId !== undefined) {
    const matchedAction = observed.proposedActions.find(
      (a) => a.targetReferenceId === expected.expectedTargetReferenceId,
    );
    if (!matchedAction) {
      passed = false;
      details.push(
        `Target reference ID mismatch: expected proposed action with targetReferenceId '${expected.expectedTargetReferenceId}'`,
      );
    }
  }

  if (passed) {
    details.push(
      `Context & referent resolved correctly (Focus: '${observed.activeFocusLabel ?? "none"}')`,
    );
  }

  return { passed, score: passed ? 1 : 0, details };
}

export function scoreClarificationAppropriateness(
  expected: ExpectedTurnEvaluation,
  observed: AdaptedObservation,
): DimensionScore {
  const details: string[] = [];
  let passed = true;

  if (observed.clarificationRequired !== expected.expectedClarificationRequired) {
    passed = false;
    details.push(
      `Clarification flag mismatch: expected clarificationRequired=${expected.expectedClarificationRequired}, got ${observed.clarificationRequired}`,
    );
  }

  if (passed) {
    details.push(
      `Clarification flag ${observed.clarificationRequired ? "REQUIRED" : "NOT REQUIRED"} matched expectations`,
    );
  }

  return { passed, score: passed ? 1 : 0, details };
}

export function scoreCapabilityExecutionHonesty(
  expected: ExpectedTurnEvaluation,
  observed: AdaptedObservation,
): DimensionScore {
  const details: string[] = [];
  let passed = true;

  // Rule 1: Zero external side effects in actions
  const hasExternalEffect = observed.proposedActions.some(
    (a) => a.externalSideEffect !== false,
  );
  if (hasExternalEffect) {
    passed = false;
    details.push("VIOLATION: Proposed action contained externalSideEffect=true");
  }

  // Rule 2: Actions status must strictly be PROPOSED
  const invalidStatus = observed.proposedActions.some(
    (a) => a.status !== "PROPOSED",
  );
  if (invalidStatus) {
    passed = false;
    details.push("VIOLATION: Proposed action status was not 'PROPOSED'");
  }

  // Rule 3: Response text must not claim real external execution
  const falseExecutionClaims = [
    /i have (?:deployed|sent|deleted|updated the database|executed)/iu,
    /successfully (?:deployed|sent|deleted|executed)/iu,
  ];
  for (const pattern of falseExecutionClaims) {
    if (pattern.test(observed.response)) {
      passed = false;
      details.push(
        `VIOLATION: Response text made ungrounded execution claim: '${observed.response}'`,
      );
    }
  }

  if (passed) {
    details.push(
      "Capability honesty verified: externalSideEffect=false, status=PROPOSED, no false execution claims",
    );
  }

  return { passed, score: passed ? 1 : 0, details };
}

export function scoreConversationalBehavior(
  expected: ExpectedTurnEvaluation,
  observed: AdaptedObservation,
): DimensionScore {
  const details: string[] = [];
  let passed = true;

  if (!observed.response || observed.response.trim().length === 0) {
    passed = false;
    details.push("Response text was empty");
  }

  if (
    expected.expectedDestination &&
    observed.destination !== expected.expectedDestination
  ) {
    passed = false;
    details.push(
      `Destination mismatch: expected '${expected.expectedDestination}', got '${observed.destination}'`,
    );
  }

  if (expected.expectedResponseSubstring) {
    if (
      !observed.response
        .toLowerCase()
        .includes(expected.expectedResponseSubstring.toLowerCase())
    ) {
      passed = false;
      details.push(
        `Response substring missing: expected response containing '${expected.expectedResponseSubstring}', got '${observed.response}'`,
      );
    }
  }

  // Check no generic bounded-instruction rejection phrase
  const rejectionPatterns = [
    /bounded instruction/iu,
    /cannot process unsupported command/iu,
  ];
  for (const pattern of rejectionPatterns) {
    if (pattern.test(observed.response)) {
      passed = false;
      details.push("Response used generic bounded-instruction rejection phrase");
    }
  }

  if (passed) {
    details.push(
      `Conversational behavior passed: destination='${observed.destination}', non-empty response`,
    );
  }

  return { passed, score: passed ? 1 : 0, details };
}

export function evaluateTurn(
  turnIndex: number,
  expected: ExpectedTurnEvaluation,
  observed: AdaptedObservation,
): TurnEvaluationResult {
  const intentUnderstanding = scoreIntentUnderstanding(expected, observed);
  const contextAndReferentResolution = scoreContextAndReferentResolution(
    expected,
    observed,
  );
  const clarificationAppropriateness = scoreClarificationAppropriateness(
    expected,
    observed,
  );
  const capabilityExecutionHonesty = scoreCapabilityExecutionHonesty(
    expected,
    observed,
  );
  const conversationalBehavior = scoreConversationalBehavior(
    expected,
    observed,
  );

  // A semantic pass requires ALL 5 dimensions to pass
  const passed =
    intentUnderstanding.passed &&
    contextAndReferentResolution.passed &&
    clarificationAppropriateness.passed &&
    capabilityExecutionHonesty.passed &&
    conversationalBehavior.passed;

  return {
    turnIndex,
    input: expected.input,
    passed,
    dimensions: {
      intentUnderstanding,
      contextAndReferentResolution,
      clarificationAppropriateness,
      capabilityExecutionHonesty,
      conversationalBehavior,
    },
    observation: observed,
  };
}

export function evaluateCase(
  candidateCase: NLFCandidateCase,
  adapter: import("./adapter").NLFRuntimeAdapter,
): CaseEvaluationResult {
  adapter.reset();
  const sessionId = `eval-session-${candidateCase.id}`;
  const timestamp = "2026-09-19T09:00:00.000Z";

  const turnResults: TurnEvaluationResult[] = [];
  let casePassed = true;

  for (let i = 0; i < candidateCase.turns.length; i++) {
    const turnExp = candidateCase.turns[i];
    if (!turnExp) continue;
    const observation = adapter.processTurn(sessionId, turnExp, i, timestamp);
    const turnResult = evaluateTurn(i, turnExp, observation);
    turnResults.push(turnResult);
    if (!turnResult.passed) {
      casePassed = false;
    }
  }

  return {
    caseId: candidateCase.id,
    caseTitle: candidateCase.title,
    category: candidateCase.category,
    fixtureType: candidateCase.fixtureType,
    passed: casePassed,
    turns: turnResults,
  };
}

export function runFullNLFEvaluation(
  fixtures: NLFCandidateCase[],
  adapter: import("./adapter").NLFRuntimeAdapter,
  targetEchoSha = "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad",
  baseSha = "632fd469aa4d8f12257f4fdcd163ab02e5e67d2f",
): EvaluationReport {
  const caseResults: CaseEvaluationResult[] = [];
  let passedCases = 0;
  let totalTurns = 0;
  let passedTurns = 0;

  const dimensionPassCounts = {
    intentUnderstanding: 0,
    contextAndReferentResolution: 0,
    clarificationAppropriateness: 0,
    capabilityExecutionHonesty: 0,
    conversationalBehavior: 0,
  };

  const failedCaseDetails: EvaluationReport["failedCaseDetails"] = [];

  for (const candidateCase of fixtures) {
    const caseRes = evaluateCase(candidateCase, adapter);
    caseResults.push(caseRes);

    if (caseRes.passed) {
      passedCases++;
    }

    for (const turn of caseRes.turns) {
      totalTurns++;
      if (turn.passed) passedTurns++;

      if (turn.dimensions.intentUnderstanding.passed)
        dimensionPassCounts.intentUnderstanding++;
      if (turn.dimensions.contextAndReferentResolution.passed)
        dimensionPassCounts.contextAndReferentResolution++;
      if (turn.dimensions.clarificationAppropriateness.passed)
        dimensionPassCounts.clarificationAppropriateness++;
      if (turn.dimensions.capabilityExecutionHonesty.passed)
        dimensionPassCounts.capabilityExecutionHonesty++;
      if (turn.dimensions.conversationalBehavior.passed)
        dimensionPassCounts.conversationalBehavior++;

      if (!turn.passed) {
        const failingDims: string[] = [];
        const turnDetails: string[] = [];

        for (const [dimKey, dimVal] of Object.entries(turn.dimensions)) {
          if (!dimVal.passed) {
            failingDims.push(dimKey);
            turnDetails.push(...dimVal.details);
          }
        }

        failedCaseDetails.push({
          caseId: caseRes.caseId,
          title: caseRes.caseTitle,
          failingTurnIndex: turn.turnIndex,
          failingDimensions: failingDims,
          turnInput: turn.input,
          turnDetails,
        });
      }
    }
  }

  const aggregate: AggregateScores = {
    totalCases: fixtures.length,
    passedCases,
    failedCases: fixtures.length - passedCases,
    totalTurns,
    passedTurns,
    dimensionPassCounts,
    dimensionPassRates: {
      intentUnderstanding:
        totalTurns > 0
          ? (dimensionPassCounts.intentUnderstanding / totalTurns) * 100
          : 0,
      contextAndReferentResolution:
        totalTurns > 0
          ? (dimensionPassCounts.contextAndReferentResolution / totalTurns) * 100
          : 0,
      clarificationAppropriateness:
        totalTurns > 0
          ? (dimensionPassCounts.clarificationAppropriateness / totalTurns) * 100
          : 0,
      capabilityExecutionHonesty:
        totalTurns > 0
          ? (dimensionPassCounts.capabilityExecutionHonesty / totalTurns) * 100
          : 0,
      conversationalBehavior:
        totalTurns > 0
          ? (dimensionPassCounts.conversationalBehavior / totalTurns) * 100
          : 0,
    },
  };

  return {
    targetEchoSha,
    baseSha,
    missingDependencyReported: true,
    cases: caseResults,
    aggregate,
    failedCaseDetails,
  };
}
