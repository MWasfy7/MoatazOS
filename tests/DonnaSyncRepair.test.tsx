import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { DEMO_POLICY, DonnaStoreError, type DonnaEventInput, type DonnaRemote, type DonnaStore } from "@/lib/donna";
import { createMemoryStore } from "@/lib/donna/memoryStore";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { fillSpoke, ids, makeAuth, minutesLater, mount, NOW, ON, outcomeRows, remoteFor, seed } from "./helpers/donnaSyncHarness";

// MOCK store and MOCK auth throughout: these tests prove how the provider and UI
// behave around uncertain results and identity changes. They are not persistence evidence.

function sentRecorder(inner: DonnaStore, behave: (id: string, event: DonnaEventInput, inner: DonnaStore) => Promise<"CREATED" | "DUPLICATE">) {
  const sent: Array<{ id: string; event: DonnaEventInput }> = [];
  const store: DonnaStore = {
    ...inner,
    appendEvent: async (id, event) => {
      sent.push({ id, event });
      return behave(id, event, inner);
    },
  };
  return { store, sent };
}

describe("Donna sync: a retry re-sends the frozen request (MOCK)", () => {
  it("database commits, the response is lost, the clock advances: the retry is a DUPLICATE with exactly one stored event", async () => {
    const user = userEvent.setup();
    let clockValue = NOW;
    const clock = () => clockValue;
    const inner = createMemoryStore(DEMO_POLICY, clock);
    await seed(inner);
    let lose = true;
    const { store, sent } = sentRecorder(inner, async (id, event, real) => {
      const status = await real.appendEvent(id, event);
      if (lose) {
        lose = false;
        throw new DonnaStoreError("OFFLINE");
      }
      return status;
    });
    mount(remoteFor(store), { clock });
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-error-syn-alpha")).toHaveTextContent("Could not reach the database");
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument();

    clockValue = minutesLater(NOW, 5); // time passes before the user retries
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-record-syn-alpha")).toBeInTheDocument();

    expect(sent).toHaveLength(2);
    expect(sent[1]?.id).toBe(sent[0]?.id);
    expect(sent[1]?.event).toEqual(sent[0]?.event); // the exact payload, `at` included
    expect(sent[0]?.event.at).toBe(NOW);
    expect((await inner.load()).events).toHaveLength(1);
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1);
  });

  it("the same holds for a snooze: `until` is frozen with the request", async () => {
    const user = userEvent.setup();
    let clockValue = NOW;
    const clock = () => clockValue;
    const inner = createMemoryStore(DEMO_POLICY, clock);
    await seed(inner);
    let lose = true;
    const { store, sent } = sentRecorder(inner, async (id, event, real) => {
      const status = await real.appendEvent(id, event);
      if (lose) {
        lose = false;
        throw new DonnaStoreError("OFFLINE");
      }
      return status;
    });
    mount(remoteFor(store), { clock });
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await user.click(within(card).getByRole("button", { name: "Snooze" }));
    await user.click(within(card).getByRole("button", { name: "1 hour" }));
    expect(await screen.findByTestId("donna-error-syn-alpha")).toBeInTheDocument();
    clockValue = minutesLater(NOW, 7);
    await user.click(within(card).getByRole("button", { name: "1 hour" }));
    await screen.findByTestId("donna-reminder-syn-alpha");
    expect(sent).toHaveLength(2);
    expect(sent[1]?.id).toBe(sent[0]?.id);
    expect(sent[1]?.event).toEqual(sent[0]?.event);
    expect(sent[0]?.event).toMatchObject({ type: "SNOOZED", at: NOW, until: minutesLater(NOW, 60) });
    expect((await inner.load()).events.filter((e) => e.type === "SNOOZED")).toHaveLength(1);
  });

  it("an intentionally edited submission gets a new id (first attempt never reached the database)", async () => {
    const user = userEvent.setup();
    let clockValue = NOW;
    const clock = () => clockValue;
    const inner = createMemoryStore(DEMO_POLICY, clock);
    await seed(inner);
    let failBefore = true;
    const { store, sent } = sentRecorder(inner, async (id, event, real) => {
      if (failBefore) {
        failBefore = false;
        throw new DonnaStoreError("OFFLINE");
      }
      return real.appendEvent(id, event);
    });
    mount(remoteFor(store), { clock });
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card, "first wording");
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    await screen.findByTestId("donna-error-syn-alpha");
    clockValue = minutesLater(NOW, 2);
    await user.type(within(card).getByLabelText(/What happened/), " (edited)");
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    await screen.findByTestId("donna-record-syn-alpha");
    expect(sent).toHaveLength(2);
    expect(sent[1]?.id).not.toBe(sent[0]?.id);
    const rows = await outcomeRows(inner, "syn-alpha");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ originalInput: "first wording (edited)" });
  });

  it("an edit after the first attempt DID land is a conflict, never a silent second outcome", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    let lose = true;
    const { store, sent } = sentRecorder(inner, async (id, event, real) => {
      const status = await real.appendEvent(id, event);
      if (lose) {
        lose = false;
        throw new DonnaStoreError("OFFLINE");
      }
      return status;
    });
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card, "landed wording");
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    await screen.findByTestId("donna-error-syn-alpha");
    await user.type(within(card).getByLabelText(/What happened/), " (changed my mind)");
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-sync-notice")).toHaveTextContent("possibly from another device");
    expect(sent[1]?.id).not.toBe(sent[0]?.id);
    const rows = await outcomeRows(inner, "syn-alpha");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ originalInput: "landed wording" });
  });
});

describe("Donna sync: write acknowledged, then the reload fails (MOCK)", () => {
  function setup() {
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    let failNextLoad = false;
    let firstWrite = true;
    const { store, sent } = sentRecorder(inner, async (id, event, real) => {
      const status = await real.appendEvent(id, event);
      if (firstWrite) {
        firstWrite = false;
        failNextLoad = true; // the write is stored; the very next read fails
      }
      return status;
    });
    const guarded: DonnaStore = {
      ...store,
      load: async () => {
        if (failNextLoad) {
          failNextLoad = false;
          throw new DonnaStoreError("OFFLINE");
        }
        return inner.load();
      },
    };
    return { inner, store: guarded, sent };
  }

  it("is reported as 'stored, not yet shown': no success, form stays open, recovery is offered, Reload recovers without another outcome", async () => {
    const user = userEvent.setup();
    const { inner, store } = setup();
    await seed(inner);
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));

    expect(await screen.findByTestId("donna-recovery")).toHaveTextContent("confirmed this save and it is stored");
    expect(screen.getByTestId("donna-error-syn-alpha")).toHaveTextContent("confirmed this save and it is stored");
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument(); // not reported as full success
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument(); // not shown until re-read
    expect(within(card).getByRole("button", { name: "Save outcome" })).toBeInTheDocument(); // form not silently closed
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1); // but it IS stored

    await user.click(screen.getByRole("button", { name: "Reload from database" }));
    expect(await screen.findByTestId("donna-record-syn-alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-recovery")).not.toBeInTheDocument();
    expect(await outcomeRows(inner, "syn-alpha")).toHaveLength(1);
  });

  it("'Save again' after a failed reload is a duplicate of the same request: recovers, and still one outcome", async () => {
    const user = userEvent.setup();
    const { inner, store, sent } = setup();
    await seed(inner);
    mount(remoteFor(store));
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    await screen.findByTestId("donna-recovery");
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-record-syn-alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-recovery")).not.toBeInTheDocument();
    expect(screen.getByTestId("donna-ack")).toBeInTheDocument();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.id).toBe(sent[0]?.id);
    expect((await inner.load()).events).toHaveLength(1);
  });
});

describe("Donna sync: loads are bound to the identity that started them (MOCK)", () => {
  function gatedFirstLoad(inner: DonnaStore) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let first = true;
    const store: DonnaStore = {
      ...inner,
      load: async () => {
        const snapshot = await inner.load();
        if (first) {
          first = false;
          await gate;
        }
        return snapshot;
      },
    };
    return { store, release: () => release() };
  }

  it("A's delayed load finishing after sign-out never repopulates the screen", async () => {
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    const { store, release } = gatedFirstLoad(inner);
    const auth = makeAuth("a@example.test");
    mount({ store, auth });
    await screen.findByText("Loading from the database…");
    await act(async () => {
      await auth.signOut();
    });
    expect(await screen.findByText("Sign in to load your records")).toBeInTheDocument();
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText("Sign in to load your records")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-sync-ready")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-question-syn-alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Client Alpha")).not.toBeInTheDocument();
  });

  it("A's delayed load finishing after B signs in never shows A's records", async () => {
    const storeA = createMemoryStore(DEMO_POLICY, () => NOW);
    const storeB = createMemoryStore(DEMO_POLICY, () => NOW);
    const due = minutesLater(NOW, -180);
    await storeA.upsertCall({ id: "a-call", clientId: "cl-alpha", dueAt: due });
    await storeB.upsertCall({ id: "b-call", clientId: "cl-beta", dueAt: due });
    const auth = makeAuth("a@example.test");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let first = true;
    const routed: DonnaStore = {
      load: async () => {
        const who = await auth.currentEmail(); // the response belongs to whoever asked
        const snapshot = await (who === "a@example.test" ? storeA : storeB).load();
        if (first) {
          first = false;
          await gate;
        }
        return snapshot;
      },
      appendEvent: async (id, event) => storeB.appendEvent(id, event),
      upsertCall: async (call) => storeB.upsertCall(call),
    };
    mount({ store: routed, auth });
    await screen.findByText("Loading from the database…");
    await act(async () => {
      await auth.signInWithPassword("b@example.test", "correct");
    });
    expect(await screen.findByTestId("donna-question-b-call")).toBeInTheDocument();
    expect(screen.getByTestId("donna-sync-ready")).toHaveTextContent("b@example.test");
    await act(async () => {
      release(); // A's slow response now arrives
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.queryByTestId("donna-question-a-call")).not.toBeInTheDocument();
    expect(screen.getByTestId("donna-question-b-call")).toBeInTheDocument();
    expect(screen.getByTestId("donna-sync-ready")).toHaveTextContent("b@example.test");
  });

  it("sign-out clears A's records and acknowledgement; B never sees them", async () => {
    const user = userEvent.setup();
    const storeA = createMemoryStore(DEMO_POLICY, () => NOW);
    const storeB = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(storeA);
    const auth = makeAuth("a@example.test");
    const routed: DonnaStore = {
      load: async () => ((await auth.currentEmail()) === "a@example.test" ? storeA : storeB).load(),
      appendEvent: async (id, e) => ((await auth.currentEmail()) === "a@example.test" ? storeA : storeB).appendEvent(id, e),
      upsertCall: async (c) => ((await auth.currentEmail()) === "a@example.test" ? storeA : storeB).upsertCall(c),
    };
    mount({ store: routed, auth });
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await screen.findByTestId("donna-ack")).toBeInTheDocument();
    expect(screen.getByTestId("donna-record-syn-alpha")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Sign in to load your records")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "b@example.test");
    await user.type(screen.getByLabelText("Password"), "correct");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByTestId("donna-sync-ready")).toHaveTextContent("b@example.test");
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Client Alpha")).not.toBeInTheDocument();
  });

  it("A's write that is acknowledged after sign-out shows no acknowledgement and no records", async () => {
    const user = userEvent.setup();
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { store } = sentRecorder(inner, async (id, event, real) => {
      await gate;
      return real.appendEvent(id, event);
    });
    const auth = makeAuth("a@example.test");
    mount({ store, auth });
    const card = await screen.findByTestId("donna-question-syn-alpha");
    await fillSpoke(user, card);
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    await screen.findByTestId("donna-saving-syn-alpha");
    await act(async () => {
      await auth.signOut();
    });
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText("Sign in to load your records")).toBeInTheDocument();
    expect(screen.queryByTestId("donna-ack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-record-syn-alpha")).not.toBeInTheDocument();
    expect(screen.queryByTestId("donna-sync-ready")).not.toBeInTheDocument();
  });

  it("a load that finishes after the provider unmounts does nothing and raises no error", async () => {
    const inner = createMemoryStore(DEMO_POLICY, () => NOW);
    await seed(inner);
    const { store, release } = gatedFirstLoad(inner);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(
      <LocaleProvider>
        <DonnaProvider remote={{ store, auth: makeAuth("a@example.test") }} syncConfig={ON} clock={() => NOW} newId={ids("cccccccc")}>
          <DonnaInbox />
        </DonnaProvider>
      </LocaleProvider>,
    );
    await screen.findByText("Loading from the database…");
    view.unmount();
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
