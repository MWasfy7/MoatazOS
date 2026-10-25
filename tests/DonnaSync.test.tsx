import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DonnaBanner } from "@/components/donna/DonnaBanner";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { buildSyntheticCalls, DEMO_POLICY, DonnaStoreError, type DonnaRemote, type DonnaStore } from "@/lib/donna";
import { createMemoryStore } from "@/lib/donna/memoryStore";
import type { SyncConfigResult } from "@/lib/donna/remote/config";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

// Everything below uses a MOCK store and a MOCK auth (no database, no network).
// It proves how the provider and UI behave around acknowledgement, retry,
// conflict and sign-in. It is NOT persistence evidence: that is tests/donna-live.
const NOW = "2026-10-26T12:00:00.000Z";
const ON: SyncConfigResult = { mode: "ON", url: "https://mock.example.test", anonKey: "mock-anon" };

function makeAuth(initial: string | null) {
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

function remoteFor(store: DonnaStore, email: string | null = "owner@example.test"): DonnaRemote {
  return { store, auth: makeAuth(email) };
}

async function seed(store: DonnaStore) {
  for (const call of buildSyntheticCalls(NOW)) await store.upsertCall(call);
}

function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

function SwitchToArabic() {
  const { setLocale } = useLocale();
  return <button type="button" onClick={() => setLocale("ar")}>switch-ar</button>;
}

function mount(remote: DonnaRemote, opts: { config?: SyncConfigResult; prefix?: string } = {}) {
  return render(
    <LocaleProvider>
      <DonnaProvider remote={remote} syncConfig={opts.config ?? ON} clock={() => NOW} newId={ids(opts.prefix ?? "aaaaaaaa")}>
        <SwitchToArabic />
        <DonnaBanner />
        <DonnaInbox />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

async function outcomeRows(store: DonnaStore, callId: string) {
  return (await store.load()).events.filter((e) => e.type === "OUTCOME_RECORDED" && e.callId === callId);
}

async function fillSpoke(user: ReturnType<typeof userEvent.setup>, card: HTMLElement) {
  await user.click(within(card).getByRole("button", { name: "Spoke" }));
  await user.type(within(card).getByLabelText(/What happened/), "Synthetic note");
}

describe("Donna sync mode (MOCK store and auth; not persistence evidence)", () => {
  it("is the memory-only demo by default, and says so", () => {
    render(
      <LocaleProvider>
        <DonnaProvider>
          <DonnaInbox />
        </DonnaProvider>
      </LocaleProvider>,
    );
    expect(screen.getByTestId("donna-sync-off")).toHaveTextContent("Demo mode: memory only");
    expect(screen.getByTestId("donna-sync-off")).toHaveTextContent("lost on reload");
    expect(screen.queryByTestId("donna-sync-on")).not.toBeInTheDocument();
  });

  it("shows nothing but a sign-in form until signed in, and rejects bad credentials", async () => {
    const user = userEvent.setup();
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(store);
    mount(remoteFor(store, null));
    expect(await screen.findByText("Sign in to load your records")).toBeInTheDocument();
    expect(screen.getByTestId("donna-banner-signin")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-unresolved-count")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Client Alpha")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "owner@example.test");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByTestId("donna-sync-error")).toHaveTextContent("Email or password is incorrect.");
    await user.type(screen.getByLabelText("Password"), "correct");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByTestId("donna-sync-ready")).toHaveTextContent("owner@example.test");
    expect(await screen.findByTestId("donna-question-syn-alpha")).toBeInTheDocument();
  });

  it("creates the synthetic planned calls on request (and not again once they exist)", async () => {
    const user = userEvent.setup();
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    mount(remoteFor(store));
    await user.click(await screen.findByRole("button", { name: "Create synthetic planned calls" }));
    expect(await screen.findByTestId("donna-question-syn-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("donna-question-syn-beta")).toBeInTheDocument();
    expect(screen.getByTestId("donna-upcoming-syn-gamma")).toBeInTheDocument();
    expect((await store.load()).calls).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Create synthetic planned calls" })).not.toBeInTheDocument();
  });

  it("shows nothing as saved until the database acknowledges the write", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store: DonnaStore = { ...inner, appendEvent: async (id, event) => { await gate; return inner.appendEvent(id, event); } };
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-saving-syn-alpha")).toHaveTextContent("not saved until the database confirms");
    expect(screen.getByTestId("donna-question-syn-alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument();
    release();
    expect(await screen.findByTestId("donna-record-syn-alpha")).toHaveTextContent("Spoke with the client");
    expect(screen.getByTestId("donna-ack")).toHaveTextContent("confirmed by the database");
    expect(screen.queryByTestId("donna-question-syn-alpha")).not.toBeInTheDocument();
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1);
  });

  it("a failed write leaves the question open and unsaved; the retry reuses the same request id", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    const seen: string[] = [];
    let failures = 1;
    const store: DonnaStore = {
      ...inner,
      appendEvent: async (id, event) => {
        seen.push(id);
        if (failures-- > 0) throw new DonnaStoreError("OFFLINE");
        return inner.appendEvent(id, event);
      },
    };
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-error-syn-alpha")).toHaveTextContent("Could not reach the database");
    expect(screen.getByTestId("donna-question-syn-alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument();
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(0);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-record-syn-alpha")).toBeInTheDocument();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1);
  });

  it("when the acknowledgement is lost but the write landed, the retry is a duplicate, not a second outcome", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    let lose = true;
    const store: DonnaStore = {
      ...inner,
      appendEvent: async (id, event) => {
        const status = await inner.appendEvent(id, event);
        if (lose) {
          lose = false;
          throw new DonnaStoreError("OFFLINE");
        }
        return status;
      },
    };
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-error-syn-alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument(); // still not shown as saved
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1); // it did land
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-record-syn-alpha")).toBeInTheDocument();
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1);
  });

  it("a conflicting outcome from another device is refused, reloaded, and explained", async () => {
    const user = userEvent.setup();
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(store);
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    // Meanwhile another device records a different outcome for the same call.
    await store.appendEvent("bbbbbbbb-0000-4000-8000-000000000001", {
      type: "OUTCOME_RECORDED", callId: "syn-alpha", at: NOW, outcome: "NO_ANSWER", originalInput: "", nextAction: null,
    });
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-sync-notice")).toHaveTextContent("possibly from another device");
    expect(await screen.findByTestId("donna-record-syn-alpha")).toHaveTextContent("No answer");
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument();
    expect(await outcomeRows(store, "syn-alpha")).toHaveLength(1);
  });

  it("a second device on the same account shows the same record, with no duplicate question", async () => {
    const user = userEvent.setup();
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(store);
    const a = mount(remoteFor(store), { prefix: "aaaaaaaa" });
    const cardA = await within(a.container).findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, cardA);
    await user.click(within(cardA).getByRole("button", { name: "Save outcome" }));
    await within(a.container).findByTestId("donna-record-syn-alpha");

    const b = mount(remoteFor(store, "owner@example.test"), { prefix: "bbbbbbbb" });
    const recordB = await within(b.container).findByTestId("donna-record-syn-alpha");
    expect(recordB).toHaveTextContent("Spoke with the client");
    expect(recordB).toHaveTextContent("Synthetic note");
    expect(within(b.container).queryByTestId("donna-question-syn-alpha")).not.toBeInTheDocument();
    expect(within(b.container).getByTestId("donna-unresolved-count")).toHaveTextContent("(1)");
    expect(await outcomeRows(store, "syn-alpha")).toHaveLength(1);
  });

  it("banner dismissal in sync mode writes nothing and resolves nothing", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    let writes = 0;
    const store: DonnaStore = { ...inner, appendEvent: async (id, e) => { writes++; return inner.appendEvent(id, e); } };
    mount(remoteFor(store));
    await screen.findByTestId("donna-question-syn-alpha");
    await user.click(screen.getByRole("button", { name: "Dismiss banner" }));
    expect(writes).toBe(0);
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
  });

  it("falls back to the sign-in form when a write finds the session gone, saving nothing", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    const store: DonnaStore = { ...inner, appendEvent: async () => { throw new DonnaStoreError("NOT_SIGNED_IN"); } };
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByText("Sign in to load your records")).toBeInTheDocument();
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(0);
  });

  it("shows a misconfiguration error and no records or demo data when the config is unsafe", () => {
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    mount(remoteFor(store), { config: { mode: "MISCONFIGURED", issue: "SECRET_KEY_IN_BROWSER_CONFIG" } });
    expect(screen.getByTestId("donna-sync-misconfigured")).toHaveTextContent("secret/service key");
    expect(screen.queryByTestId("donna-unresolved-count")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Client Alpha")).not.toBeInTheDocument();
  });

  it("works in Arabic: sign-in and acknowledgement copy", async () => {
    const user = userEvent.setup();
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(store);
    mount(remoteFor(store, null));
    await screen.findByText("Sign in to load your records");
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    expect(screen.getByText("سجّل الدخول لتحميل سجلاتك")).toBeInTheDocument();
    expect(screen.getByTestId("donna-banner-signin")).toHaveTextContent("دونا: سجّل الدخول");
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "owner@example.test");
    await user.type(screen.getByLabelText("كلمة المرور"), "correct");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await waitFor(() => expect(screen.getByTestId("donna-sync-ready")).toHaveTextContent("owner@example.test"));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await user.click(within(card).getByRole("button", { name: "لم يرد" }));
    await user.click(within(card).getByRole("button", { name: "حفظ النتيجة" }));
    expect(await screen.findByTestId("donna-ack")).toHaveTextContent("أكدته قاعدة البيانات");
  });
});
