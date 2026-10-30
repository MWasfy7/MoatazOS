import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import {
  composeOriginalInput,
  deriveOutcomeFacts,
  DEMO_POLICY,
  MAX_ORIGINAL_INPUT,
  splitOriginalInput,
  type DonnaRemote,
} from "@/lib/donna";
import { createMemoryStore } from "@/lib/donna/memoryStore";
import type { SyncConfigResult } from "@/lib/donna/remote/config";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

// MOCK store, MOCK auth and a MOCK speech recognizer. Not persistence or microphone evidence.
const NOW = "2026-10-26T12:00:00.000Z";
const ON: SyncConfigResult = { mode: "ON", url: "https://mock.example.test", anonKey: "mock-anon" };

function remoteFor(store: ReturnType<typeof createMemoryStore>): DonnaRemote {
  let email: string | null = "owner@example.test";
  return {
    store,
    auth: {
      currentEmail: async () => email,
      signInWithPassword: async () => null,
      signOut: async () => {
        email = null;
      },
      onChange: () => () => {},
    },
  };
}

function SwitchToArabic() {
  const { setLocale } = useLocale();
  return <button type="button" onClick={() => setLocale("ar")}>switch-ar</button>;
}

async function mountWithDueCall() {
  const store = createMemoryStore(DEMO_POLICY, () => NOW);
  await store.upsertCall({ id: "plan-test-1", clientId: "cl-alpha", dueAt: "2026-10-26T10:00:00.000Z" });
  let n = 0;
  render(
    <LocaleProvider>
      <DonnaProvider remote={remoteFor(store)} syncConfig={ON} clock={() => NOW} newId={() => `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, "0")}`}>
        <SwitchToArabic />
        <DonnaInbox />
      </DonnaProvider>
    </LocaleProvider>,
  );
  const card = await screen.findByTestId("donna-question-plan-test-1");
  return { store, card };
}

class FakeRecognition {
  static last: FakeRecognition | null = null;
  static startThrows = false;
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    if (FakeRecognition.startThrows) throw new Error("already started");
  }
  stop() {
    this.onend?.();
  }
}

function installRecognizer() {
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
  FakeRecognition.last = null;
  FakeRecognition.startThrows = false;
}

afterEach(() => {
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("next step stored apart from the note", () => {
  it("round-trips, strips the marker from user text, and never lets a next step stand in for the note", () => {
    const stored = composeOriginalInput("Liked the view", "Send payment plan");
    expect(splitOriginalInput(stored)).toEqual({ note: "Liked the view", nextStep: "Send payment plan" });
    expect(splitOriginalInput("only a note")).toEqual({ note: "only a note", nextStep: "" });
    expect(composeOriginalInput("note", "")).toBe("note");
    const hostile = composeOriginalInput("a [[next-step]] b", "c [[next-step]] d");
    expect(splitOriginalInput(hostile)).toEqual({ note: "a  b", nextStep: "c  d" });
    // A next step with an empty note: the NOTE is still reported as unknown.
    const facts = deriveOutcomeFacts("SPOKE", composeOriginalInput("", "Send plan"), null);
    expect(facts.unknownFields).toContain("NOTE");
    expect(MAX_ORIGINAL_INPUT).toBe(2000);
  });
});

describe("Next step field and voice input in the outcome form (MOCK)", () => {
  it("records a separate next step with the note and follow-up date, in English", async () => {
    const user = userEvent.setup();
    const { store, card } = await mountWithDueCall();
    await user.click(within(card).getByRole("button", { name: "Spoke" }));
    await user.type(within(card).getByLabelText(/What happened/), "Liked the view");
    await user.type(within(card).getByLabelText(/Next step \(/), "Send payment plan");
    await user.click(within(card).getByLabelText(/Internal follow-up date/));
    await user.type(within(card).getByLabelText("Follow-up date", { exact: true }), "2026-10-28");
    await user.click(within(card).getByRole("button", { name: "Save outcome" }));
    await waitFor(() => expect(screen.getByTestId("donna-nextstep-plan-test-1")).toHaveTextContent("Send payment plan"));
    expect(screen.getByTestId("donna-record-plan-test-1")).toHaveTextContent("Liked the view");
    expect(screen.getByTestId("donna-next-plan-test-1")).toHaveTextContent("2026-10-28");
    const stored = (await store.load()).events.find((e) => e.type === "OUTCOME_RECORDED");
    expect(stored && stored.type === "OUTCOME_RECORDED" && splitOriginalInput(stored.originalInput)).toEqual({
      note: "Liked the view",
      nextStep: "Send payment plan",
    });
  });

  it("shows the Arabic next-step label", async () => {
    const user = userEvent.setup();
    const { card } = await mountWithDueCall();
    await user.click(within(card).getByRole("button", { name: "Spoke" }));
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    expect(await within(card).findByLabelText(/الخطوة التالية \(/)).toBeInTheDocument();
  });

  it("says plainly that voice is unavailable and keeps typing working", async () => {
    const user = userEvent.setup();
    const { card } = await mountWithDueCall();
    await user.click(within(card).getByRole("button", { name: "Spoke" }));
    const statuses = await within(card).findAllByTestId("donna-voice-status");
    expect(statuses[0]).toHaveTextContent("Voice input is not available in this browser");
    await user.type(within(card).getByLabelText(/What happened/), "typed");
    expect(within(card).getByLabelText(/What happened/)).toHaveValue("typed");
  });

  it("dictates into the note and into the next step", async () => {
    installRecognizer();
    const user = userEvent.setup();
    const { card } = await mountWithDueCall();
    await user.click(within(card).getByRole("button", { name: "Spoke" }));
    await user.click(within(card).getByRole("button", { name: /Speak — what happened/ }));
    expect(FakeRecognition.last?.lang).toBe("en-US");
    expect(within(card).getByTestId("donna-voice-status")).toHaveTextContent("Listening");
    act(() => {
      FakeRecognition.last?.onresult?.({ results: [[{ transcript: "client liked the view" }]] });
      FakeRecognition.last?.onend?.();
    });
    expect(within(card).getByLabelText(/What happened/)).toHaveValue("client liked the view");
    await user.click(within(card).getByRole("button", { name: /Speak — next step/ }));
    act(() => {
      FakeRecognition.last?.onresult?.({ results: [[{ transcript: "send brochure" }]] });
      FakeRecognition.last?.onend?.();
    });
    expect(within(card).getByLabelText(/Next step \(/)).toHaveValue("send brochure");
  });

  it("explains a blocked microphone, a silent timeout and a dropped connection, without losing typed text", async () => {
    installRecognizer();
    const user = userEvent.setup();
    const { card } = await mountWithDueCall();
    await user.click(within(card).getByRole("button", { name: "Spoke" }));
    await user.type(within(card).getByLabelText(/What happened/), "kept");
    const speak = () => within(card).getByRole("button", { name: /Speak — what happened/ });

    await user.click(speak());
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
    expect(within(card).getAllByTestId("donna-voice-status")[0]).toHaveTextContent("Microphone access was blocked");

    await user.click(speak());
    act(() => FakeRecognition.last?.onend?.());
    expect(within(card).getAllByTestId("donna-voice-status")[0]).toHaveTextContent("Couldn't catch that");

    await user.click(speak());
    act(() => FakeRecognition.last?.onerror?.({ error: "network" }));
    expect(within(card).getAllByTestId("donna-voice-status")[0]).toHaveTextContent("Voice needs a connection");

    FakeRecognition.startThrows = true;
    await user.click(speak());
    expect(within(card).getAllByTestId("donna-voice-status")[0]).toHaveTextContent("Voice input failed");
    expect(within(card).getByLabelText(/What happened/)).toHaveValue("kept");
  });

  it("uses Egyptian Arabic recognition and Arabic status text when the language is Arabic", async () => {
    installRecognizer();
    const user = userEvent.setup();
    const { card } = await mountWithDueCall();
    await user.click(within(card).getByRole("button", { name: "Spoke" }));
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    await user.click(within(card).getAllByRole("button", { name: /تحدّث/ })[0]!);
    expect(FakeRecognition.last?.lang).toBe("ar-EG");
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
    expect(within(card).getAllByTestId("donna-voice-status")[0]).toHaveTextContent("تم حظر الوصول إلى الميكروفون");
  });
});
