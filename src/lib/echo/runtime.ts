import { routeActions } from "./actionRouter";
import { routeConfidence } from "./confidenceRouter";
import { resolveContext } from "./contextResolver";
import { applyConversationPolicy } from "./conversationPolicy";
import { resolveIntent } from "./intentResolver";
import type {
  EchoConversationTurn,
  EchoInput,
  EchoResult,
  EchoRuntimeSnapshot,
  EchoSessionContext,
} from "./types";

const DEFAULT_SESSION_ID = "echo-local-session";

const cloneSession = (session: EchoSessionContext): EchoSessionContext => ({
  ...session,
  turns: session.turns?.map((turn) => ({ ...turn })) ?? [],
  references: session.references?.map((reference) => ({ ...reference })) ?? [],
  activeFocus: session.activeFocus ? { ...session.activeFocus } : undefined,
});

export class EchoConversationRuntime {
  private readonly sessions = new Map<string, EchoRuntimeSnapshot>();

  process(input: EchoInput): EchoResult {
    const sessionId = input.session?.id ?? DEFAULT_SESSION_ID;
    const existing = this.sessions.get(sessionId)?.session;
    const session = cloneSession({
      id: sessionId,
      turns: input.session?.turns ?? existing?.turns ?? [],
      references: input.session?.references ?? existing?.references ?? [],
      activeFocus: input.session?.activeFocus ?? existing?.activeFocus,
    });
    const resolution = resolveIntent(input.text);
    const context = resolveContext(input, session, resolution);
    const confidence = routeConfidence(resolution.intent, context);
    const proposedActions = routeActions(resolution.intent, context, confidence);
    const policy = applyConversationPolicy(
      input,
      resolution.intent,
      context,
      confidence,
      proposedActions,
    );
    const result: EchoResult = {
      response: policy.response,
      resolvedIntent: resolution.intent,
      confidence: confidence.confidence,
      destination: policy.destination,
      proposedActions,
      clarificationRequired: confidence.clarificationRequired,
      contextReferences: context.references,
      assumptions: context.assumptions,
    };
    const userTurn: EchoConversationTurn = {
      id: `${sessionId}:user:${session.turns?.length ?? 0}`,
      role: "USER",
      text: input.text,
      timestamp: input.timestamp,
      intent: resolution.intent.kind,
    };
    const echoTurn: EchoConversationTurn = {
      id: `${sessionId}:echo:${(session.turns?.length ?? 0) + 1}`,
      role: "ECHO",
      text: result.response,
      timestamp: input.timestamp,
    };
    this.sessions.set(sessionId, {
      session: {
        id: sessionId,
        turns: [...(session.turns ?? []), userTurn, echoTurn].slice(-20),
        references: context.references,
        activeFocus: context.nextFocus,
      },
      lastResult: result,
    });
    return result;
  }

  snapshot(sessionId = DEFAULT_SESSION_ID): EchoRuntimeSnapshot | undefined {
    const snapshot = this.sessions.get(sessionId);
    return snapshot
      ? { session: cloneSession(snapshot.session), lastResult: snapshot.lastResult }
      : undefined;
  }
}

export const createEchoRuntime = () => new EchoConversationRuntime();
