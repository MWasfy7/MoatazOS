"use client";

import { useState, type ChangeEvent } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  createImportPreview,
  parseCrmCsv,
  parseWhatsappExport,
  SYNTHETIC_CRM_CSV,
  SYNTHETIC_WHATSAPP_EXPORT,
  type ImportPreview,
  type ImportResult,
} from "@/lib/realInput";

type InputKind = "CRM" | "WHATSAPP";

interface PreviewState {
  fileName: string;
  preview: ImportPreview;
  realEstateContextCount: number;
}

export function RealInputWorkspace() {
  const { dict } = useLocale();
  const [kind, setKind] = useState<InputKind>("CRM");
  const [organizationId, setOrganizationId] = useState("preview-org");
  const [salesFloorId, setSalesFloorId] = useState("preview-floor");
  const [timezoneOffset, setTimezoneOffset] = useState("+02:00");
  const [leadId, setLeadId] = useState("lead-preview-001");
  const [buyerAlias, setBuyerAlias] = useState("Buyer Synth");
  const [repAlias, setRepAlias] = useState("Rep Synth");
  const [state, setState] = useState<PreviewState | null>(null);

  const parse = (content: string, fileName: string) => {
    const context = {
      organizationId,
      salesFloorId,
      sourceId: fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "local-preview",
      defaultTimezoneOffset: timezoneOffset,
    };
    const result: ImportResult = kind === "CRM"
      ? parseCrmCsv(content, context)
      : parseWhatsappExport(content, {
          ...context,
          dateOrder: "DMY",
          participants: [
            { aliases: [buyerAlias], actorId: "buyer-preview", actorRole: "BUYER", leadId, direction: "INBOUND" },
            { aliases: [repAlias], actorId: "rep-preview", actorRole: "REP", leadId, direction: "OUTBOUND" },
          ],
        });
    setState({
      fileName,
      preview: createImportPreview(result),
      realEstateContextCount: Object.keys(result.realEstateByEventId).length,
    });
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const expectedExtension = kind === "CRM" ? ".csv" : ".txt";
    if (!file.name.toLowerCase().endsWith(expectedExtension)) {
      setState({
        fileName: file.name,
        realEstateContextCount: 0,
        preview: {
          status: "REJECTED",
          acceptedCount: 0,
          duplicateCount: 0,
          rejectedCount: 1,
          events: [],
          issues: [{ severity: "ERROR", code: "UNSAFE_FILE_TYPE", message: dict.realInput.invalidFileType }],
        },
      });
      return;
    }
    if (file.size > 5_000_000) {
      setState({
        fileName: file.name,
        realEstateContextCount: 0,
        preview: {
          status: "REJECTED",
          acceptedCount: 0,
          duplicateCount: 0,
          rejectedCount: 1,
          events: [],
          issues: [{ severity: "ERROR", code: "INPUT_TOO_LARGE", message: dict.realInput.fileTooLarge }],
        },
      });
      return;
    }
    parse(await file.text(), file.name);
  };

  const chooseKind = (nextKind: InputKind) => {
    setKind(nextKind);
    setState(null);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6" data-testid="real-input-workspace">
      <header className="overflow-hidden rounded-2xl border border-sky-950 bg-[radial-gradient(circle_at_top_right,_rgba(14,116,144,0.22),_transparent_42%),linear-gradient(135deg,_rgba(10,10,10,0.98),_rgba(3,24,31,0.94))] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">{dict.realInput.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-50">{dict.realInput.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">{dict.realInput.description}</p>
        <p className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/25 px-3 py-2 text-xs text-amber-200">
          {dict.realInput.memoryOnlyBoundary}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="grid grid-cols-2 gap-2" aria-label={dict.realInput.sourceType}>
            {(["CRM", "WHATSAPP"] as const).map((source) => (
              <button
                key={source}
                type="button"
                aria-pressed={kind === source}
                onClick={() => chooseKind(source)}
                className={`min-h-11 rounded-md border px-3 text-sm font-medium ${kind === source ? "border-sky-700 bg-sky-950/60 text-sky-100" : "border-neutral-800 text-neutral-400"}`}
              >
                {source === "CRM" ? dict.realInput.crmCsv : dict.realInput.whatsappExport}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <TextField label={dict.realInput.organizationId} value={organizationId} onChange={setOrganizationId} />
            <TextField label={dict.realInput.salesFloorId} value={salesFloorId} onChange={setSalesFloorId} />
            <TextField label={dict.realInput.timezoneOffset} value={timezoneOffset} onChange={setTimezoneOffset} />
            {kind === "WHATSAPP" ? (
              <>
                <TextField label={dict.realInput.leadId} value={leadId} onChange={setLeadId} />
                <TextField label={dict.realInput.buyerAlias} value={buyerAlias} onChange={setBuyerAlias} />
                <TextField label={dict.realInput.repAlias} value={repAlias} onChange={setRepAlias} />
              </>
            ) : null}
          </div>

          <label className="block text-xs font-medium text-neutral-300">
            {dict.realInput.chooseFile}
            <input
              key={kind}
              type="file"
              accept={kind === "CRM" ? ".csv,text/csv" : ".txt,text/plain"}
              onChange={handleFile}
              className="mt-2 block w-full text-xs text-neutral-400 file:me-3 file:min-h-11 file:rounded-md file:border file:border-neutral-700 file:bg-neutral-900 file:px-3 file:text-neutral-100"
            />
          </label>

          <button
            type="button"
            onClick={() => parse(kind === "CRM" ? SYNTHETIC_CRM_CSV : SYNTHETIC_WHATSAPP_EXPORT, kind === "CRM" ? "synthetic-crm.csv" : "synthetic-whatsapp.txt")}
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-200 hover:border-neutral-500"
          >
            {dict.realInput.loadSynthetic}
          </button>
        </div>

        <div className="min-h-[420px] rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
          {!state ? (
            <div className="flex min-h-[380px] items-center justify-center text-center text-sm text-neutral-500">
              <p className="max-w-sm">{dict.realInput.emptyPreview}</p>
            </div>
          ) : (
            <ImportPreviewPanel state={state} />
          )}
        </div>
      </div>
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-medium text-neutral-300">
      {label}
      <input
        type="text"
        dir="auto"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-100"
      />
    </label>
  );
}

function ImportPreviewPanel({ state }: { state: PreviewState }) {
  const { dict } = useLocale();
  const { preview } = state;
  return (
    <div className="space-y-5" data-testid="import-preview" data-import-status={preview.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">{dict.realInput.maskedPreview}</p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-100" dir="auto">{state.fileName}</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${preview.status === "ACCEPTED" ? "border-emerald-800 bg-emerald-950/40 text-emerald-200" : "border-rose-800 bg-rose-950/40 text-rose-200"}`}>
          {preview.status === "ACCEPTED" ? dict.realInput.accepted : dict.realInput.rejected}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label={dict.realInput.acceptedEvents} value={preview.acceptedCount} />
        <Metric label={dict.realInput.duplicates} value={preview.duplicateCount} />
        <Metric label={dict.realInput.rejectedRecords} value={preview.rejectedCount} />
        <Metric label={dict.realInput.realEstateContexts} value={state.realEstateContextCount} />
      </dl>

      {preview.issues.length > 0 ? (
        <section aria-label={dict.realInput.validationIssues}>
          <h3 className="text-sm font-semibold text-neutral-200">{dict.realInput.validationIssues}</h3>
          <ul className="mt-2 space-y-2">
            {preview.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.line ?? "global"}-${index}`} className="rounded-md border border-neutral-800 bg-neutral-900/70 px-3 py-2 text-xs text-neutral-300">
                <strong className={issue.severity === "ERROR" ? "text-rose-300" : "text-amber-300"}>{issue.code}</strong>
                {issue.line ? ` · ${dict.realInput.line} ${issue.line}` : ""}: {issue.severity === "ERROR" ? dict.realInput.errorIssue : dict.realInput.warningIssue}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {preview.events.length > 0 ? (
        <section aria-label={dict.realInput.timeline}>
          <h3 className="text-sm font-semibold text-neutral-200">{dict.realInput.timeline}</h3>
          <ol className="mt-3 space-y-3">
            {preview.events.map((event) => (
              <li key={event.eventId} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
                  <span>{event.channel} · {event.direction} · {event.eventType}</span>
                  <time dateTime={event.occurredAt}>{event.occurredAt}</time>
                </div>
                <p className="mt-2 text-sm text-neutral-100" dir="auto">{event.textOrSummary || dict.realInput.noSummary}</p>
                <p className="mt-2 text-[11px] text-neutral-500" dir="auto">{event.leadId} · {event.actorRole} · {event.actorId}</p>
                <p className="mt-2 break-all font-mono text-[11px] text-sky-300" dir="ltr">{event.sourceRef}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="border-t border-neutral-800 pt-3 text-xs text-neutral-500">{dict.realInput.noDecisionAuthority}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/50 p-3">
      <dt className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-neutral-100">{value}</dd>
    </div>
  );
}
