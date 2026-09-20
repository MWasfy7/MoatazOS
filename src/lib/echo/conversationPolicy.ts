import type {
  ConfidenceDecision,
  ContextResolution,
  EchoDestination,
  EchoInput,
  EchoProposedAction,
  ResolvedIntent,
} from "./types";

export interface ConversationDecision {
  response: string;
  destination: EchoDestination;
}

const listAmbiguity = (context: ContextResolution) =>
  context.ambiguity.map(({ label }) => label).join(" or ");

export function applyConversationPolicy(
  input: EchoInput,
  intent: ResolvedIntent,
  context: ContextResolution,
  confidence: ConfidenceDecision,
  actions: readonly EchoProposedAction[],
): ConversationDecision {
  if (!input.text.trim())
    return {
      response: input.inputMode === "VOICE_TRANSCRIPT"
        ? "I didn’t receive any words in that transcript. Send it again when ready."
        : "I didn’t receive any text. Send a thought when you’re ready.",
      destination: "CONVERSATION",
    };
  if (confidence.clarificationRequired)
    return {
      response: context.ambiguity.length
        ? `I understand the direction, but the target could be ${listAmbiguity(context)}. Which one do you mean?`
        : intent.operation === "send"
          ? "Which message or document, and which recipient? I can prepare a proposal, but no sending service is connected."
          : "I understand the action, but I can’t resolve its target in this session. Which item do you mean?",
      destination: "CLARIFICATION",
    };
  if (intent.kind === "GREETING")
    return {
      response: "Hey — I’m with you. What are we working on?",
      destination: "CONVERSATION",
    };
  if (intent.kind === "CONTINUE")
    return context.resolvedTarget
      ? {
          response: `Picking up ${context.resolvedTarget.label}. I kept the thread in this session and haven’t triggered any external action.`,
          destination: "CONTEXT",
        }
      : {
          response: "There isn’t a previous thread in this session yet. Give me the topic and I’ll carry it forward.",
          destination: "CONVERSATION",
        };
  if (intent.kind === "CORRECTION" && context.resolvedTarget)
    return {
      response: `Understood — the current focus is ${context.resolvedTarget.label}. I corrected the conversation context only.`,
      destination: "CONTEXT",
    };
  if (intent.kind === "CANCEL_REQUEST")
    return {
      response: "Understood. I won’t proceed with that request. Nothing external has run.",
      destination: "CONVERSATION",
    };
  if (intent.kind === "RESTRAINT_REQUEST")
    return {
      response: context.resolvedTarget
        ? `Understood. I’m withholding action on this turn. The current focus is ${context.resolvedTarget.label}; no durable contact policy has been changed.`
        : "Understood. I’m withholding action on this turn. No durable contact policy has been changed.",
      destination: "CONVERSATION",
    };
  if (intent.kind === "ACTION_REQUEST") {
    if (context.resolvedTarget && actions.length)
      return {
        response: `I resolved this as a request to ${intent.operation ?? "work on"} ${context.resolvedTarget.label}. I’ve prepared it for review here; nothing external has run.${intent.operation === "send" || intent.operation === "delete" ? " No execution service is connected." : ""}`,
        destination: "ACTION_REVIEW",
      };
    return {
      response: `I understand the ${intent.operation ?? "action"} you want. Name the target when you’re ready, and I’ll keep the next step explicit.`,
      destination: "CONVERSATION",
    };
  }
  if (intent.kind === "INFORMATION_REQUEST")
    return context.nextFocus
      ? {
          response: `We’re currently focused on ${context.nextFocus.label}. I can explain it or help shape the next step without taking external action.`,
          destination: "CONVERSATION",
        }
      : {
          response: "I’m following. Tell me the subject you want to unpack, and I’ll reason through it with you here.",
          destination: "CONVERSATION",
        };
  if (intent.kind === "CONTEXT_UPDATE" && context.resolvedTarget)
    return {
      response: `Got it — I’ll keep ${context.resolvedTarget.label} as the current focus for this session.`,
      destination: "CONTEXT",
    };
  return {
    response: "I’m following the thought. Keep going, or turn it into a specific question or next step when you want.",
    destination: "CONVERSATION",
  };
}
