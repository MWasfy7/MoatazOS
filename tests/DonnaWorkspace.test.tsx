import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DonnaInbox } from "@/components/donna/DonnaInbox";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

// Demo mode (memory only, fixed demo clock): checks the screens, not persistence.
function SwitchToArabic() {
  const { setLocale } = useLocale();
  return <button type="button" onClick={() => setLocale("ar")}>switch-ar</button>;
}

function mount() {
  return render(
    <LocaleProvider>
      <DonnaProvider>
        <SwitchToArabic />
        <DonnaInbox />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

describe("Donna workspace screens (demo data)", () => {
  it("shows Today with what is waiting, what is planned today, and the open commitment", () => {
    mount();
    const today = screen.getByTestId("donna-today");
    expect(within(today).getByText("Today")).toBeInTheDocument();
    expect(within(today).getByTestId("donna-today-needs-count")).toHaveTextContent("(2)");
    expect(within(today).getByTestId("donna-today-needs-call-alpha")).toHaveTextContent("Synthetic Client Alpha");
    expect(within(today).getByTestId("donna-today-call-call-gamma")).toHaveTextContent("Synthetic Client Gamma");
    const commitment = within(today).getByTestId("donna-today-commitment-call-delta");
    expect(commitment).toHaveAttribute("data-status", "UPCOMING");
    expect(commitment).toHaveTextContent("2026-10-28");
    expect(commitment).toHaveTextContent("the client has not agreed to this date");
  });

  it("moves the commitment to Today and then Overdue as the demo clock advances", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "+1 day" }));
    await user.click(screen.getByRole("button", { name: "+1 day" }));
    expect(screen.getByTestId("donna-today-commitment-call-delta")).toHaveAttribute("data-status", "TODAY");
    await user.click(screen.getByRole("button", { name: "+1 day" }));
    expect(screen.getByTestId("donna-today-commitment-call-delta")).toHaveAttribute("data-status", "OVERDUE");
  });

  it("requires approval of the exact text before it can be copied, and never sends anything", async () => {
    const user = userEvent.setup();
    mount();
    const card = screen.getByTestId("donna-draft-call-delta");
    await user.click(within(card).getByRole("button", { name: "Prepare a follow-up draft" }));
    expect(within(card).getByText(/Donna never sends messages/)).toBeInTheDocument();
    expect(within(card).getByText(/No AI model was used/)).toBeInTheDocument();
    const textbox = within(card).getByLabelText(/Draft text/);
    expect((textbox as HTMLTextAreaElement).value).toContain("Hello Synthetic Client Delta,");
    expect((textbox as HTMLTextAreaElement).value).not.toContain("Synthetic note: asked to compare two unit sizes.");

    const copyButton = within(card).getByRole("button", { name: "Copy text" });
    expect(copyButton).toBeDisabled();
    await user.click(within(card).getByRole("button", { name: "Approve draft" }));
    expect(within(card).getByTestId("donna-draft-approved-call-delta")).toBeInTheDocument();
    expect(copyButton).toBeEnabled();

    // Any edit withdraws the approval.
    await user.type(textbox, " extra");
    expect(copyButton).toBeDisabled();
    expect(within(card).getByText(/Approve it again before copying/)).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Approve draft" }));
    await user.click(copyButton);
    expect(await within(card).findByTestId("donna-draft-copied-call-delta")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe((textbox as HTMLTextAreaElement).value);
  });

  it("shows reviewable client memory with the operator's words exactly, and session-only corrections", async () => {
    const user = userEvent.setup();
    mount();
    const memory = screen.getByTestId("donna-memory-cl-delta");
    expect(memory).toHaveTextContent("Synthetic note: asked to compare two unit sizes.");
    expect(memory).toHaveTextContent("Confirmed facts");
    expect(within(memory).getByText(/not saved/)).toBeInTheDocument();
    await user.type(within(memory).getByLabelText("Add a correction"), "Actually prefers the larger unit");
    await user.click(within(memory).getByRole("button", { name: "Add correction" }));
    expect(within(memory).getByTestId("donna-corrections-cl-delta")).toHaveTextContent("Actually prefers the larger unit");
    // The recorded note itself is unchanged by a correction.
    expect(memory).toHaveTextContent("Synthetic note: asked to compare two unit sizes.");
  });

  it("states plainly that no model is connected and spending is capped at zero", () => {
    mount();
    const status = screen.getByTestId("donna-ai-status");
    expect(status).toHaveTextContent("No AI model is connected");
    expect(screen.getByTestId("donna-ai-templates")).toHaveAttribute("data-state", "ACTIVE");
    for (const id of ["airllm", "chatgpt", "claude", "gemini"]) {
      expect(screen.getByTestId(`donna-ai-${id}`)).toHaveAttribute("data-state", "NOT_CONNECTED");
    }
    expect(status).toHaveTextContent("$0.00");
    expect(status).toHaveTextContent("not the same as API access");
  });

  it("renders the new screens in Arabic", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "switch-ar" }));
    expect(within(screen.getByTestId("donna-today")).getByText("اليوم")).toBeInTheDocument();
    expect(screen.getByTestId("donna-ai-status")).toHaveTextContent("لا يوجد نموذج ذكاء اصطناعي متصل");
    await user.click(within(screen.getByTestId("donna-draft-call-delta")).getByRole("button", { name: "تجهيز مسودة متابعة" }));
    expect(within(screen.getByTestId("donna-draft-call-delta")).getByText(/دونا لا ترسل رسائل أبدًا/)).toBeInTheDocument();
    expect(screen.getByTestId("donna-memory")).toHaveTextContent("ما تعرفه دونا عن كل عميل");
  });
});
