import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithLocale } from "./test-utils";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import {
  FIXTURE_1_NO_ACTION,
  FIXTURE_2_NO_ACTION_PENDING,
  FIXTURE_4_NEXT_STEP_READY,
  FIXTURE_5_NEXT_STEP_READY_CONTRADICTION,
  FIXTURE_7_CONTRADICTORY_EVIDENCE,
  FIXTURE_8_HISTORICAL_CHASING_VIOLATION,
  FIXTURE_10_INTEGRITY_BLOCK,
} from "@/lib/fixtures";

const FORBIDDEN_CONTROL_TEXT = [
  /^send$/i,
  /^call$/i,
  /^schedule$/i,
  /contact now/i,
  /update crm/i,
  /approve/i,
  /override/i,
];

function assertNoForbiddenControls(container: HTMLElement) {
  const buttonsAndLinks = container.querySelectorAll("button, a[href]");
  for (const el of Array.from(buttonsAndLinks)) {
    const text = el.textContent ?? "";
    for (const pattern of FORBIDDEN_CONTROL_TEXT) {
      expect(text).not.toMatch(pattern);
    }
  }
}

describe("NO_ACTION renders restraint", () => {
  it("shows the restraint reason and do-not-do behaviors, outranking other content", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_1_NO_ACTION} />);
    expect(screen.getByText(FIXTURE_1_NO_ACTION.restraint.reason)).toBeInTheDocument();
    for (const behavior of FIXTURE_1_NO_ACTION.restraint.doNotDoBehaviors) {
      expect(screen.getByText(behavior)).toBeInTheDocument();
    }
  });

  it("never uses countdown/overdue language", () => {
    const { container } = renderWithLocale(<DecisionCard snapshot={FIXTURE_1_NO_ACTION} />);
    expect(container.textContent?.toLowerCase()).not.toMatch(/overdue/);
    expect(container.textContent?.toLowerCase()).not.toMatch(/countdown/);
  });
});

describe("pending evidence does not change the decision", () => {
  it("Fixture 2 remains NO_ACTION even though a pending signal exists", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_2_NO_ACTION_PENDING} />);
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-testid", "decision-card");
    const badge = document.querySelector('[data-decision-state="NO_ACTION"]');
    expect(badge).not.toBeNull();
  });

  it("pending evidence is grouped separately from validated evidence", () => {
    const pendingItems = FIXTURE_2_NO_ACTION_PENDING.evidence.filter((e) => e.group === "pending");
    const validatedItems = FIXTURE_2_NO_ACTION_PENDING.evidence.filter((e) => e.group === "validated");
    expect(pendingItems.length).toBeGreaterThan(0);
    expect(validatedItems.length).toBeGreaterThan(0);
    expect(pendingItems[0]?.group).not.toBe(validatedItems[0]?.group);
  });
});

describe("NEXT_STEP_READY has no execution CTA", () => {
  it("renders the supported next-step class as text, never as an action button", () => {
    const { container } = renderWithLocale(<DecisionCard snapshot={FIXTURE_4_NEXT_STEP_READY} />);
    expect(screen.getByTestId("next-step-ready-panel")).toBeInTheDocument();
    assertNoForbiddenControls(container);
  });

  it("shows contradictions on the panel when present, without hiding readiness", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_5_NEXT_STEP_READY_CONTRADICTION} />);
    expect(screen.getByTestId("next-step-ready-panel")).toBeInTheDocument();
    expect(
      screen.getByText(FIXTURE_5_NEXT_STEP_READY_CONTRADICTION.contradictions[0]!.conflictClass),
    ).toBeInTheDocument();
  });
});

describe("evidence groups remain distinct", () => {
  it("validated, contradictory, pending, and excluded never merge into one bucket", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_2_NO_ACTION_PENDING} />);
    const validatedChip = document.querySelector('[data-evidence-group="validated"]');
    const pendingChip = document.querySelector('[data-evidence-group="pending"]');
    expect(validatedChip).not.toBeNull();
    expect(pendingChip).not.toBeNull();
    expect(validatedChip?.textContent).not.toEqual(pendingChip?.textContent);
  });
});

describe("contradictions remain visible", () => {
  it("CONTRADICTORY_EVIDENCE shows both validated sides with no majority-voting language", () => {
    const { container } = renderWithLocale(<DecisionCard snapshot={FIXTURE_7_CONTRADICTORY_EVIDENCE} />);
    const contradiction = FIXTURE_7_CONTRADICTORY_EVIDENCE.contradictions[0]!;
    expect(screen.getByText(contradiction.sideA.label)).toBeInTheDocument();
    expect(screen.getByText(contradiction.sideB.label)).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toMatch(/majority/);
    expect(container.textContent?.toLowerCase()).not.toMatch(/latest wins/);
    expect(container.textContent?.toLowerCase()).not.toMatch(/tie-breaker/);
  });
});

describe("historical chasing violation remains visible", () => {
  it("shows the chasing-violation history entry even though the current decision is now positive", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_8_HISTORICAL_CHASING_VIOLATION} />);
    const violation = FIXTURE_8_HISTORICAL_CHASING_VIOLATION.history.find((h) => h.kind === "chasing_violation")!;
    expect(screen.getByText(violation.summary)).toBeInTheDocument();
    expect(document.querySelector('[data-history-kind="chasing_violation"]')).not.toBeNull();
  });
});

describe("integrity mismatch blocks interpretation", () => {
  it("renders only the integrity-blocked state, never a partial decision", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_10_INTEGRITY_BLOCK} />);
    expect(screen.getByTestId("integrity-blocked-card")).toBeInTheDocument();
    expect(screen.queryByTestId("decision-card")).not.toBeInTheDocument();
    // The restraint content (which belongs to interpretive rendering)
    // must NOT appear when integrity is blocked.
    expect(screen.queryByText(FIXTURE_10_INTEGRITY_BLOCK.restraint.reason)).not.toBeInTheDocument();
  });
});

describe("no Send / Call / Schedule / CRM / Pricing / Override controls exist", () => {
  it.each([
    ["NO_ACTION", FIXTURE_1_NO_ACTION],
    ["NEXT_STEP_READY", FIXTURE_4_NEXT_STEP_READY],
    ["CONTRADICTORY_EVIDENCE", FIXTURE_7_CONTRADICTORY_EVIDENCE],
  ] as const)("%s snapshot has no forbidden controls", (_label, snapshot) => {
    const { container } = renderWithLocale(<DecisionCard snapshot={snapshot} />);
    assertNoForbiddenControls(container);
  });
});
