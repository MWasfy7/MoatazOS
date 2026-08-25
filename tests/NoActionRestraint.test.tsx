import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import {
  FIXTURE_M1A_CHASING_VIOLATION,
  FIXTURE_M1A_EXPLICIT_PAUSE,
  FIXTURE_M1A_LATER_COMMITMENT,
  FIXTURE_M1A_LATER_REPLY,
  FIXTURE_M1A_NOT_OBSERVABLE,
  FIXTURE_M1A_RESTRAINT_RESPECTED,
} from "@/lib/fixtures";
import { renderWithLocale } from "./test-utils";

describe("M1A NO_ACTION restraint acceptance", () => {
  it("NAR-001 through NAR-003 render a nonblank review with boundaries and reevaluation conditions", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_EXPLICIT_PAUSE} />);
    expect(screen.getByTestId("no-action-restraint-review")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("do-not-do-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("reengagement-conditions")).toBeInTheDocument();
  });

  it("NAR-004 and NAR-005 show a buyer boundary without calling silence rejection", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_EXPLICIT_PAUSE} />);
    expect(screen.getByText("BUYER_BOUNDARY")).toBeInTheDocument();
    expect(screen.getByText(/not classified as buyer rejection/i)).toBeInTheDocument();
  });

  it("NAR-006 and NAR-007 render a chasing violation distinctly", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_CHASING_VIOLATION} />);
    expect(screen.getByText("CHASING_VIOLATION")).toBeInTheDocument();
    expect(screen.getByTestId("seller-behavior-review")).toHaveAttribute("data-restraint-behavior", "CHASING_VIOLATION");
  });

  it("NAR-008 renders respected restraint distinctly", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_RESTRAINT_RESPECTED} />);
    expect(screen.getByText("RESTRAINT_RESPECTED")).toBeInTheDocument();
    expect(screen.getByTestId("seller-behavior-review")).toHaveAttribute("data-restraint-behavior", "RESTRAINT_RESPECTED");
  });

  it("NAR-009 renders incomplete observation without inferring compliance", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_NOT_OBSERVABLE} />);
    expect(screen.getByText("NOT_OBSERVABLE")).toBeInTheDocument();
    expect(screen.getByTestId("seller-behavior-review")).toHaveAttribute("data-restraint-behavior", "NOT_OBSERVABLE");
  });

  it("NAR-010 preserves later buyer-reply outcome limits", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_LATER_REPLY} />);
    expect(screen.getByText(/does not prove restraint caused it/i)).toBeInTheDocument();
  });

  it("NAR-010 preserves violations after later commitment", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_LATER_COMMITMENT} />);
    expect(screen.getByText(/violation remains preserved/i)).toBeInTheDocument();
  });

  it("NAR-011 through NAR-016 expose reevaluation only and preserve frozen history", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_RESTRAINT_RESPECTED} />);
    expect(screen.getByText(/Reevaluation only; it does not authorize contact/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send|call|override/i })).not.toBeInTheDocument();
  });

  it("NAR-017 through NAR-024 protect privacy, chronology, semantics, and authority", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_CHASING_VIOLATION} />);
    expect(screen.getByTestId("no-action-snapshot-metadata")).toHaveTextContent("Effective:");
    expect(screen.getByTestId("seller-behavior-review")).toHaveTextContent("CHASING_VIOLATION");
    expect(screen.getByTestId("no-action-uncertainty-panel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send|call|stage|price|schedule|override/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/@|https?:\/\//)).not.toBeInTheDocument();
  });
});
