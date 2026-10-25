"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "./DonnaProvider";

const BUTTON =
  "min-h-11 rounded-md border border-neutral-700 px-4 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";
const FIELD = "mt-1 block min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100";

/** Says plainly which mode Donna is in, and gates everything behind sign-in when sync is on. */
export function DonnaSyncPanel() {
  const { dict } = useLocale();
  const { sync, state, signIn, signOut, refresh, seedSyntheticCalls } = useDonna();
  const copy = dict.donna;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<keyof typeof copy.errors | null>(null);

  if (sync.mode === "OFF") {
    return (
      <section className="rounded-xl border border-amber-800 bg-amber-950/30 p-4" data-testid="donna-sync-off" dir="auto">
        <h2 className="text-sm font-semibold text-amber-100">{copy.sync.offTitle}</h2>
        <p className="mt-1 text-sm text-amber-200/80">{copy.sync.offBody}</p>
      </section>
    );
  }

  if (sync.mode === "MISCONFIGURED") {
    return (
      <section role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-4" data-testid="donna-sync-misconfigured" dir="auto">
        <h2 className="text-sm font-semibold text-rose-100">{copy.sync.misconfiguredTitle}</h2>
        <p className="mt-1 text-sm text-rose-200">{sync.issue ? copy.sync.issues[sync.issue] : null}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-neutral-800 p-4" data-testid="donna-sync-on">
      {sync.phase === "LOADING" ? (
        <p role="status" className="text-sm text-neutral-300" dir="auto">{copy.sync.loading}</p>
      ) : null}

      {sync.phase === "SIGNED_OUT" ? (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            const code = await signIn(email, password);
            setPassword("");
            if (code) setError(code);
          }}
        >
          <h2 className="text-sm font-semibold text-neutral-100" dir="auto">{copy.sync.signInTitle}</h2>
          <p className="text-sm text-neutral-400" dir="auto">{copy.sync.signInBody}</p>
          <label className="block text-sm text-neutral-300">
            {copy.sync.email}
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} dir="ltr" />
          </label>
          <label className="block text-sm text-neutral-300">
            {copy.sync.password}
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} dir="ltr" />
          </label>
          <button type="submit" disabled={sync.busy} className={`${BUTTON} bg-amber-700 hover:bg-amber-600`}>{copy.sync.signIn}</button>
        </form>
      ) : null}

      {sync.phase === "READY" ? (
        <div className="space-y-2" dir="auto">
          <h2 className="text-sm font-semibold text-emerald-200">{copy.sync.readyTitle}</h2>
          <p className="text-sm text-neutral-300" data-testid="donna-sync-ready">
            {copy.sync.readyBody.replace("{email}", sync.email ?? "")}
          </p>
          {sync.busy ? <p role="status" className="text-sm text-amber-300">{copy.sync.saving}</p> : null}
          {sync.lastAckAt && !sync.busy ? (
            <p role="status" className="text-sm text-emerald-300" data-testid="donna-ack">
              {copy.sync.savedNotice.replace("{time}", sync.lastAckAt.slice(0, 19).replace("T", " "))}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={sync.busy} className={BUTTON} onClick={() => void refresh()}>{copy.sync.refresh}</button>
            <button type="button" disabled={sync.busy} className={BUTTON} onClick={() => void signOut()}>{copy.sync.signOut}</button>
          </div>
          {state.calls.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-neutral-400">{copy.sync.seedHint}</p>
              <button
                type="button"
                disabled={sync.busy}
                className={BUTTON}
                onClick={async () => {
                  const code = await seedSyntheticCalls();
                  setError(code);
                }}
              >
                {copy.sync.seed}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {sync.phase === "ERROR" ? (
        <div className="space-y-2" dir="auto">
          <p role="alert" className="text-sm text-rose-300">{copy.sync.loadFailed} {sync.loadError ? copy.errors[sync.loadError] : null}</p>
          <button type="button" disabled={sync.busy} className={BUTTON} onClick={() => void refresh()}>{copy.sync.retry}</button>
        </div>
      ) : null}

      {sync.recovery ? (
        <p role="alert" className="text-sm text-amber-300" dir="auto" data-testid="donna-recovery">
          {copy.errors.WRITE_CONFIRMED_REFRESH_FAILED}
        </p>
      ) : null}

      {sync.notice ? (
        <p role="alert" className="text-sm text-amber-300" dir="auto" data-testid="donna-sync-notice">
          {copy.errors[sync.notice]}
        </p>
      ) : null}

      {error ? <p role="alert" className="text-sm text-rose-300" dir="auto" data-testid="donna-sync-error">{copy.errors[error]}</p> : null}
    </section>
  );
}
