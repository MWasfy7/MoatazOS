"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Always-visible demo-data indicator. Never rendered conditionally
 * based on a failed live call - this milestone has no live API, so it
 * is always shown, honestly, rather than implying a live mode exists
 * that doesn't. */
export function DemoModeBadge() {
  const { dict } = useLocale();
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-950/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
      {dict.demo.badge}
    </span>
  );
}
