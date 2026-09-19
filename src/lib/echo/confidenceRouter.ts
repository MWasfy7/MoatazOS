import type {
  ConfidenceDecision,
  ContextResolution,
  ResolvedIntent,
} from "./types";

export function routeConfidence(
  intent: ResolvedIntent,
  context: ContextResolution,
): ConfidenceDecision {
  const consequentialReference =
    intent.kind === "ACTION_REQUEST" || intent.kind === "CONTINUE";
  if (consequentialReference && context.ambiguity.length > 1) {
    return {
      confidence: "LOW",
      clarificationRequired: true,
      clarificationReason: "AMBIGUOUS_CONSEQUENTIAL_TARGET",
    };
  }
  if (intent.kind === "ACTION_REQUEST" && context.unresolvedReference) {
    return {
      confidence: "LOW",
      clarificationRequired: true,
      clarificationReason: "UNRESOLVED_CONSEQUENTIAL_TARGET",
    };
  }
  if (
    intent.kind === "CORRECTION" ||
    (intent.kind === "CONTINUE" && context.resolvedTarget) ||
    (intent.kind === "ACTION_REQUEST" && context.resolvedTarget)
  )
    return { confidence: "HIGH", clarificationRequired: false };
  if (intent.kind === "CONVERSATION" || intent.kind === "INFORMATION_REQUEST")
    return { confidence: "MEDIUM", clarificationRequired: false };
  return {
    confidence: context.resolvedTarget ? "HIGH" : "MEDIUM",
    clarificationRequired: false,
  };
}
