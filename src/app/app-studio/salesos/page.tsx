"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { OPPORTUNITIES } from "@/lib/fixtures";
import { OpportunityList } from "@/components/salesos/OpportunityList";

export default function SalesOSCommandCenterPage() {
  const { dict } = useLocale();

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_1fr]">
      <section aria-label={dict.commandCenter.opportunityListTitle}>
        <h1 className="mb-3 text-lg font-semibold text-neutral-50">{dict.commandCenter.title}</h1>
        <p className="mb-4 text-xs uppercase tracking-widest text-neutral-500">
          {dict.commandCenter.opportunityListTitle}
        </p>
        <OpportunityList opportunities={OPPORTUNITIES} />
      </section>

      <section className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
        <p className="max-w-sm text-sm text-neutral-500">{dict.commandCenter.selectPrompt}</p>
      </section>
    </div>
  );
}
