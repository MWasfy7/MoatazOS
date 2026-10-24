import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DonnaBanner } from "@/components/donna/DonnaBanner";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";
import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";

function SwitchToArabic() {
  const { setLocale, dir } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("ar")} data-dir={dir}>
      switch-ar
    </button>
  );
}

function renderDonna() {
  return render(
    <LocaleProvider>
      <DonnaProvider>
        <SwitchToArabic />
        <DonnaBanner />
        <DonnaInbox />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

const alpha = () => screen.getByTestId("donna-question-call-alpha");

describe("Donna inbox (English)", () => {
  it("shows unresolved questions on open with the five options", () => {
    renderDonna();
    expect(screen.getByTestId("donna-banner")).toHaveTextContent("Unresolved client questions: 2");
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
    for (const label of ["Spoke", "No answer", "Didn't call", "Snooze", "Cancel"]) {
      expect(within(alpha()).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(alpha()).getByText("Did you speak with this client?")).toBeInTheDocument();
    expect(screen.getByTestId("donna-question-call-beta")).toHaveTextContent("marked done, but no outcome");
  });

  it("labels persistence, voice, sync and closed-app notifications as not implemented", () => {
    renderDonna();
    const status = screen.getByTestId("donna-demo-status");
    expect(status).toHaveTextContent("not implemented");
    for (const text of ["Durable storage", "Voice capture", "Cross-device sync", "Closed-app notifications"]) {
      expect(status).toHaveTextContent(text);
    }
  });

  it("dismissing the banner does not resolve any question", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(screen.getByRole("button", { name: "Dismiss banner" }));
    expect(screen.queryByTestId("donna-banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("donna-banner-dismissed")).toHaveTextContent("still unresolved");
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
    expect(alpha()).toBeInTheDocument();
    expect(within(alpha()).getByText(/Dismissed from view 1 time/)).toBeInTheDocument();
  });

  it("raises the banner again when a new question becomes due after dismissal", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(screen.getByRole("button", { name: "Dismiss banner" }));
    await user.click(screen.getByRole("button", { name: "+10 hours" }));
    expect(screen.getByTestId("donna-banner")).toHaveTextContent("Unresolved client questions: 3");
  });

  it("snooze keeps the question open and shows the snoozed reminder", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(within(alpha()).getByRole("button", { name: "Snooze" }));
    await user.click(within(alpha()).getByRole("button", { name: "1 hour" }));
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
    expect(screen.getByTestId("donna-reminder-call-alpha")).toHaveTextContent("Snoozed until 2026-10-26 13:00");
    await user.click(screen.getByRole("button", { name: "+1 hour" }));
    expect(screen.getByTestId("donna-reminder-call-alpha")).toHaveTextContent("Reminder due now");
  });

  it("holds the reminder in quiet hours without hiding the question", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(screen.getByRole("button", { name: "+10 hours" }));
    expect(screen.getByTestId("donna-reminder-call-alpha")).toHaveTextContent("Reminder held: quiet hours (22:00–7:00)");
    expect(alpha()).toBeInTheDocument();
  });

  it("marking the call task done does not hide the question", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(within(alpha()).getByRole("button", { name: "Mark task done" }));
    expect(alpha()).toHaveTextContent("marked done, but no outcome");
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
  });

  it("records 'spoke' with an internal follow-up, labelled as not agreed with the client", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(within(alpha()).getByRole("button", { name: "Spoke" }));
    await user.type(within(alpha()).getByLabelText(/What happened/), "Asked for a revised offer");
    await user.click(within(alpha()).getByLabelText(/Internal follow-up date/));
    fireEvent.change(within(alpha()).getByLabelText("Follow-up date"), { target: { value: "2026-10-29" } });
    await user.click(within(alpha()).getByRole("button", { name: "Save outcome" }));
    const record = screen.getByTestId("donna-record-call-alpha");
    expect(record).toHaveTextContent("Spoke with the client");
    expect(screen.getByTestId("donna-next-call-alpha")).toHaveTextContent("Internal follow-up (not agreed with the client): 2026-10-29");
    expect(record).toHaveTextContent("Asked for a revised offer");
    expect(screen.queryByTestId("donna-question-call-alpha")).not.toBeInTheDocument();
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(1)");
  });

  it("will not record a client-confirmed appointment unless the client confirmation box is ticked", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(within(alpha()).getByRole("button", { name: "Spoke" }));
    await user.click(within(alpha()).getByLabelText(/Client-confirmed appointment \(/));
    fireEvent.change(within(alpha()).getByLabelText("Appointment date and time"), { target: { value: "2026-10-30T11:00" } });
    await user.click(within(alpha()).getByRole("button", { name: "Save outcome" }));
    expect(within(alpha()).getByRole("alert")).toHaveTextContent("Tick the box only if the client explicitly agreed");
    await user.click(within(alpha()).getByLabelText("The client explicitly confirmed this time"));
    await user.click(within(alpha()).getByRole("button", { name: "Save outcome" }));
    expect(screen.getByTestId("donna-next-call-alpha")).toHaveTextContent("Client-confirmed appointment: 2026-10-30 11:00");
  });

  it("offers no appointment option when the client was not reached", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(within(alpha()).getByRole("button", { name: "No answer" }));
    expect(within(alpha()).queryByLabelText(/Client-confirmed appointment/)).not.toBeInTheDocument();
    await user.click(within(alpha()).getByRole("button", { name: "Save outcome" }));
    const record = screen.getByTestId("donna-record-call-alpha");
    expect(record).toHaveTextContent("No answer");
    expect(record).toHaveTextContent("Note not provided");
    expect(record).toHaveTextContent("Next action not provided");
  });

  it("cancels a call only after confirmation and keeps the history", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(within(alpha()).getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(2)");
    await user.click(within(alpha()).getByRole("button", { name: "Confirm: this call is cancelled" }));
    expect(screen.getByTestId("donna-record-call-alpha")).toHaveTextContent("Call cancelled");
    expect(screen.getByTestId("donna-unresolved-count")).toHaveTextContent("(1)");
  });

  it("exposes no send, call, schedule, or CRM control and no outbound link", () => {
    renderDonna();
    const forbidden = /^(send|call|call now|dial|schedule|book|text|whatsapp|email|message|sync|save to crm|write)\b/i;
    for (const button of screen.getAllByRole("button")) expect(button.textContent ?? "").not.toMatch(forbidden);
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/^(tel:|mailto:|https?:)/);
    }
  });
});

describe("Donna inbox (Arabic / RTL)", () => {
  it("renders Arabic copy and the same five options in RTL context", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    expect(screen.getByRole("button", { name: "switch-ar" })).toHaveAttribute("data-dir", "rtl");
    expect(screen.getByTestId("donna-banner")).toHaveTextContent("أسئلة عملاء بلا إجابة: 2");
    for (const label of ["تحدثت", "لم يرد", "لم أتصل", "تأجيل", "إلغاء"]) {
      expect(within(alpha()).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(alpha()).getByText("هل تحدثت مع هذا العميل؟")).toBeInTheDocument();
    expect(within(alpha()).getByRole("heading", { name: "عميل تجريبي ألفا" })).toBeInTheDocument();
    expect(screen.getByTestId("donna-demo-status")).toHaveTextContent("غير منفّذة");
  });

  it("keeps outcome semantics in Arabic: internal follow-up is not a client agreement", async () => {
    const user = userEvent.setup();
    renderDonna();
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    await user.click(within(alpha()).getByRole("button", { name: "تحدثت" }));
    await user.click(within(alpha()).getByLabelText(/تاريخ متابعة داخلي/));
    fireEvent.change(within(alpha()).getByLabelText("تاريخ المتابعة"), { target: { value: "2026-10-29" } });
    await user.click(within(alpha()).getByRole("button", { name: "حفظ النتيجة" }));
    expect(screen.getByTestId("donna-next-call-alpha")).toHaveTextContent("متابعة داخلية (لم يوافق عليها العميل)");
  });

  it("translates every error code in both languages", () => {
    expect(Object.keys(ar.donna.errors).sort()).toEqual(Object.keys(en.donna.errors).sort());
    for (const dict of [en, ar]) for (const message of Object.values(dict.donna.errors)) expect(message.length).toBeGreaterThan(5);
  });
});
