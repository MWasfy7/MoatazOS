"use client";

import Link from "next/link";
import { DONNA_ENABLED } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "./DonnaProvider";

/**
 * Shown when the app opens, before anything else, whenever client
 * questions are unresolved. Dismissing hides the banner only.
 */
export function DonnaBanner() {
  const { dict } = useLocale();
  const { inbox, bannerHidden, dismissBanner } = useDonna();
  const copy = dict.donna;
  const count = inbox.unresolved.length;

  if (!DONNA_ENABLED || count === 0) return null;

  if (bannerHidden) {
    return (
      <p className="border-b border-neutral-900 px-4 py-2 text-xs text-amber-300" data-testid="donna-banner-dismissed" dir="auto">
        {copy.banner.dismissedNote}
      </p>
    );
  }

  return (
    <section
      role="region"
      aria-label={copy.banner.title.replace("{count}", String(count))}
      className="border-b border-amber-800 bg-amber-950/40 px-4 py-3"
      data-testid="donna-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div dir="auto">
          <p className="text-sm font-semibold text-amber-100">{copy.banner.title.replace("{count}", String(count))}</p>
          <p className="text-xs text-amber-200/80">{copy.banner.body}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app-studio/donna"
            className="inline-flex min-h-11 items-center rounded-md bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-600"
          >
            {copy.banner.open}
          </Link>
          <button
            type="button"
            onClick={dismissBanner}
            className="min-h-11 rounded-md border border-amber-800 px-4 text-sm text-amber-100 hover:bg-amber-900/50"
          >
            {copy.banner.dismiss}
          </button>
        </div>
      </div>
    </section>
  );
}
