"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Opportunity } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionStateBadge, FreshnessBadge } from "./Badges";

export function OpportunityList({ opportunities }: { opportunities: Opportunity[] }) {
  const { dict } = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={dict.commandCenter.opportunityListTitle} className="space-y-1.5">
      {opportunities.map((opp) => {
        const href = `/app-studio/salesos/opportunity/${opp.opportunityId}`;
        const active = pathname === href;
        return (
          <Link
            key={opp.opportunityId}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`block min-h-11 rounded-md border p-3 ${
              active ? "border-neutral-600 bg-neutral-900" : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-neutral-100" dir="auto">
                {opp.buyerAlias}
              </span>
              <DecisionStateBadge state={opp.decisionState} size="sm" />
            </div>
            {opp.freshness !== "CURRENT" ? (
              <div className="mt-1.5">
                <FreshnessBadge freshness={opp.freshness} />
              </div>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
