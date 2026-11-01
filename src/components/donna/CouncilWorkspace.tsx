"use client";

import { useMemo, useState } from "react";
import { COUNCIL_PROVIDERS, SYNTHETIC_CASE, redactPii, reviewCouncil, type CouncilResponses } from "@/lib/donna/council";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { BUTTON, FIELD } from "./ui";

const empty = (): CouncilResponses => ({ OpenAI: "", Claude: "", Gemini: "", DeepSeek: "" });

export function CouncilWorkspace({ initialCase = SYNTHETIC_CASE, salesGate = null }: { initialCase?: string; salesGate?: { allowed: boolean; reason: string; snapshotId: string } | null }) {
  const { dict } = useLocale();
  const c = dict.council;
  const caseText = initialCase;
  const [source, setSource] = useState("");
  const [responses, setResponses] = useState<CouncilResponses>(empty);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [approvedText, setApprovedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const review = useMemo(() => reviewCouncil(responses, source), [responses, source]);
  const draft = draftText ?? review.draft;
  const redactedCase = redactPii(caseText);
  const approved = approvedText === draft && draft.trim() !== "";
  const outreachBlocked = salesGate !== null && !salesGate.allowed;

  return <main className="mx-auto max-w-3xl space-y-5 pb-24" data-testid="donna-council" dir="auto">
    <header className="rounded-2xl border border-amber-700/40 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5">
      <p className="text-xs uppercase tracking-widest text-amber-300">Donna · AI Council</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">{c.title}</h1>
      <p className="mt-2 text-sm text-neutral-300">{c.description}</p>
      <p className="mt-3 rounded-lg border border-amber-700/40 p-3 text-xs text-amber-100">{c.status}</p>
      {salesGate ? <p className={`mt-3 rounded-lg border p-3 text-sm ${outreachBlocked ? "border-rose-800 bg-rose-950/30 text-rose-100" : "border-emerald-800 bg-emerald-950/20 text-emerald-100"}`} data-testid="council-sales-gate">{c.snapshotLabel} {salesGate.snapshotId}: {salesGate.reason}</p> : null}
    </header>
    <section className="space-y-3 rounded-xl border border-neutral-800 p-4">
      <h2 className="font-semibold text-white">{c.caseTitle}</h2>
      <label className="block text-sm text-neutral-300">{c.caseLabel}<textarea className={FIELD} rows={5} value={caseText} readOnly /></label>
      <button className={BUTTON} type="button" onClick={() => { setReviewed(true); setDraftText(null); setApprovedText(null); }} data-testid="council-review-button">{c.reviewNow}</button>
      <details className="text-xs text-neutral-400"><summary>{c.privacyDetails}</summary>
      <p className="text-xs text-neutral-400">{c.redaction}</p>
      <pre className="whitespace-pre-wrap rounded-lg bg-neutral-950 p-3 text-sm text-neutral-200" data-testid="council-redacted">{redactedCase}</pre>
      <button className={BUTTON} type="button" onClick={() => navigator.clipboard?.writeText(redactedCase).then(() => setCopied(true)).catch(() => setCopied(false))}>{c.copyPrompt}</button>
      {copied ? <span role="status" className="text-xs text-emerald-300">{c.copied}</span> : null}
      </details>
      <label className="block text-sm text-neutral-300">{c.sources}<textarea className={FIELD} rows={3} value={source} onChange={(e) => { setSource(e.target.value); setReviewed(false); setApprovedText(null); }} /></label>
    </section>
    <details className="space-y-3 rounded-xl border border-neutral-800 p-4"><summary className="cursor-pointer text-sm text-neutral-300">{c.manualOptional}</summary>
      <h2 className="font-semibold text-white">{c.responses} · {review.received}/4</h2>
      <div className="grid gap-3 sm:grid-cols-2">{COUNCIL_PROVIDERS.map((provider) => <label key={provider} className="block rounded-xl border border-neutral-800 p-3 text-sm text-neutral-200">{provider}<span className="ms-2 text-xs text-neutral-500">{responses[provider] ? c.pasted : c.waiting}</span><textarea className={FIELD} rows={7} value={responses[provider]} onChange={(e) => setResponses((previous) => ({ ...previous, [provider]: e.target.value }))} aria-label={`${provider} response`} placeholder={c.pasteHere} /></label>)}</div>
    </details>
    {reviewed ? <section className="space-y-3 rounded-xl border border-neutral-800 p-4" data-testid="council-review">
      <h2 className="font-semibold text-white">{c.recommendation}</h2>
      <p className="text-sm text-amber-200">{review.ready ? c.fourCompared : c.localOnly}</p>
      <p className="text-sm text-neutral-200">{outreachBlocked ? c.noAction : review.recommendation}</p>
      <dl className="grid gap-2 text-sm text-neutral-300 sm:grid-cols-2"><div><dt className="text-amber-300">{c.psychology}</dt><dd>{review.psychology}</dd></div><div><dt className="text-amber-300">{c.blocker}</dt><dd>{review.blocker}</dd></div><div><dt className="text-amber-300">{c.leverage}</dt><dd>{review.leverage}</dd></div><div><dt className="text-amber-300">{c.micro}</dt><dd>{review.microCommitment}</dd></div><div><dt className="text-amber-300">{c.risk}</dt><dd>{review.pushRisk}</dd></div><div><dt className="text-amber-300">{c.evidence}</dt><dd>{review.evidenceWarning}</dd></div></dl>
      <h3 className="font-semibold text-white">{c.benchmark}</h3><p className="text-xs text-neutral-400">{c.benchmarkNote}</p>
      <ul className="space-y-2 text-sm">{review.scores.map((item) => <li key={item.provider} className="rounded-lg bg-neutral-950 p-2 text-neutral-200"><strong>{item.provider}: {item.score}/10</strong>{item.flags.length ? ` · ${item.flags.join("; ")}` : ""}{responses[item.provider] ? <p className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap border-t border-neutral-800 pt-2 text-neutral-400" dir="auto">{responses[item.provider]}</p> : null}</li>)}</ul>
    </section> : null}
    {reviewed && !outreachBlocked ? <section className="space-y-3 rounded-xl border border-amber-800/50 p-4">
      <h2 className="font-semibold text-white">{c.draft}</h2>
      <p className="text-xs text-amber-200">{c.notSent}</p>
      <textarea className={FIELD} rows={4} value={draft} onChange={(e) => setDraftText(e.target.value)} aria-label={c.draft} />
      <div className="flex gap-2"><button type="button" className={BUTTON} onClick={() => setApprovedText(draft)} disabled={!draft.trim()}>{c.approve}</button><button type="button" className={BUTTON} disabled={!approved} onClick={() => navigator.clipboard?.writeText(draft)}>{c.copyDraft}</button></div>
      <p role="status" className="text-xs text-neutral-300">{approved ? c.approved : c.approvalNeeded}</p>
    </section> : null}
  </main>;
}
