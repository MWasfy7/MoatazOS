import type {
  ConfidenceDecision,
  ContextResolution,
  EchoProposedAction,
  ResolvedIntent,
} from "./types";

export function routeActions(
  intent: ResolvedIntent,
  context: ContextResolution,
  confidence: ConfidenceDecision,
): EchoProposedAction[] {
  if (confidence.clarificationRequired) return [];
  const target = context.resolvedTarget;
  const base = {
    status: "PROPOSED" as const,
    externalSideEffect: false as const,
    targetReferenceId: target?.id,
  };
  if (intent.kind === "CONTINUE" && target)
    return [{
      ...base,
      id: "continue-current-thread",
      kind: "CONTINUE_THREAD",
      description: `Continue the conversation about ${target.label}.`,
    }];
  if (intent.kind === "CORRECTION" && target)
    return [{
      ...base,
      id: "update-conversation-focus",
      kind: "UPDATE_CONVERSATION_FOCUS",
      description: `Use ${target.label} as the corrected conversational focus.`,
    }];
  if (intent.kind === "ACTION_REQUEST" && target)
    return [{
      ...base,
      id: "review-request",
      kind: "REVIEW_REQUEST",
      description: `Review the requested ${intent.operation ?? "change"} for ${target.label}; do not execute externally.`,
    }];
  if (intent.kind === "INFORMATION_REQUEST")
    return [{
      ...base,
      id: "answer-in-conversation",
      kind: "ANSWER_IN_CONVERSATION",
      description: "Answer within the local conversation without external action.",
    }];
  return [];
}
