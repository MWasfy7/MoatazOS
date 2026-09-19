import type {
  ContextResolution,
  EchoContextReference,
  EchoInput,
  EchoSessionContext,
  IntentResolution,
} from "./types";

const REFERENCE_WORDS = new Set([
  "it", "that", "this", "them", "ده", "دا", "دي", "دول", "da", "di", "dah", "dol",
]);

const slug = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48) || "current-focus";

const uniqueReferences = (references: readonly EchoContextReference[]) => {
  const unique = new Map<string, EchoContextReference>();
  for (const reference of references) unique.set(reference.id, reference);
  return [...unique.values()];
};

const asReference = (label: string): EchoContextReference => ({
  id: `topic:${slug(label)}`,
  label: label.trim(),
  kind: /project|system|echo|salesos|مشروع|نظام/iu.test(label) ? "PROJECT" : "TOPIC",
});

const correctionTarget = (text: string) => {
  const explicitMeaning = text.match(/(?:i\s+mean|actually|قصدي|asdy)\s+(.+?)(?=\s+(?:not|مش|msh|mesh)\b|[.!?،؛]|$)/iu)?.[1];
  if (explicitMeaning?.trim()) return explicitMeaning.trim();
  const clauses = text
    .split(/[.!?،؛]+/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const last = clauses.at(-1) ?? text;
  return last
    .replace(/^(?:no|لا|لأ|la2|actually|قصدي|asdy)[,\s-]*/iu, "")
    .replace(/^(?:not|مش|msh|mesh)\s+/iu, "")
    .trim();
};

const contextualReferences = (input: EchoInput, session: EchoSessionContext) =>
  uniqueReferences([
    ...(input.context?.references ?? []),
    ...(session.references ?? []),
    ...(input.context?.activeFocus ? [input.context.activeFocus] : []),
    ...(session.activeFocus ? [session.activeFocus] : []),
  ]);

export function resolveContext(
  input: EchoInput,
  session: EchoSessionContext,
  resolution: IntentResolution,
): ContextResolution {
  const references = contextualReferences(input, session);
  const activeFocus = input.context?.activeFocus ?? session.activeFocus;
  const { intent, tokens } = resolution;
  const assumptions: string[] = [];
  let resolvedTarget: EchoContextReference | undefined;
  let nextFocus = activeFocus;
  let ambiguity: EchoContextReference[] = [];
  let unresolvedReference = false;

  if (intent.kind === "CORRECTION") {
    const corrected = correctionTarget(input.text);
    if (corrected) {
      resolvedTarget = asReference(corrected);
      nextFocus = resolvedTarget;
      assumptions.push("The last contrastive clause is the corrected conversational focus.");
    }
  } else if (intent.kind === "CONTINUE") {
    resolvedTarget = activeFocus ?? (references.length === 1 ? references[0] : undefined);
    if (!resolvedTarget && references.length > 1) ambiguity = references;
    if (resolvedTarget)
      assumptions.push("Continue refers to the current focus in this session.");
  } else if (intent.kind === "ACTION_REQUEST") {
    if (intent.explicitTarget) {
      resolvedTarget = asReference(intent.explicitTarget);
      nextFocus = resolvedTarget;
    } else if (intent.usesContextReference || tokens.some((token) => REFERENCE_WORDS.has(token))) {
      resolvedTarget = activeFocus ?? (references.length === 1 ? references[0] : undefined);
      if (!resolvedTarget && references.length > 1) ambiguity = references;
      if (!resolvedTarget && references.length === 0) unresolvedReference = true;
      if (resolvedTarget)
        assumptions.push("The pronoun refers to the active focus in this session.");
    }
  } else if (intent.kind === "CONTEXT_UPDATE") {
    const label = input.text.trim().replace(/[.!?؟]+$/u, "");
    if (label) {
      resolvedTarget = asReference(label);
      nextFocus = resolvedTarget;
    }
  }

  const nextReferences = uniqueReferences([
    ...references,
    ...(resolvedTarget ? [resolvedTarget] : []),
  ]).slice(-8);

  return {
    references: nextReferences,
    resolvedTarget,
    ambiguity,
    unresolvedReference,
    assumptions,
    nextFocus,
  };
}
