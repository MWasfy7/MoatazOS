import type { AdaptedObservation, NLFRuntimeAdapter } from "./adapter";
import type {
  ExpectedTurnEvaluation,
  NLFCandidateCase,
} from "./fixtures/candidateFixtures";
import type { OriginalNLFCase } from "./fixtures/originalNlf50";

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

export interface OriginalCaseEvaluationResult {
  caseId: string;
  input: string;
  sourceExpectedIntent: string;
  mappedRuntimeIntent: string;
  sourceClarificationFlag: boolean;
  actualClarificationRequired: boolean;
  sourceConflict?: string;
  passed: boolean;
  dimensions: TurnEvaluationResult["dimensions"];
  observation: AdaptedObservation;
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
  harnessExecutionSuccess: boolean;
  candidateBenchmarkAccepted: boolean;
  originalBenchmarkAccepted: boolean;
  overallAccepted: boolean;
  gateExitCode: number; // Discloses whether failing cases produce a nonzero gate exit
  candidateCases: CaseEvaluationResult[];
  originalCases: OriginalCaseEvaluationResult[];
  candidateAggregate: AggregateScores;
  originalAggregate: AggregateScores & {
    sourceConflictsCount: number;
    sourceConflicts: Array<{ caseId: string; conflict: string }>;
  };
  failedCaseDetails: Array<{
    suite: "candidate" | "original";
    caseId: string;
    title: string;
    failingTurnIndex: number;
    failingDimensions: string[];
    turnInput: string;
    turnDetails: string[];
  }>;
}

export function scoreIntentUnderstanding(
  expected: { expectedIntentKind: string; expectedLanguage?: string },
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
  expected: {
    expectedActiveFocusLabel?: string | null;
    expectedTargetReferenceId?: string;
  },
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
  expected: { expectedClarificationRequired: boolean; expectedClarificationReason?: string },
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
  expected: { expectedExternalSideEffect?: boolean },
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
  expected: { expectedDestination?: string; expectedResponseSubstring?: string },
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
  adapter: NLFRuntimeAdapter,
): CaseEvaluationResult {
  adapter.reset();
  const sessionId = `eval-candidate-${candidateCase.id}`;
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

export function evaluateOriginalCase(
  originalCase: OriginalNLFCase,
  adapter: NLFRuntimeAdapter,
): OriginalCaseEvaluationResult {
  adapter.reset();
  const sessionId = `eval-original-${originalCase.id}`;
  const timestamp = "2026-09-19T09:00:00.000Z";

  const turnExp: ExpectedTurnEvaluation = {
    input: originalCase.input,
    inputMode: originalCase.inputMode ?? "TEXT",
    initialActiveFocusLabel: originalCase.initialActiveFocusLabel,
    initialReferences: originalCase.initialReferences,
    expectedIntentKind: originalCase.mappedRuntimeIntent,
    expectedClarificationRequired: originalCase.expectedClarificationRequired,
    expectedDestination: originalCase.expectedDestination,
    expectedExternalSideEffect: false,
  };

  const observation = adapter.processTurn(sessionId, turnExp, 0, timestamp);
  const turnResult = evaluateTurn(0, turnExp, observation);

  return {
    caseId: originalCase.id,
    input: originalCase.input,
    sourceExpectedIntent: originalCase.sourceExpectedIntent,
    mappedRuntimeIntent: originalCase.mappedRuntimeIntent,
    sourceClarificationFlag: originalCase.sourceClarificationFlag,
    actualClarificationRequired: observation.clarificationRequired,
    sourceConflict: originalCase.sourceConflict,
    passed: turnResult.passed,
    dimensions: turnResult.dimensions,
    observation,
  };
}

export function runFullNLFEvaluation(
  candidateFixtures: NLFCandidateCase[],
  originalFixtures: OriginalNLFCase[],
  adapter: NLFRuntimeAdapter,
  targetEchoSha = "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad",
  baseSha = "632fd469aa4d8f12257f4fdcd163ab02e5e67d2f",
  strictGateExit = false,
): EvaluationReport {
  let harnessExecutionSuccess = true;
  const candidateResults: CaseEvaluationResult[] = [];
  const originalResults: OriginalCaseEvaluationResult[] = [];

  let passedCandidateCases = 0;
  let totalCandidateTurns = 0;
  let passedCandidateTurns = 0;

  const candidateDimPassCounts = {
    intentUnderstanding: 0,
    contextAndReferentResolution: 0,
    clarificationAppropriateness: 0,
    capabilityExecutionHonesty: 0,
    conversationalBehavior: 0,
  };

  const failedCaseDetails: EvaluationReport["failedCaseDetails"] = [];

  try {
    for (const candidateCase of candidateFixtures) {
      const caseRes = evaluateCase(candidateCase, adapter);
      candidateResults.push(caseRes);

      if (caseRes.passed) passedCandidateCases++;

      for (const turn of caseRes.turns) {
        totalCandidateTurns++;
        if (turn.passed) passedCandidateTurns++;

        if (turn.dimensions.intentUnderstanding.passed)
          candidateDimPassCounts.intentUnderstanding++;
        if (turn.dimensions.contextAndReferentResolution.passed)
          candidateDimPassCounts.contextAndReferentResolution++;
        if (turn.dimensions.clarificationAppropriateness.passed)
          candidateDimPassCounts.clarificationAppropriateness++;
        if (turn.dimensions.capabilityExecutionHonesty.passed)
          candidateDimPassCounts.capabilityExecutionHonesty++;
        if (turn.dimensions.conversationalBehavior.passed)
          candidateDimPassCounts.conversationalBehavior++;

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
            suite: "candidate",
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

    let passedOriginalCases = 0;
    const originalDimPassCounts = {
      intentUnderstanding: 0,
      contextAndReferentResolution: 0,
      clarificationAppropriateness: 0,
      capabilityExecutionHonesty: 0,
      conversationalBehavior: 0,
    };
    const sourceConflictsList: Array<{ caseId: string; conflict: string }> = [];

    for (const origCase of originalFixtures) {
      const origRes = evaluateOriginalCase(origCase, adapter);
      originalResults.push(origRes);

      if (origCase.sourceConflict) {
        sourceConflictsList.push({
          caseId: origCase.id,
          conflict: origCase.sourceConflict,
        });
      }

      if (origRes.passed) passedOriginalCases++;

      if (origRes.dimensions.intentUnderstanding.passed)
        originalDimPassCounts.intentUnderstanding++;
      if (origRes.dimensions.contextAndReferentResolution.passed)
        originalDimPassCounts.contextAndReferentResolution++;
      if (origRes.dimensions.clarificationAppropriateness.passed)
        originalDimPassCounts.clarificationAppropriateness++;
      if (origRes.dimensions.capabilityExecutionHonesty.passed)
        originalDimPassCounts.capabilityExecutionHonesty++;
      if (origRes.dimensions.conversationalBehavior.passed)
        originalDimPassCounts.conversationalBehavior++;

      if (!origRes.passed) {
        const failingDims: string[] = [];
        const turnDetails: string[] = [];

        for (const [dimKey, dimVal] of Object.entries(origRes.dimensions)) {
          if (!dimVal.passed) {
            failingDims.push(dimKey);
            turnDetails.push(...dimVal.details);
          }
        }

        failedCaseDetails.push({
          suite: "original",
          caseId: origRes.caseId,
          title: `Original case ${origRes.caseId} (${origRes.sourceExpectedIntent})`,
          failingTurnIndex: 0,
          failingDimensions: failingDims,
          turnInput: origRes.input,
          turnDetails,
        });
      }
    }

    const candidateBenchmarkAccepted =
      passedCandidateCases === candidateFixtures.length;
    const originalBenchmarkAccepted =
      passedOriginalCases === originalFixtures.length;
    const overallAccepted =
      candidateBenchmarkAccepted && originalBenchmarkAccepted;

    const candidateAggregate: AggregateScores = {
      totalCases: candidateFixtures.length,
      passedCases: passedCandidateCases,
      failedCases: candidateFixtures.length - passedCandidateCases,
      totalTurns: totalCandidateTurns,
      passedTurns: passedCandidateTurns,
      dimensionPassCounts: candidateDimPassCounts,
      dimensionPassRates: {
        intentUnderstanding:
          totalCandidateTurns > 0
            ? (candidateDimPassCounts.intentUnderstanding / totalCandidateTurns) *
              100
            : 0,
        contextAndReferentResolution:
          totalCandidateTurns > 0
            ? (candidateDimPassCounts.contextAndReferentResolution /
                totalCandidateTurns) *
              100
            : 0,
        clarificationAppropriateness:
          totalCandidateTurns > 0
            ? (candidateDimPassCounts.clarificationAppropriateness /
                totalCandidateTurns) *
              100
            : 0,
        capabilityExecutionHonesty:
          totalCandidateTurns > 0
            ? (candidateDimPassCounts.capabilityExecutionHonesty /
                totalCandidateTurns) *
              100
            : 0,
        conversationalBehavior:
          totalCandidateTurns > 0
            ? (candidateDimPassCounts.conversationalBehavior /
                totalCandidateTurns) *
              100
            : 0,
      },
    };

    const originalAggregate: AggregateScores & {
      sourceConflictsCount: number;
      sourceConflicts: Array<{ caseId: string; conflict: string }>;
    } = {
      totalCases: originalFixtures.length,
      passedCases: passedOriginalCases,
      failedCases: originalFixtures.length - passedOriginalCases,
      totalTurns: originalFixtures.length,
      passedTurns: passedOriginalCases,
      dimensionPassCounts: originalDimPassCounts,
      dimensionPassRates: {
        intentUnderstanding:
          originalFixtures.length > 0
            ? (originalDimPassCounts.intentUnderstanding / originalFixtures.length) *
              100
            : 0,
        contextAndReferentResolution:
          originalFixtures.length > 0
            ? (originalDimPassCounts.contextAndReferentResolution /
                originalFixtures.length) *
              100
            : 0,
        clarificationAppropriateness:
          originalFixtures.length > 0
            ? (originalDimPassCounts.clarificationAppropriateness /
                originalFixtures.length) *
              100
            : 0,
        capabilityExecutionHonesty:
          originalFixtures.length > 0
            ? (originalDimPassCounts.capabilityExecutionHonesty /
                originalFixtures.length) *
              100
            : 0,
        conversationalBehavior:
          originalFixtures.length > 0
            ? (originalDimPassCounts.conversationalBehavior /
                originalFixtures.length) *
              100
            : 0,
      },
      sourceConflictsCount: sourceConflictsList.length,
      sourceConflicts: sourceConflictsList,
    };

    const gateExitCode = strictGateExit && !overallAccepted ? 1 : 0;

    return {
      targetEchoSha,
      baseSha,
      harnessExecutionSuccess,
      candidateBenchmarkAccepted,
      originalBenchmarkAccepted,
      overallAccepted,
      gateExitCode,
      candidateCases: candidateResults,
      originalCases: originalResults,
      candidateAggregate,
      originalAggregate,
      failedCaseDetails,
    };
  } catch (err) {
    harnessExecutionSuccess = false;
    throw err;
  }
}
