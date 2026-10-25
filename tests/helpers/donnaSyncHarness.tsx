import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DonnaBanner } from "@/components/donna/DonnaBanner";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { buildSyntheticCalls, type DonnaRemote, type DonnaStore } from "@/lib/donna";
import type { SyncConfigResult } from "@/lib/donna/remote/config";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

/** Shared MOCK harness (mock store, mock auth) for provider-level tests. Not persistence evidence. */
export const NOW = "2026-10-26T12:00:00.000Z";
export const ON: SyncConfigResult = { mode: "ON", url: "https://mock.example.test", anonKey: "mock-anon" };

export const minutesLater = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

export function makeAuth(initial: string | null) {
  let email = initial;
  const listeners = new Set<(e: string | null) => void>();
  const notify = () => listeners.forEach((l) => l(email));
  return {
    currentEmail: async () => email,
    signInWithPassword: async (e: string, password: string) => {
      if (password !== "correct") return "INVALID_CREDENTIALS" as const;
      email = e;
      notify();
      return null;
    },
    signOut: async () => {
      email = null;
      notify();
    },
    onChange: (l: (e: string | null) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function remoteFor(store: DonnaStore, email: string | null = "owner@example.test"): DonnaRemote {
  return { store, auth: makeAuth(email) };
}

export async function seed(store: DonnaStore) {
  for (const call of buildSyntheticCalls(NOW)) await store.upsertCall(call);
}

export function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

export function mount(remote: DonnaRemote, opts: { config?: SyncConfigResult; prefix?: string; clock?: () => string } = {}) {
  return render(
    <LocaleProvider>
      <DonnaProvider remote={remote} syncConfig={opts.config ?? ON} clock={opts.clock ?? (() => NOW)} newId={ids(opts.prefix ?? "aaaaaaaa")}>
        <DonnaBanner />
        <DonnaInbox />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

export async function outcomeRows(store: DonnaStore, callId: string) {
  return (await store.load()).events.filter((e) => e.type === "OUTCOME_RECORDED" && e.callId === callId);
}

export async function fillSpoke(user: ReturnType<typeof userEvent.setup>, card: HTMLElement, note = "Synthetic note") {
  await user.click(within(card).getByRole("button", { name: "Spoke" }));
  await user.type(within(card).getByLabelText(/What happened/), note);
}
