"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  captureEvent, createOperatorSession, opportunitiesFromEvents,
  SYNTHETIC_OPERATOR_AS_OF, SYNTHETIC_OPERATOR_OPPORTUNITIES,
  type CaptureKind, type CommandQueueItem, type OperatorSession,
} from "@/lib/operatorRuntime";
import { parseWhatsappExport, type ImportResult, type NormalizedSalesEvent } from "@/lib/realInput";

const CAPTURE_KINDS: CaptureKind[] = [
  "CLIENT_CALLED", "CLIENT_REPLIED", "CLIENT_REQUESTED_OPTIONS", "CLIENT_POSTPONED",
  "MEETING_HAPPENED", "MEETING_SCHEDULED", "BUDGET_CLARIFIED", "PARTNER_APPROVAL_REQUIRED",
  "OBJECTION", "EXPLICIT_REJECTION", "NEW_TIMELINE", "PROMISED_FOLLOWUP",
  "SELLER_COMMITMENT", "EOI", "RESERVATION", "OPERATOR_NOTE",
];

/** Buyer-facing contact only: INTERNAL events are notes and CRM bookkeeping, not contact. */
function lastBuyerContact(events: readonly NormalizedSalesEvent[]): NormalizedSalesEvent | undefined {
  return [...events]
    .filter((event) => event.direction !== "INTERNAL" && !Number.isNaN(Date.parse(event.occurredAt)))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .at(-1);
}

export function MobileFollowUp() {
  const { dict, setLocale } = useLocale();
  const copy = dict.mobileFollowUp;
  const runtime = dict.operatorRuntime;
  const arabicApplied = useRef(false);
  const [session, setSession] = useState<OperatorSession>(() =>
    createOperatorSession("operator-local", SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF));
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"CALL" | "PASTE">("CALL");
  const [kind, setKind] = useState<CaptureKind>("CLIENT_CALLED");
  const [note, setNote] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [chat, setChat] = useState("");
  const [buyerAlias, setBuyerAlias] = useState("");
  const [repAlias, setRepAlias] = useState("");
  const [parsed, setParsed] = useState<ImportResult | null>(null);

  // Arabic-first on entry, using the app's existing locale mechanism.
  useEffect(() => {
    if (arabicApplied.current) return;
    arabicApplied.current = true;
    setLocale("ar");
  }, [setLocale]);

  /** Prefer a translated capture label; otherwise describe the direction rather than leaking a raw code. */
  const contactLabel = (event: NormalizedSalesEvent) =>
    runtime.captureKinds[event.eventType as CaptureKind]
      ?? (event.direction === "INBOUND" ? copy.fromClient : copy.fromYou);

  const rows = useMemo(() => session.queue.map((queueItem) => {
    const opportunity = session.opportunities.find((item) => item.opportunityId === queueItem.opportunityId);
    return { queueItem, contact: opportunity ? lastBuyerContact(opportunity.events) : undefined };
  }), [session]);
  const open = openId ? rows.find((row) => row.queueItem.opportunityId === openId) : undefined;

  const recordCall = () => {
    if (!open) return;
    setSession((current) => captureEvent(current, {
      opportunityId: open.queueItem.opportunityId, kind,
      occurredAt: new Date().toISOString(), operatorId: current.operatorId, note,
    }));
    setNote("");
    setSavedAt(new Date().toISOString());
  };

  const checkChat = () => {
    if (!open) return;
    setParsed(parseWhatsappExport(chat, {
      organizationId: "mobile-session", salesFloorId: "mobile-session", sourceId: "mobile-paste",
      asOf: new Date().toISOString(), defaultTimezoneOffset: "+02:00", dateOrder: "DMY",
      participants: [
        { aliases: [buyerAlias.trim()], actorId: "buyer-mobile", actorRole: "BUYER", leadId: open.queueItem.opportunityId, direction: "INBOUND" },
        { aliases: [repAlias.trim()], actorId: "rep-mobile", actorRole: "REP", leadId: open.queueItem.opportunityId, direction: "OUTBOUND" },
      ],
    }));
  };

  const useParsed = () => {
    if (!parsed || parsed.status !== "ACCEPTED") return;
    const opportunities = opportunitiesFromEvents(parsed.events);
    if (opportunities.length === 0) return;
    setSession(createOperatorSession(session.operatorId, opportunities, new Date().toISOString()));
    setParsed(null); setChat(""); setOpenId(null);
  };

  const closeSheet = () => { setOpenId(null); setParsed(null); setSavedAt(null); };

  return (
    <main data-testid="mobile-follow-up" className="mx-auto min-h-screen w-full max-w-md bg-neutral-950 pb-24">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold text-neutral-50">{copy.title}</h1>
        <p className="mt-1 text-xs leading-5 text-neutral-400">{copy.subtitle}</p>
        <p data-testid="session-only-banner" className="mt-3 rounded-lg border border-amber-900/70 bg-amber-950/25 px-3 py-2 text-[11px] leading-5 text-amber-200">
          <span className="font-semibold">{copy.sessionOnly}.</span> {copy.sessionOnlyDetail}
        </p>
      </header>

      <section className="px-4 pt-4" aria-label={copy.clients}>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{copy.clients} · {rows.length}</h2>
        {rows.length === 0 ? <p className="text-sm text-neutral-500">{copy.noClients}</p> : (
          <ul className="space-y-3">
            {rows.map(({ queueItem, contact }) => (
              <li key={queueItem.queueItemId}>
                <article data-client-card={queueItem.opportunityId} data-queue-reason={queueItem.reasonCode} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold leading-6 text-neutral-100" dir="auto">{queueItem.displayLabel}</h3>
                    <span className="shrink-0 rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[10px] text-neutral-300">
                      {runtime.sections[queueItem.section]}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{copy.lastContact}</dt>
                      <dd data-testid="last-contact" className="mt-0.5 text-neutral-300" dir="auto">
                        {contact
                          ? `${new Date(contact.occurredAt).toLocaleDateString(dict.locale === "ar" ? "ar-EG" : "en-GB")} · ${contactLabel(contact)}`
                          : copy.noContact}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{copy.nextStep}</dt>
                      <dd data-testid="next-step" className="mt-0.5 leading-5 text-neutral-200" dir="auto">{runtime.queueDo[queueItem.section]}</dd>
                    </div>
                  </dl>
                  <button type="button" onClick={() => { setOpenId(queueItem.opportunityId); setTab("CALL"); setSavedAt(null); }}
                    className="mt-4 min-h-12 w-full rounded-xl bg-emerald-400 text-sm font-semibold text-neutral-950">
                    {copy.record}
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 text-[11px] leading-5 text-rose-200">{copy.noExecution}</p>
      </section>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label={copy.record} data-testid="record-sheet"
          className="fixed inset-0 z-30 flex flex-col justify-end bg-black/70">
          <div className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-neutral-700 bg-neutral-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-50" dir="auto">{open.queueItem.displayLabel}</h2>
              <button type="button" onClick={closeSheet} className="min-h-10 rounded-lg border border-neutral-700 px-3 text-xs text-neutral-300">{copy.close}</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["CALL", "PASTE"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value}
                  className={`min-h-11 rounded-xl border text-xs font-semibold ${tab === value ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-neutral-800 bg-neutral-900 text-neutral-400"}`}>
                  {value === "CALL" ? copy.tabCall : copy.tabPaste}
                </button>
              ))}
            </div>

            {tab === "CALL" ? (
              <div className="mt-4 space-y-3" data-testid="call-form">
                <label className="block text-xs text-neutral-400">{copy.callResult}
                  <select value={kind} onChange={(event) => setKind(event.target.value as CaptureKind)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100">
                    {CAPTURE_KINDS.map((value) => <option key={value} value={value}>{runtime.captureKinds[value]}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">{copy.note}
                  <textarea dir="auto" rows={3} value={note} onChange={(event) => setNote(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100" />
                </label>
                <button type="button" onClick={recordCall} className="min-h-12 w-full rounded-xl bg-emerald-400 text-sm font-semibold text-neutral-950">{copy.save}</button>
                {savedAt ? <p data-testid="save-confirm" className="rounded-lg border border-emerald-900/60 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-200">{copy.savedOne} · {copy.sessionOnly}</p> : null}
                <p className="text-[11px] leading-5 text-neutral-500">{runtime.manualBoundary}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3" data-testid="paste-form">
                <label className="block text-xs text-neutral-400">{copy.buyerAlias}
                  <input dir="auto" value={buyerAlias} onChange={(event) => setBuyerAlias(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100" />
                </label>
                <label className="block text-xs text-neutral-400">{copy.repAlias}
                  <input dir="auto" value={repAlias} onChange={(event) => setRepAlias(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100" />
                </label>
                <label className="block text-xs text-neutral-400">{copy.pasteLabel}
                  <textarea dir="auto" rows={5} value={chat} onChange={(event) => setChat(event.target.value)} placeholder={copy.pastePlaceholder}
                    className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-[11px] text-neutral-100" />
                </label>
                <button type="button" onClick={checkChat} disabled={!chat.trim() || !buyerAlias.trim() || !repAlias.trim()}
                  className="min-h-12 w-full rounded-xl border border-sky-800 bg-sky-950/30 text-sm font-semibold text-sky-200 disabled:opacity-40">{copy.check}</button>
                {parsed ? (
                  <div data-testid="paste-result" data-import-status={parsed.status} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                    <p className="text-xs text-neutral-200">
                      {parsed.status === "ACCEPTED" ? copy.accepted : copy.rejected} · {parsed.events.length} {copy.messagesFound} · {parsed.issues.length} {copy.issuesFound}
                    </p>
                    <ul className="space-y-1">
                      {parsed.issues.slice(0, 4).map((issue, index) => (
                        <li key={`${issue.code}-${index}`} className="text-[11px] leading-5 text-neutral-400" dir="auto">{issue.severity} · {issue.code}</li>
                      ))}
                    </ul>
                    {parsed.status === "ACCEPTED" ? (
                      <>
                        <p className="text-[11px] leading-5 text-amber-200">{copy.replaceWarning}</p>
                        <button type="button" onClick={useParsed} className="min-h-12 w-full rounded-xl bg-amber-400 text-sm font-semibold text-neutral-950">{copy.useConversation}</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
