"use client";

import type { InsufficientEvidenceSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Never invents a next step to avoid an empty-feeling panel, and
 * never converts an evidence gap into a seller task ("go find out
 * X"). It states plainly what is known, what is missing, and what
 * would make review stronger - nothing more.
 */
export function InsufficientEvidencePanel({ snapshot }: { snapshot: InsufficientEvidenceSnapshot }) {
  const { dict } = useLocale();
  const { insufficiency } = snapshot;
  return (
    <section className="rounded-lg border border-amber-900 bg-amber-950/10 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.known}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-200">
            {insufficiency.known.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.missing}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-200">
            {insufficiency.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-amber-900/60 pt-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.unknownClasses}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {insufficiency.unknownEvidenceClasses.map((cls) => (
            <span key={cls} className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
              {cls}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          {dict.decisionCard.strongerReviewWouldRequire}
        </p>
        <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
          {insufficiency.strongerReviewWouldRequire.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
