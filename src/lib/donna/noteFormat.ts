/**
 * The database has one free-text column for what the operator said
 * (`original_input`, 2000 chars), and the hosted schema is not changed in this
 * slice. The operator's "Next step" is therefore stored in that column after a
 * fixed marker and split back out for display. The two parts stay separate
 * everywhere in the UI and in the unknown-field logic.
 */
export const NEXT_STEP_MARKER = "\n[[next-step]]\n";
export const MAX_ORIGINAL_INPUT = 2000;

export interface SplitNote {
  readonly note: string;
  readonly nextStep: string;
}

const clean = (value: string) => value.split(NEXT_STEP_MARKER.trim()).join("").trim();

export function composeOriginalInput(note: string, nextStep: string): string {
  const n = clean(note);
  const s = clean(nextStep);
  return s === "" ? n : `${n}${NEXT_STEP_MARKER}${s}`;
}

export function splitOriginalInput(stored: string): SplitNote {
  const at = stored.indexOf(NEXT_STEP_MARKER);
  if (at < 0) return { note: stored, nextStep: "" };
  return { note: stored.slice(0, at), nextStep: stored.slice(at + NEXT_STEP_MARKER.length) };
}
