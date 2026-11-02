"use client";

import { draftFromTranscript, reviewVoiceDraft } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { BUTTON } from "./ui";

/**
 * DON-03 review step: reads the operator's own note (typed or dictated) and shows what Donna
 * would suggest. It is a proposal only: it changes nothing by itself, and the only thing it can
 * offer is an internal reminder date, never a client appointment. Restraint is shown first.
 */
export function VoiceReviewPanel({
  note,
  callId,
  at,
  onUseDate,
}: {
  note: string;
  callId: string;
  at: string;
  onUseDate: (date: string) => void;
}) {
  const { dict } = useLocale();
  const copy = dict.donna.voiceReview;
  if (note.trim() === "") return null;
  const draft = draftFromTranscript(note, callId, at);
  const { decision } = reviewVoiceDraft(draft);
  const restrained = decision === "NO_ACTION";
  const date = decision === "PROPOSE_INTERNAL_FOLLOW_UP" ? draft.nextAction?.date : undefined;
  return (
    <section
      className={`space-y-2 rounded-xl border p-3 text-sm ${restrained ? "border-rose-500 bg-rose-950/40 text-rose-100" : "border-neutral-700 text-neutral-300"}`}
      dir="auto"
      data-testid="donna-voice-review"
      data-decision={decision}
    >
      <h5 className="text-xs font-semibold uppercase tracking-wide text-amber-200">{copy.title}</h5>
      <p role={restrained ? "alert" : "status"} className={restrained ? "font-semibold" : undefined}>{copy.verdict[decision]}</p>
      {date ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>{copy.suggestedDate}: <bdi dir="ltr">{date}</bdi></span>
          <button type="button" className={BUTTON} onClick={() => onUseDate(date)}>{copy.useDate}</button>
        </div>
      ) : null}
      <p className="text-xs text-neutral-400">{copy.appointmentNever} {copy.note}</p>
    </section>
  );
}
