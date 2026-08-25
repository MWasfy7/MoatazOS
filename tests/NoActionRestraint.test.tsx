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

  it("NAR-006 through NAR-010 preserve behavior classification and later-outcome limits", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_CHASING_VIOLATION} />);
    expect(screen.getByText("CHASING_VIOLATION")).toBeInTheDocument();
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_RESTRAINT_RESPECTED} />);
    expect(screen.getByText("RESTRAINT_RESPECTED")).toBeInTheDocument();
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_NOT_OBSERVABLE} />);
    expect(screen.getByText("NOT_OBSERVABLE")).toBeInTheDocument();
    renderWithLocale(<DecisionCard snapshot={FIXTURE_M1A_LATER_REPLY} />);
    expect(screen.getByText(/does not prove restraint caused it/i)).toBeInTheDocument();
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
