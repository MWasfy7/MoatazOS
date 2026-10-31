"use client";

import { AI_COST_THIS_SESSION_USD, AI_MODEL_CALLS_THIS_SESSION, AI_MONTHLY_CAP_USD, AI_STATUS } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Says plainly which models are connected (none) and what spending is possible (none). */
export function AiStatusPanel() {
  const { dict } = useLocale();
  const copy = dict.donna.ai;
  const anyConnected = AI_STATUS.some((p) => p.id !== "templates" && p.state === "ACTIVE");
  return (
    <section aria-labelledby="donna-ai" className="space-y-2 rounded-xl border border-neutral-800 p-4" data-testid="donna-ai-status" dir="auto">
      <h2 id="donna-ai" className="text-sm font-semibold text-neutral-200">{copy.title}</h2>
      {!anyConnected ? <p className="text-sm text-neutral-300">{copy.summary}</p> : null}
      <ul className="space-y-1 text-sm text-neutral-300">
        {AI_STATUS.map((p) => (
          <li key={p.id} data-testid={`donna-ai-${p.id}`} data-state={p.state}>
            {copy.providers[p.id]}: <span className={p.state === "ACTIVE" ? "text-emerald-300" : "text-neutral-400"}>{copy.states[p.state]}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-neutral-300">
        {copy.calls}: <bdi dir="ltr">{AI_MODEL_CALLS_THIS_SESSION}</bdi> · {copy.cost}: <bdi dir="ltr">${AI_COST_THIS_SESSION_USD.toFixed(2)}</bdi> · {copy.cap}:{" "}
        <bdi dir="ltr">${AI_MONTHLY_CAP_USD.toFixed(2)}</bdi>
      </p>
      <p className="text-xs text-neutral-400">{copy.guard}</p>
      <p className="text-xs text-neutral-400">{copy.subscriptions}</p>
    </section>
  );
}
