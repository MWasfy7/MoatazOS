import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CouncilWorkspace } from "@/components/donna/CouncilWorkspace";
import { redactPii, reviewCouncil } from "@/lib/donna/council";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

describe("Donna AI Council", () => {
  it("masks basic contact identifiers before copy", () => {
    expect(redactPii("test@example.com +201012345678 01234567890 12345678901234"))
      .toBe("[email] [phone] [phone] [national ID]");
  });
  it("keeps the decision restrained without source evidence", () => {
    const result = reviewCouncil({ OpenAI: "Use WhatsApp", Claude: "Avoid the viewing now", Gemini: "Quote 70,000 EGP", DeepSeek: "Ask for one reply" }, "");
    expect(result.ready).toBe(true);
    expect(result.evidenceWarning).toContain("blocked");
    expect(result.scores[2]?.flags.join(" ")).toContain("Check every price");
  });
  it("requires approval of the exact draft and shows partial status", () => {
    render(<LocaleProvider><CouncilWorkspace /></LocaleProvider>);
    expect(screen.queryByTestId("council-review")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review sample case" }));
    expect(screen.getByText(/Local rule-based review of this sample/)).toBeInTheDocument();
    const copy = screen.getByRole("button", { name: "Copy approved draft" });
    expect(copy).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Approve this text" }));
    expect(copy).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Client message draft" }), { target: { value: "Changed" } });
    expect(copy).toBeDisabled();
  });
  it("keeps SalesOS restraint primary and removes the client draft", () => {
    render(<LocaleProvider><CouncilWorkspace salesGate={{ allowed: false, reason: "NO_ACTION · CURRENT", snapshotId: "snap-test" }} /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Review sample case" }));
    expect(screen.getByTestId("council-sales-gate")).toHaveTextContent("NO_ACTION");
    expect(screen.getByText(/has not cleared client outreach/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy approved draft" })).not.toBeInTheDocument();
  });
});
