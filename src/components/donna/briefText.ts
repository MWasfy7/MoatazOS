import { formatLocal, parseAmount, type BriefLine, type ClientWants } from "@/lib/donna";
import type { Dictionary } from "@/lib/i18n/en";

type Copy = Dictionary["donna"]["brief"];

/** Keeps the operator's own words (often another language) in one piece inside RTL or LTR text. */
export const isolate = (text: string) => `⁨"${text}"⁩`;
/** Same, without quote marks: for values such as an amount or a place name. */
export const keep = (text: string) => `⁨${text}⁩`;

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/** An EGP amount in the reader's language ("4.5M EGP", "4.5 مليون جنيه"). */
export function moneyText(egp: number, copy: Copy): string {
  const trim = (n: number) => String(Math.round(n * 100) / 100);
  return egp >= 1_000_000 ? fill(copy.money.million, { n: trim(egp / 1_000_000) }) : fill(copy.money.thousand, { n: trim(egp / 1_000) });
}

export function wantsText(wants: ClientWants, copy: Copy): string {
  const budget = wants.budget ? parseAmount(wants.budget) : null;
  const parts = [
    wants.unit ? keep(wants.unit) : null,
    wants.area ? fill(copy.parts.area, { v: keep(wants.area) }) : null,
    wants.budget ? fill(copy.parts.budget, { v: keep(budget !== null ? moneyText(budget, copy) : wants.budget) }) : null,
    wants.payment ? copy.parts[wants.payment] : null,
    wants.purpose ? copy.parts[wants.purpose] : null,
  ].filter(Boolean);
  return parts.length ? fill(copy.wants, { parts: parts.join(copy.join) }) : "";
}

export function lineText(line: BriefLine, copy: Copy, client: string, offset: number): string {
  switch (line.kind) {
    case "HOLD_OFF":
      return fill(line.reason === "ASKED_FOR_SPACE" ? copy.lines.HOLD_OFF_ASKED_FOR_SPACE : copy.lines.HOLD_OFF_UNANSWERED, { client, count: line.count });
    case "PROMISE_OVERDUE":
      return fill(copy.lines.PROMISE_OVERDUE, { client, text: isolate(line.text), days: line.days });
    case "PROMISE_TODAY":
      return fill(copy.lines.PROMISE_TODAY, { client, text: isolate(line.text) });
    case "OUTCOME_MISSING":
      return fill(copy.lines.OUTCOME_MISSING, { client });
    case "GOING_COLD":
      return fill(copy.lines.GOING_COLD, { client, days: line.days });
    case "CALL_TODAY":
      return [
        fill(copy.lines.CALL_TODAY, { client, time: formatLocal(line.at, offset).slice(-5) }),
        wantsText(line.wants, copy),
        line.openPromise ? fill(copy.bringUp, { text: isolate(line.openPromise) }) : "",
      ]
        .filter(Boolean)
        .join(" ");
    case "MISSING_INFO":
      return fill(copy.lines.MISSING_INFO, { client, field: copy.fields[line.field] });
  }
}
