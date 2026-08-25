import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import {
  FIXTURE_M1B_CHASING_VIOLATION,
  FIXTURE_M1B_CONTEXT_CORRECTION,
  FIXTURE_M1B_DISAGREEMENT,
  FIXTURE_M1B_INTEGRITY_FLAG,
  FIXTURE_M1B_PENDING,
  FIXTURE_M1B_REJECTED,
  FIXTURE_M1B_RESTRAINT_RESPECTED,
  FIXTURE_M1B_STALE,
  FIXTURE_M1B_VALIDATED_CHANGED,
  FIXTURE_M1B_VALIDATED_UNCHANGED,
} from "@/lib/fixtures";
import { renderWithLocale } from "./test-utils";

describe("M1B manager intervention acceptance", () => {
  it("MIR-001 through MIR-003 record disagreement as commentary without a decision override or confidence control", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_DISAGREEMENT} />);
    expect(screen.getByText(/Manager records disagreement/i)).toBeInTheDocument();
    expect(screen.getAllByText(/does not affect computation/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /override|confidence|next step/i })).not.toBeInTheDocument();
  });

  it("MIR-004 through MIR-007 show pending and integrity claims as non-computational", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_PENDING} />);
    expect(screen.getByText("Pending validation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request reevaluation" })).toBeDisabled();
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_INTEGRITY_FLAG} />);
    expect(screen.getAllByText("Integrity flag").length).toBeGreaterThan(0);
  });

  it("MIR-008 through MIR-010 keep rejected and excluded contributions out of reevaluation", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_REJECTED} />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request reevaluation" })).toBeDisabled();
  });

  it("MIR-011 through MIR-013 preserve correction lineage and admit only validated material", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_CONTEXT_CORRECTION} />);
    expect(screen.getByText("m1b-context-original")).toBeInTheDocument();
    expect(screen.getByText("Validated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request reevaluation" })).toBeEnabled();
  });

  it("MIR-014 through MIR-017 show explicit immutable comparison when validated material leaves NO_ACTION unchanged", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_VALIDATED_UNCHANGED} />);
    const comparison = screen.getByTestId("manager-snapshot-comparison");
    expect(comparison).toHaveTextContent("snap-m1b-unchanged-001");
    expect(comparison).toHaveTextContent("snap-m1b-unchanged-002");
    expect(comparison).toHaveTextContent("Decision unchanged after reevaluation.");
  });

  it("MIR-018 through MIR-020 show a changed decision only in a new immutable snapshot", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_VALIDATED_CHANGED} />);
    const comparison = screen.getByTestId("manager-snapshot-comparison");
    expect(comparison).toHaveTextContent("No action");
    expect(comparison).toHaveTextContent("Next step ready");
    expect(comparison).toHaveTextContent("snap-m1b-changed-001");
    expect(comparison).toHaveTextContent("snap-m1b-changed-002");
  });

  it("MIR-021 and MIR-022 preserve prior restraint behavior across review", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_RESTRAINT_RESPECTED} />);
    expect(screen.getByTestId("seller-behavior-review")).toHaveAttribute("data-restraint-behavior", "RESTRAINT_RESPECTED");
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_CHASING_VIOLATION} />);
    expect(screen.getByTestId("manager-snapshot-comparison")).toHaveTextContent("CHASING_VIOLATION");
  });

  it("MIR-023 blocks stale reviews even when material is validated", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_STALE} />);
    expect(screen.getByRole("button", { name: "Request reevaluation" })).toBeDisabled();
    expect(screen.getByText(/superseded this review/i)).toBeInTheDocument();
  });

  it("MIR-024 keeps local review controls bounded and keyboard-operable", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_DISAGREEMENT} />);
    const review = screen.getByTestId("manager-intervention-review");
    expect(review.querySelectorAll("[data-validation-state]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Record structured contribution" }));
    fireEvent.click(screen.getByRole("button", { name: "Correct context" }));
    fireEvent.click(screen.getByRole("button", { name: "Record structured contribution" }));
    expect(review.querySelectorAll("[data-validation-state]")).toHaveLength(3);
    expect(screen.getAllByText("Pending validation").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Request reevaluation" })).toBeDisabled();
    expect(screen.getByTestId("manager-intervention-timeline")).toHaveTextContent("Context correction pending validation");
    expect(screen.queryByRole("button", { name: /send|call|schedule|price|billing|provision|override/i })).not.toBeInTheDocument();
  });

  it("keeps terminal review states truthful when contribution controls are unavailable", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_STALE} />);
    expect(screen.getByRole("button", { name: "Record structured contribution" })).toBeDisabled();
    expect(screen.getByTestId("manager-intervention-timeline")).toHaveTextContent("Stale review");
    cleanup();
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1B_VALIDATED_CHANGED} />);
    expect(screen.getByRole("button", { name: "Record structured contribution" })).toBeDisabled();
    expect(screen.getByTestId("manager-intervention-timeline")).toHaveTextContent("Reevaluated with a new snapshot");
  });
});
