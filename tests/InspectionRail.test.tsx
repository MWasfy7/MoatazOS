import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithLocale } from "./test-utils";
import { InspectionRail } from "@/components/salesos/DecisionCard/InspectionRail/InspectionRail";
import { FIXTURE_7_CONTRADICTORY_EVIDENCE, FIXTURE_2_NO_ACTION_PENDING } from "@/lib/fixtures";

describe("InspectionRail", () => {
  it("renders all eight inspection items", () => {
    renderWithLocale(<InspectionRail snapshot={FIXTURE_7_CONTRADICTORY_EVIDENCE} />);
    const items = ["evidence", "whyThisDecision", "uncertainty", "buyerSignals", "managerReview", "pilotEvidence", "history", "provenance"];
    for (const key of items) {
      expect(document.querySelector(`[data-inspection-item="${key}"]`)).not.toBeNull();
    }
  });

  it("opens the Evidence drawer showing pending evidence marked as unused in the current decision", async () => {
    renderWithLocale(<InspectionRail snapshot={FIXTURE_2_NO_ACTION_PENDING} />);
    const evidenceButton = document.querySelector('[data-inspection-item="evidence"]') as HTMLElement;
    await userEvent.click(evidenceButton);
    expect(screen.getByText(/not used in current decision/i)).toBeInTheDocument();
  });

  it("closes the drawer on Escape", async () => {
    renderWithLocale(<InspectionRail snapshot={FIXTURE_7_CONTRADICTORY_EVIDENCE} />);
    const evidenceButton = document.querySelector('[data-inspection-item="evidence"]') as HTMLElement;
    await userEvent.click(evidenceButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no action/write controls inside any drawer", async () => {
    renderWithLocale(<InspectionRail snapshot={FIXTURE_7_CONTRADICTORY_EVIDENCE} />);
    for (const key of ["evidence", "whyThisDecision", "uncertainty", "buyerSignals"]) {
      const button = document.querySelector(`[data-inspection-item="${key}"]`) as HTMLElement;
      await userEvent.click(button);
      const dialog = screen.getByRole("dialog");
      const inputs = dialog.querySelectorAll("input, textarea, select");
      expect(inputs.length).toBe(0);
      await userEvent.keyboard("{Escape}");
    }
  });
});
