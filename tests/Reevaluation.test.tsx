import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithLocale } from "./test-utils";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import { FIXTURE_3_NO_ACTION_REEVAL_ELIGIBLE } from "@/lib/fixtures";

describe("reevaluation eligibility never auto-applies", () => {
  it("keeps the decision at NO_ACTION even though a validated signal exists", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_3_NO_ACTION_REEVAL_ELIGIBLE} />);
    expect(document.querySelector('[data-decision-state="NO_ACTION"]')).not.toBeNull();
  });

  it("shows reevaluation-eligible metadata as a banner, not as a state change", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_3_NO_ACTION_REEVAL_ELIGIBLE} />);
    expect(screen.getByText(FIXTURE_3_NO_ACTION_REEVAL_ELIGIBLE.reevaluationReason!)).toBeInTheDocument();
  });
});
