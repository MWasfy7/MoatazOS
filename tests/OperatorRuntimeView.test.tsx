import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OperatorRuntime } from "@/components/salesos/OperatorRuntime";
import { LocaleSwitch } from "@/components/app-studio/LocaleSwitch";
import { renderWithLocale } from "./test-utils";

describe("Build 4 Operator Runtime UI", () => {
  it("B4-018 makes the explainable Command Queue the primary surface", () => {
    renderWithLocale(<OperatorRuntime />);
    expect(screen.getByRole("heading", { name: "What deserves your attention right now?" })).toBeInTheDocument();
    expect(screen.getByText("Act now")).toBeInTheDocument();
    expect(screen.getByText("Commitments due")).toBeInTheDocument();
    expect(screen.getByText("Wait / protected")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-contract")).toHaveTextContent("Evidence Contract");
  });

  it("B4-019 records an override locally and keeps later observation non-causal", async () => {
    const user = userEvent.setup();
    renderWithLocale(<OperatorRuntime />);
    await user.click(screen.getByRole("button", { name: /Synthetic GCC · Dubai pause/i }));
    await user.type(screen.getByLabelText("Override reason"), "Context outside the import needs review");
    await user.type(screen.getByLabelText("Intended action"), "Call once to verify timing");
    await user.click(screen.getByRole("button", { name: "Record material override" }));
    expect(screen.getByTestId("override-ledger")).toHaveTextContent("1 append-only records");
    await user.click(screen.getByRole("button", { name: "Record synthetic later observation" }));
    expect(screen.getByText(/does not establish that the operator or SalesOS was right/i)).toBeInTheDocument();
  });

  it("B4-020 clears all visible runtime state and can reload only the explicit synthetic session", async () => {
    const user = userEvent.setup();
    renderWithLocale(<OperatorRuntime />);
    await user.click(screen.getByRole("button", { name: "Clear operator session" }));
    expect(screen.getByTestId("session-cleared")).toHaveTextContent("No operator data remains");
    expect(screen.queryByTestId("decision-workspace")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load explicitly synthetic session" }));
    expect(screen.getByTestId("operator-runtime")).toBeInTheDocument();
  });

  it("B4-021 renders real Arabic operator copy and mixed-language evidence", async () => {
    const user = userEvent.setup();
    renderWithLocale(<><LocaleSwitch /><OperatorRuntime /></>);
    await user.click(screen.getByRole("button", { name: "العربية" }));
    expect(screen.getByRole("heading", { name: "ما الذي يستحق انتباهك الآن؟" })).toBeInTheDocument();
    expect(screen.getByText("قائمة الأوامر")).toBeInTheDocument();
    expect(screen.getByText("سجل تجاوز التوصية")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Palm Hills \/ EGP/i }));
    expect(screen.getByTestId("evidence-contract")).toHaveTextContent("عقد الأدلة");
  });

  it("B4-022 exposes only recommendation and local record controls", () => {
    renderWithLocale(<OperatorRuntime />);
    expect(screen.queryByRole("button", { name: /send|email|schedule|write to crm|contact customer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot call, send, schedule, write to CRM/i)).toBeInTheDocument();
  });

  it("B4-023 moves only accepted S1 parser output into the in-memory runtime", async () => {
    const user = userEvent.setup();
    const { container } = renderWithLocale(<OperatorRuntime />);
    await user.click(screen.getByText("Load accepted S1 input into this session"));
    await user.click(screen.getByRole("button", { name: "Load synthetic example" }));
    expect(screen.getByTestId("import-preview")).toHaveAttribute("data-import-status", "ACCEPTED");
    await user.click(screen.getByRole("button", { name: "Use accepted input in Operator Runtime" }));
    expect(screen.queryByRole("button", { name: /Payment-plan commitment/i })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-queue-section] button[aria-pressed="true"]')).toHaveLength(1);
  });

  it("B4-024 records trial feedback without presenting it as buyer evidence", async () => {
    const user = userEvent.setup();
    renderWithLocale(<OperatorRuntime />);
    await user.selectOptions(screen.getByLabelText("What did you observe?"), "FALSE_URGENCY");
    await user.type(screen.getByLabelText("Optional context"), "The item did not need immediate action");
    await user.click(screen.getByRole("button", { name: "Record trial signal" }));
    expect(screen.getByTestId("trial-instrumentation")).toHaveTextContent("2 signals recorded");
    expect(screen.getByTestId("evidence-contract")).not.toHaveTextContent("The item did not need immediate action");
  });
});
