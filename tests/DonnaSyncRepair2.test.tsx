import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { DEMO_POLICY, type DonnaStore } from "@/lib/donna";
import { createMemoryStore } from "@/lib/donna/memoryStore";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { ids, makeAuth, minutesLater, mount, NOW, ON } from "./helpers/donnaSyncHarness";

// MOCK store and MOCK auth: these prove how the provider treats results that arrive after the
// identity changed. They are not persistence evidence.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Donna sync: seeding stops when the identity is invalidated (MOCK)", () => {
  function heldSeedStore() {
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const log = { started: 0 };
    const store: DonnaStore = {
      ...inner,
      upsertCall: async (call) => {
        log.started += 1;
        if (log.started === 1) await gate; // hold account A's FIRST seed write
        return inner.upsertCall(call);
      },
    };
    return { store, log, release: () => release() };
  }

  it("after switching to account B, no further seed write starts once A's held write is released", async () => {
    const user = userEvent.setup();
    const { store, log, release } = heldSeedStore();
    const auth = makeAuth("a@example.test");
    mount({ store, auth });
    await user.click(await screen.findByRole("button", { name: "Create synthetic planned calls" }));
    expect(log.started).toBe(1); // A's first write is in flight and held
    await act(async () => {
      await auth.signInWithPassword("b@example.test", "correct");
    });
    await act(async () => {
      release();
      await tick();
      await tick();
    });
    expect(log.started).toBe(1); // nothing after the invalidated first write
  });

  it("after unmount, no further seed write starts once the held write is released", async () => {
    const user = userEvent.setup();
    const { store, log, release } = heldSeedStore();
    const view = render(
      <LocaleProvider>
        <DonnaProvider remote={{ store, auth: makeAuth("a@example.test") }} syncConfig={ON} clock={() => NOW} newId={ids("dddddddd")}>
          <DonnaInbox />
        </DonnaProvider>
      </LocaleProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Create synthetic planned calls" }));
    expect(log.started).toBe(1);
    view.unmount();
    await act(async () => {
      release();
      await tick();
      await tick();
    });
    expect(log.started).toBe(1);
  });

  it("after sign-out, no further seed write starts", async () => {
    const user = userEvent.setup();
    const { store, log, release } = heldSeedStore();
    const auth = makeAuth("a@example.test");
    mount({ store, auth });
    await user.click(await screen.findByRole("button", { name: "Create synthetic planned calls" }));
    await act(async () => {
      await auth.signOut();
    });
    await act(async () => {
      release();
      await tick();
      await tick();
    });
    expect(log.started).toBe(1);
  });
});

describe("Donna sync: a superseded session lookup never overwrites a newer identity (MOCK)", () => {
  function lookupHarness() {
    let email: string | null = null;
    let resolveLookup!: (value: string | null) => void;
    let firstLookup = true;
    const listeners = new Set<(e: string | null) => void>();
    const notify = (e: string | null) => listeners.forEach((l) => l(e));
    const due = minutesLater(NOW, -180);
    const storeA = createMemoryStore(DEMO_POLICY, () => NOW);
    const storeB = createMemoryStore(DEMO_POLICY, () => NOW);
    const ready = Promise.all([
      storeA.upsertCall({ id: "a-call", clientId: "cl-alpha", dueAt: due }),
      storeB.upsertCall({ id: "b-call", clientId: "cl-beta", dueAt: due }),
    ]);
    const route = () => (email === "a@example.test" ? storeA : storeB);
    const store: DonnaStore = {
      load: async () => {
        await ready;
        return route().load();
      },
      appendEvent: async (id, e) => route().appendEvent(id, e),
      upsertCall: async (c) => route().upsertCall(c),
    };
    const auth = {
      // The FIRST lookup is slow: the app asked while A was signed in and hears back later.
      currentEmail: () => {
        if (firstLookup) {
          firstLookup = false;
          return new Promise<string | null>((resolve) => (resolveLookup = resolve));
        }
        return Promise.resolve(email);
      },
      signInWithPassword: async (e: string, password: string) => {
        if (password !== "correct") return "INVALID_CREDENTIALS" as const;
        email = e;
        notify(e);
        return null;
      },
      signOut: async () => {
        email = null;
        notify(null);
      },
      onChange: (l: (e: string | null) => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
    return { store, auth, resolveLookup: (value: string | null) => resolveLookup(value), notify, setEmail: (e: string | null) => (email = e) };
  }

  it("A's late lookup, after B was adopted by an auth notification, leaves identity and records as B's", async () => {
    const h = lookupHarness();
    mount({ store: h.store, auth: h.auth });
    await screen.findByText("Loading from the database…");
    await act(async () => {
      await h.auth.signInWithPassword("b@example.test", "correct");
    });
    expect(await screen.findByTestId("donna-question-b-call")).toBeInTheDocument();
    expect(screen.getByTestId("donna-sync-ready")).toHaveTextContent("b@example.test");
    await act(async () => {
      h.resolveLookup("a@example.test"); // the superseded answer arrives
      await tick();
      await tick();
    });
    expect(screen.getByTestId("donna-sync-ready")).toHaveTextContent("b@example.test");
    expect(screen.getByTestId("donna-sync-ready")).not.toHaveTextContent("a@example.test");
    expect(screen.getByTestId("donna-question-b-call")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-question-a-call")).not.toBeInTheDocument();
  });

  it("a late 'nobody is signed in' lookup does not sign B out", async () => {
    const h = lookupHarness();
    mount({ store: h.store, auth: h.auth });
    await screen.findByText("Loading from the database…");
    await act(async () => {
      await h.auth.signInWithPassword("b@example.test", "correct");
    });
    await screen.findByTestId("donna-question-b-call");
    await act(async () => {
      h.resolveLookup(null);
      await tick();
      await tick();
    });
    expect(screen.getByTestId("donna-sync-ready")).toHaveTextContent("b@example.test");
    expect(screen.getByTestId("donna-question-b-call")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to load your records")).not.toBeInTheDocument();
  });

  it("a sign-out notification that arrives first wins over a late lookup that still says A", async () => {
    const h = lookupHarness();
    mount({ store: h.store, auth: h.auth });
    await screen.findByText("Loading from the database…");
    await act(async () => {
      h.setEmail(null);
      h.notify(null); // the session is gone (e.g. expired in another tab)
    });
    expect(await screen.findByText("Sign in to load your records")).toBeInTheDocument();
    await act(async () => {
      h.resolveLookup("a@example.test"); // stale
      await tick();
      await tick();
    });
    expect(screen.getByText("Sign in to load your records")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-sync-ready")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-question-a-call")).not.toBeInTheDocument();
  });
});
