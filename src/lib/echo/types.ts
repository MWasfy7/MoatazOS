export type EchoInputMode = "TEXT" | "VOICE_TRANSCRIPT";
export type EchoConfidence = "HIGH" | "MEDIUM" | "LOW";
export type EchoDestination =
  | "CONVERSATION"
  | "CONTEXT"
  | "ACTION_REVIEW"
  | "CLARIFICATION";

export type EchoIntentKind =
  | "GREETING"
  | "CONTINUE"
  | "CORRECTION"
  | "CANCEL_REQUEST"
  | "RESTRAINT_REQUEST"
  | "ACTION_REQUEST"
  | "INFORMATION_REQUEST"
  | "CONTEXT_UPDATE"
  | "CONVERSATION";

export type EchoLanguage =
  | "ENGLISH"
  | "ARABIC"
  | "FRANCO_ARABIC"
  | "MIXED";

export interface EchoContextReference {
  id: string;
  label: string;
  kind: "TOPIC" | "PROJECT" | "TASK" | "ARTIFACT";
  sourceTurnId?: string;
}

export interface EchoConversationTurn {
  id: string;
  role: "USER" | "ECHO";
  text: string;
  timestamp: string;
  intent?: EchoIntentKind;
}

export interface EchoSessionContext {
  id: string;
  turns?: EchoConversationTurn[];
  activeFocus?: EchoContextReference;
  references?: EchoContextReference[];
}

export interface EchoContext {
  activeFocus?: EchoContextReference;
  references?: EchoContextReference[];
}

export interface EchoInput {
  text: string;
  inputMode: EchoInputMode;
  timestamp: string;
  session?: EchoSessionContext;
  context?: EchoContext;
}

export interface ResolvedIntent {
  kind: EchoIntentKind;
  language: EchoLanguage;
  normalizedText: string;
  operation?: string;
  explicitTarget?: string;
  usesContextReference: boolean;
  isFragment: boolean;
  signals: string[];
}

export interface EchoProposedAction {
  id: string;
  kind:
    | "CONTINUE_THREAD"
    | "UPDATE_CONVERSATION_FOCUS"
    | "REVIEW_REQUEST"
    | "ANSWER_IN_CONVERSATION";
  description: string;
  targetReferenceId?: string;
  status: "PROPOSED";
  externalSideEffect: false;
}

export interface EchoResult {
  response: string;
  resolvedIntent: ResolvedIntent;
  confidence: EchoConfidence;
  destination: EchoDestination;
  proposedActions: EchoProposedAction[];
  clarificationRequired: boolean;
  contextReferences: EchoContextReference[];
  assumptions: string[];
}

export interface EchoRuntimeSnapshot {
  session: EchoSessionContext;
  lastResult?: EchoResult;
  nextTurnSequence: number;
}

export interface IntentResolution {
  intent: ResolvedIntent;
  originalText: string;
  tokens: string[];
}

export interface ContextResolution {
  references: EchoContextReference[];
  resolvedTarget?: EchoContextReference;
  ambiguity: EchoContextReference[];
  unresolvedReference: boolean;
  assumptions: string[];
  nextFocus?: EchoContextReference;
}

export interface ConfidenceDecision {
  confidence: EchoConfidence;
  clarificationRequired: boolean;
  clarificationReason?:
    | "AMBIGUOUS_CONSEQUENTIAL_TARGET"
    | "UNRESOLVED_CONSEQUENTIAL_TARGET";
}
