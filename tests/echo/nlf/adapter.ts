import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { ExpectedTurnEvaluation } from "./fixtures/candidateFixtures";

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
  intent?: string;
}

export interface EchoSessionContext {
  id: string;
  turns?: EchoConversationTurn[];
  activeFocus?: EchoContextReference;
  references?: EchoContextReference[];
}

export interface EchoInput {
  text: string;
  inputMode: "TEXT" | "VOICE_TRANSCRIPT";
  timestamp: string;
  session?: EchoSessionContext;
}

export interface EchoProposedAction {
  id: string;
  kind: string;
  description: string;
  targetReferenceId?: string;
  status: "PROPOSED";
  externalSideEffect: false;
}

export interface EchoResult {
  response: string;
  resolvedIntent: {
    kind: string;
    language: string;
    normalizedText: string;
    operation?: string;
    explicitTarget?: string;
    usesContextReference: boolean;
    isFragment: boolean;
    signals: string[];
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  destination: "CONVERSATION" | "CONTEXT" | "ACTION_REVIEW" | "CLARIFICATION";
  proposedActions: EchoProposedAction[];
  clarificationRequired: boolean;
  contextReferences: EchoContextReference[];
  assumptions: string[];
}

export interface EchoRuntimeSnapshot {
  session: EchoSessionContext;
  lastResult?: EchoResult;
}

export interface EchoRuntimeInstance {
  process(input: EchoInput): EchoResult;
  snapshot(sessionId?: string): EchoRuntimeSnapshot | undefined;
}

export interface AdaptedObservation {
  turnInput: EchoInput;
  result: EchoResult;
  activeFocusLabel?: string;
  contextReferences: EchoContextReference[];
  proposedActions: EchoResult["proposedActions"];
  clarificationRequired: boolean;
  destination: EchoResult["destination"];
  response: string;
  resolvedIntentKind: string;
  resolvedLanguage: string;
  assumptions: string[];
}

const TARGET_ECHO_SHA = "b7a3a2f495aeaf9764b61089be5c612fc1dd9dad";

function ensureEchoRuntimeExtracted(targetSha = TARGET_ECHO_SHA): string {
  const cacheDir = path.join("/tmp", `echo-runtime-${targetSha}`);
  const bundleFile = path.join(cacheDir, "bundle.cjs");
  if (!fs.existsSync(bundleFile)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    try {
      execSync(`git cat-file -e ${targetSha}`, { stdio: "ignore" });
    } catch {
      try {
        execSync(`git fetch origin ${targetSha}`, { stdio: "ignore" });
      } catch {
        execSync(`git fetch origin echo/build-0-natural-runtime`, { stdio: "ignore" });
      }
    }
    execSync(`git archive ${targetSha} src/lib/echo | tar -x -C ${cacheDir}`);
    const indexPath = path.join(cacheDir, "src", "lib", "echo", "index.ts");
    execSync(`npx esbuild ${indexPath} --bundle --platform=node --format=cjs --outfile=${bundleFile}`);
  }
  return bundleFile;
}

function loadEchoRuntimeInstance(targetSha = TARGET_ECHO_SHA): EchoRuntimeInstance {
  const bundleFile = ensureEchoRuntimeExtracted(targetSha);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require(bundleFile);
  const factory = m.createEchoRuntime || m.default?.createEchoRuntime;
  if (!factory) {
    throw new Error(`Failed to load createEchoRuntime from ECHO SHA ${targetSha}`);
  }
  return factory();
}

export class NLFRuntimeAdapter {
  private runtime: EchoRuntimeInstance;
  private readonly targetSha: string;

  constructor(targetSha = TARGET_ECHO_SHA) {
    this.targetSha = targetSha;
    this.runtime = loadEchoRuntimeInstance(targetSha);
  }

  reset(): void {
    this.runtime = loadEchoRuntimeInstance(this.targetSha);
  }

  processTurn(
    sessionId: string,
    turn: ExpectedTurnEvaluation,
    turnIndex: number,
    timestamp: string,
  ): AdaptedObservation {
    const existingSnapshot = this.runtime.snapshot(sessionId);
    const existingSession = existingSnapshot?.session;

    const references: EchoContextReference[] = [
      ...(existingSession?.references ?? []),
      ...(turn.initialReferences ?? []),
    ];

    const activeFocus: EchoContextReference | undefined =
      turn.initialActiveFocusLabel
        ? {
            id: `topic:${turn.initialActiveFocusLabel.toLowerCase().replace(/\s+/gu, "-")}`,
            label: turn.initialActiveFocusLabel,
            kind: "TOPIC",
          }
        : existingSession?.activeFocus;

    const session: EchoSessionContext = {
      id: sessionId,
      turns: existingSession?.turns ?? [],
      references,
      activeFocus,
    };

    const echoInput: EchoInput = {
      text: turn.input,
      inputMode: turn.inputMode ?? "TEXT",
      timestamp,
      session,
    };

    const result = this.runtime.process(echoInput);
    const postSnapshot = this.runtime.snapshot(sessionId);

    return {
      turnInput: echoInput,
      result,
      activeFocusLabel: postSnapshot?.session.activeFocus?.label,
      contextReferences: result.contextReferences,
      proposedActions: result.proposedActions,
      clarificationRequired: result.clarificationRequired,
      destination: result.destination,
      response: result.response,
      resolvedIntentKind: result.resolvedIntent.kind,
      resolvedLanguage: result.resolvedIntent.language,
      assumptions: result.assumptions,
    };
  }
}
