import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { DEMO_POLICY, type DonnaRemote } from "@/lib/donna";
import { createMemoryStore } from "@/lib/donna/memoryStore";
import type { SyncConfigResult } from "@/lib/donna/remote/config";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

// Command center and guided flow. Demo mode (memory only) unless a test says MOCK store.
function SwitchToArabic() {
  const { setLocale } = useLocale();
  return <button type="button" onClick={() => setLocale("ar")}>switch-ar</button>;
}

function mountDemo() {
  return render(
    <LocaleProvider>
      <DonnaProvider>
        <SwitchToArabic />
        <DonnaInbox />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

const alpha = () => screen.getByTestId("donna-question-call-alpha");
const priority = () => screen.getByTestId("donna-today-priority");
type User = ReturnType<typeof userEvent.setup>;

async function press(user: User, scope: HTMLElement, name: string | RegExp, times = 1) {
  for (let i = 0; i < times; i += 1) await user.click(within(scope).getByRole("button", { name }));
}

describe("Today as a command center (demo data)", () => {
  it("puts the call that needs an answer first, and its button takes you to that card", async () => {
    const user = userEvent.setup();
    mountDemo();
    expect(priority()).toHaveAttribute("data-kind", "NEEDS_OUTCOME");
    expect(priority()).toHaveTextContent("What happened on the call with Synthetic Client Alpha?");
    await press(user, priority(), "Record outcome");
    expect(alpha()).toHaveFocus();
  });

  it("moves the priority to the open follow-up once nothing is waiting for an answer", async () => {
    const user = userEvent.setup();
    mountDemo();
    for (const id of ["call-alpha", "call-beta"]) {
      const card = screen.getByTestId(`donna-question-${id}`);
      await press(user, card, "No answer");
      await press(user, card, "Save outcome");
    }
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(0)");
    expect(priority()).toHaveAttribute("data-kind", "COMMITMENT");
    expect(priority()).toHaveTextContent("Synthetic Client Delta");
  });

  it("opens a follow-up in place with the client's history, and closes it again", async () => {
    const user = userEvent.setup();
    mountDemo();
    const row = screen.getByTestId("donna-today-commitment-call-delta");
    const toggle = within(row).getByRole("button", { expanded: false });
    expect(within(row).queryByTestId("donna-history-cl-delta")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const history = within(row).getByTestId("donna-history-cl-delta");
    expect(history).toHaveTextContent("Synthetic note: asked to compare two unit sizes.");
    await user.click(toggle);
    expect(within(row).queryByTestId("donna-history-cl-delta")).not.toBeInTheDocument();
  });

  it("lets you prepare, approve and copy a follow-up draft straight from the priority card", async () => {
    const user = userEvent.setup();
    mountDemo();
    for (const id of ["call-alpha", "call-beta"]) {
      const card = screen.getByTestId(`donna-question-${id}`);
      await press(user, card, "No answer");
      await press(user, card, "Save outcome");
    }
    await press(user, priority(), "Prepare a follow-up draft");
    const draft = screen.getByTestId("donna-draft-call-delta-today");
    expect(within(draft).getByLabelText(/Draft text/)).toBeInTheDocument();
    const copyButton = within(draft).getByRole("button", { name: "Copy text" });
    expect(copyButton).toBeDisabled();
    await press(user, draft, "Approve draft");
    expect(within(draft).getByTestId("donna-draft-approved-call-delta-today")).toBeInTheDocument();
    await user.click(copyButton);
    expect(await within(draft).findByTestId("donna-draft-copied-call-delta-today")).toBeInTheDocument();
    expect(screen.getByTestId("donna-toast")).toHaveTextContent("Draft copied. Nothing was sent.");
    expect(await navigator.clipboard.readText()).toContain("Hello Synthetic Client Delta,");
  });

  it("opens an upcoming call to show history and says it is not due yet", async () => {
    const user = userEvent.setup();
    mountDemo();
    const row = screen.getByTestId("donna-today-call-call-gamma");
    await user.click(within(row).getByRole("button"));
    expect(row).toHaveTextContent("not due yet");
    expect(within(row).getByTestId("donna-history-cl-gamma")).toBeInTheDocument();
  });
});

describe("Guided outcome flow (demo data)", () => {
  it("asks one thing at a time, keeps what you typed when you go back, and shows a check before saving", async () => {
    const user = userEvent.setup();
    mountDemo();
    await press(user, alpha(), "Spoke");
    expect(screen.getByTestId("donna-step-call-alpha")).toHaveTextContent("Step 1 of 3 · What happened");
    expect(within(alpha()).queryByLabelText(/Next step \(/)).not.toBeInTheDocument();
    await user.type(within(alpha()).getByLabelText(/What happened/), "Wants a bigger unit");
    await press(user, alpha(), "Next");
    expect(screen.getByTestId("donna-step-call-alpha")).toHaveTextContent("Step 2 of 3 · Next step");
    await user.type(within(alpha()).getByLabelText(/Next step \(/), "Send brochure");
    await press(user, alpha(), "Back");
    expect(within(alpha()).getByLabelText(/What happened/)).toHaveValue("Wants a bigger unit");
    await press(user, alpha(), "Next", 2);
    expect(screen.getByTestId("donna-step-call-alpha")).toHaveTextContent("Step 3 of 3 · Follow-up");
    const review = screen.getByTestId("donna-review-call-alpha");
    expect(review).toHaveTextContent("Wants a bigger unit");
    expect(review).toHaveTextContent("Send brochure");
    await user.click(within(alpha()).getByLabelText(/Internal follow-up date/));
    fireEvent.change(within(alpha()).getByLabelText("Follow-up date"), { target: { value: "2026-10-29" } });
    expect(review).toHaveTextContent("2026-10-29");
  });

  it("saves from any step, confirms it, and is honest that demo mode is not stored", async () => {
    const user = userEvent.setup();
    mountDemo();
    await press(user, alpha(), "Spoke");
    await user.type(within(alpha()).getByLabelText(/What happened/), "Quick note");
    await press(user, alpha(), "Save outcome");
    expect(screen.getByTestId("donna-record-call-alpha")).toHaveTextContent("Quick note");
    const toast = screen.getByTestId("donna-toast");
    expect(toast).toHaveTextContent("Recorded for Synthetic Client Alpha: Spoke with the client.");
    expect(toast).toHaveTextContent("Demo mode: kept in this tab only");
    await press(user, toast, "Close message");
    expect(screen.queryByTestId("donna-toast")).not.toBeInTheDocument();
  });

  it("confirms a snooze and keeps the question open", async () => {
    const user = userEvent.setup();
    mountDemo();
    await press(user, alpha(), "Snooze");
    await press(user, alpha(), "1 hour");
    expect(screen.getByTestId("donna-toast")).toHaveTextContent("Snoozed Synthetic Client Alpha until 2026-10-26 13:00. The question stays open.");
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
  });

  it("shows the client's earlier history inside the question, on request", async () => {
    const user = userEvent.setup();
    mountDemo();
    const beta = screen.getByTestId("donna-question-call-beta");
    expect(within(beta).queryByTestId("donna-history-cl-beta")).not.toBeInTheDocument();
    await press(user, beta, "Show history");
    expect(within(beta).getByTestId("donna-history-cl-beta")).toBeInTheDocument();
  });

  it("works in Arabic: steps, prompts and the confirmation", async () => {
    const user = userEvent.setup();
    mountDemo();
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    expect(within(priority()).getByRole("button", { name: "تسجيل النتيجة" })).toBeInTheDocument();
    await press(user, alpha(), "تحدثت");
    expect(screen.getByTestId("donna-step-call-alpha")).toHaveTextContent("الخطوة 1 من 3 · ماذا حدث");
    await press(user, alpha(), "التالي");
    expect(screen.getByTestId("donna-step-call-alpha")).toHaveTextContent("الخطوة 2 من 3 · الخطوة التالية");
    await press(user, alpha(), "حفظ النتيجة");
    expect(screen.getByTestId("donna-toast")).toHaveTextContent("تم التسجيل لـ عميل تجريبي ألفا");
    expect(screen.getByTestId("donna-toast")).toHaveTextContent("وضع العرض");
  });
});

// ---- MOCK store in sync mode: the confirmation must wait for the database to acknowledge ----

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

describe("Confirmation in sync mode (MOCK store, not persistence evidence)", () => {
  it("shows the confirmation only after the record is stored, without the demo caveat", async () => {
    const user = userEvent.setup();
    const store = createMemoryStore(DEMO_POLICY, () => NOW);
    await store.upsertCall({ id: "plan-test-1", clientId: "cl-alpha", dueAt: "2026-10-26T10:00:00.000Z" });
    let n = 0;
    render(
      <LocaleProvider>
        <DonnaProvider remote={remoteFor(store)} syncConfig={ON} clock={() => NOW} newId={() => `ffffffff-0000-4000-8000-${String(++n).padStart(12, "0")}`}>
          <DonnaInbox />
        </DonnaProvider>
      </LocaleProvider>,
    );
    const card = await screen.findByTestId("donna-question-plan-test-1");
    expect(screen.getByTestId("donna-today-priority")).toHaveAttribute("data-kind", "NEEDS_OUTCOME");
    await press(user, card, "No answer");
    await press(user, card, "Save outcome");
    const toast = await screen.findByTestId("donna-toast");
    expect(toast).toHaveTextContent("Recorded for Synthetic Client Alpha: No answer.");
    expect(toast).not.toHaveTextContent("Demo mode");
    // By the time the confirmation is on screen, the record really is in the store.
    const stored = (await store.load()).events.filter((e) => e.type === "OUTCOME_RECORDED");
    expect(stored).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(0)"));
    expect(screen.getByTestId("donna-today-priority")).toHaveAttribute("data-kind", "CLEAR");
  });
});
