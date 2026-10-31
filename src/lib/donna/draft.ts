import { formatLocal } from "./time";
import type { OutcomeRecord } from "./types";

/**
 * Follow-up drafts. Deterministic TEMPLATES: no AI model, no network, nothing is sent.
 *
 * What a draft may contain (and nothing else):
 *  - the client's label;
 *  - the operator's own next-step text, verbatim;
 *  - a time ONLY when the client explicitly confirmed it (an internal follow-up date is the
 *    operator's private reminder and is never presented to the client as agreed);
 *  - the operator's private note (`originalInput`) is never included.
 * No draft is offered for a call that did not happen or was cancelled.
 */
export type DraftLocale = "en" | "ar";

export interface DraftInput {
  readonly clientName: string;
  readonly record: OutcomeRecord;
  readonly locale: DraftLocale;
  readonly offsetMinutes: number;
}

export interface Draft {
  readonly text: string;
  /** Which recorded facts the text was built from (shown to the operator). */
  readonly basis: ReadonlyArray<"OUTCOME" | "NEXT_STEP" | "CONFIRMED_APPOINTMENT">;
}

export function draftFollowUp({ clientName, record, locale, offsetMinutes }: DraftInput): Draft | null {
  if (record.outcome === "CANCELLED" || record.outcome === "DID_NOT_CALL") return null;

  const basis: Array<Draft["basis"][number]> = ["OUTCOME"];
  const lines: string[] = [];
  const nextStep = record.nextStep !== null && record.nextStep.trim() !== "" ? record.nextStep : null;
  const appointment = record.nextAction?.kind === "CLIENT_CONFIRMED_APPOINTMENT" ? record.nextAction : null;

  if (locale === "ar") {
    lines.push(`مرحبًا ${clientName}،`);
    lines.push(record.outcome === "SPOKE" ? "شكرًا على وقتك في مكالمتنا." : "حاولت الاتصال بك ولم أتمكن من الوصول إليك.");
    if (nextStep) {
      basis.push("NEXT_STEP");
      lines.push(`الخطوة التالية: ${nextStep}`);
    }
    if (appointment) {
      basis.push("CONFIRMED_APPOINTMENT");
      lines.push(`أؤكد موعدنا المتفق عليه: ${formatLocal(appointment.at, offsetMinutes)}.`);
    }
    lines.push(record.outcome === "SPOKE" ? "سأتواصل معك مرة أخرى." : "يسعدني أن تردّ عليّ عندما يناسبك.");
    lines.push("— [اسمك]");
  } else {
    lines.push(`Hello ${clientName},`);
    lines.push(record.outcome === "SPOKE" ? "Thank you for your time on our call." : "I tried to reach you and could not get through.");
    if (nextStep) {
      basis.push("NEXT_STEP");
      lines.push(`Next step: ${nextStep}`);
    }
    if (appointment) {
      basis.push("CONFIRMED_APPOINTMENT");
      lines.push(`Confirming the appointment we agreed: ${formatLocal(appointment.at, offsetMinutes)}.`);
    }
    lines.push(record.outcome === "SPOKE" ? "I will be in touch again." : "Please let me know a good time to talk.");
    lines.push("— [your name]");
  }
  return { text: lines.join("\n"), basis };
}
