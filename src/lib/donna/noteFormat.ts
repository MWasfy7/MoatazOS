/**
 * The database has one free-text column for what the operator said
 * (`original_input`, 2000 chars), and the hosted schema is not changed in this
 * slice. The operator's "Next step" is therefore stored in that column too.
 *
 * Versioned and lossless:
 *  - A note with no next step is stored EXACTLY as typed (byte for byte). This
 *    is also how every record written before the Next step existed looks.
 *  - A note with a next step, or any note that itself begins with the version
 *    prefix, is stored as `PREFIX + JSON` of `{ n: note, s: nextStep }`. JSON
 *    carries both strings verbatim: whitespace, newlines, and any literal text
 *    (including the old `[[next-step]]` delimiter) survive unchanged.
 *  - A stored value is read as structured only if it starts with the prefix
 *    AND parses as exactly that JSON shape. Anything else is a legacy or plain
 *    note and is returned untouched, so a legacy note that merely contains a
 *    delimiter sequence is never mistaken for structured data.
 */
export const ORIGINAL_INPUT_PREFIX = "⁣donna-v1⁣";
export const MAX_ORIGINAL_INPUT = 2000;

export interface SplitNote {
  readonly note: string;
  readonly nextStep: string;
}

export function composeOriginalInput(note: string, nextStep: string): string {
  if (nextStep === "" && !note.startsWith(ORIGINAL_INPUT_PREFIX)) return note;
  return ORIGINAL_INPUT_PREFIX + JSON.stringify({ n: note, s: nextStep });
}

export function splitOriginalInput(stored: string): SplitNote {
  if (stored.startsWith(ORIGINAL_INPUT_PREFIX)) {
    try {
      const parsed: unknown = JSON.parse(stored.slice(ORIGINAL_INPUT_PREFIX.length));
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        const { n, s } = parsed as { n?: unknown; s?: unknown };
        if (keys.length === 2 && typeof n === "string" && typeof s === "string") return { note: n, nextStep: s };
      }
    } catch {
      // not structured: fall through to the legacy/plain reading
    }
  }
  return { note: stored, nextStep: "" };
}
