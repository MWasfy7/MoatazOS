"use client";

import { useMemo, useState } from "react";
import { draftFollowUp, type OutcomeRecord } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useFeedback } from "./Feedback";
import { BUTTON, FIELD } from "./ui";

type CopyState = "idle" | "copied" | "failed";

/**
 * A follow-up draft the operator must approve before it can be copied. Donna has no
 * send capability at all: the operator copies the text and sends it from their own app.
 * Approval is bound to the exact text: any edit withdraws it.
 *
 * `idSuffix` keeps test ids unique when the same record's draft is offered in two places.
 */
export function DraftCard({
  callId,
  clientName,
  record,
  offsetMinutes,
  idSuffix = "",
  defaultOpen = false,
}: {
  callId: string;
  clientName: string;
  record: OutcomeRecord;
  offsetMinutes: number;
  idSuffix?: string;
  defaultOpen?: boolean;
}) {
  const { dict, locale } = useLocale();
  const { notify } = useFeedback();
  const copy = dict.donna.draft;
  const draft = useMemo(() => draftFollowUp({ clientName, record, locale, offsetMinutes }), [clientName, record, locale, offsetMinutes]);
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState<string | null>(null);
  const [approvedText, setApprovedText] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const current = text ?? draft?.text ?? "";
  const approved = approvedText !== null && approvedText === current;
  const edited = approvedText !== null && approvedText !== current;
  const id = `${callId}${idSuffix}`;

  return (
    <div className="space-y-2 border-t border-neutral-800 pt-3" data-testid={`donna-draft-${id}`} dir="auto">
      <button
        type="button"
        className={BUTTON}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        {open ? copy.hide : copy.show}
      </button>

      {open && draft === null ? <p className="text-sm text-neutral-400">{copy.none}</p> : null}

      {open && draft !== null ? (
        <div className="donna-pop space-y-2">
          <h4 className="text-sm font-semibold text-amber-200">{copy.title}</h4>
          <p className="rounded-lg border border-rose-900/70 bg-rose-950/20 p-2 text-xs text-rose-100">{copy.notSent}</p>
          <p className="text-xs text-neutral-400">{copy.template}</p>
          <label className="block text-sm text-neutral-300">
            {copy.textLabel}
            <textarea
              value={current}
              onChange={(e) => {
                setText(e.target.value);
                setCopyState("idle");
              }}
              rows={7}
              dir="auto"
              className={FIELD}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BUTTON}
              disabled={approved || current.trim() === ""}
              onClick={() => {
                setApprovedText(current);
                setCopyState("idle");
              }}
            >
              {copy.approve}
            </button>
            <button
              type="button"
              className={BUTTON}
              disabled={!approved}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(current);
                  setCopyState("copied");
                  notify(copy.copiedToast);
                } catch {
                  setCopyState("failed");
                }
              }}
            >
              {copy.copy}
            </button>
          </div>
          {approved ? <p role="status" className="text-sm text-emerald-300" data-testid={`donna-draft-approved-${id}`}>{copy.approved}</p> : null}
          {edited ? <p role="status" className="text-sm text-amber-300">{copy.edited}</p> : null}
          {copyState === "copied" ? <p role="status" className="text-sm text-emerald-300" data-testid={`donna-draft-copied-${id}`}>{copy.copied}</p> : null}
          {copyState === "failed" ? <p role="alert" className="text-sm text-amber-300">{copy.copyFailed}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
