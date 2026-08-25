import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithLocale } from "./test-utils";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import { FIXTURE_9_NEW_SNAPSHOT_AVAILABLE, FIXTURE_9_NEWER_SNAPSHOT } from "@/lib/fixtures";
import { SnapshotComparisonView } from "@/components/salesos/DecisionCard/SnapshotComparison/SnapshotComparisonView";

describe("new snapshot does not silently replace the current one", () => {
  it("shows the CURRENT snapshot's own decision, plus an explicit banner, not the newer one", () => {
    renderWithLocale(<DecisionCard snapshot={FIXTURE_9_NEW_SNAPSHOT_AVAILABLE} />);
    // The rendered decision state must be the OLD snapshot's state
    // (NO_ACTION), never silently swapped for the newer one's
    // (NEXT_STEP_READY).
    expect(document.querySelector('[data-decision-state="NO_ACTION"]')).not.toBeNull();
    expect(document.querySelector('[data-decision-state="NEXT_STEP_READY"]')).toBeNull();
  });

  it("offers an explicit compare action rather than auto-navigating", async () => {
    const onCompare = vi.fn();
    renderWithLocale(<DecisionCard snapshot={FIXTURE_9_NEW_SNAPSHOT_AVAILABLE} onCompare={onCompare} />);
    const compareButton = screen.getByRole("button", { name: /compare/i });
    await userEvent.click(compareButton);
    expect(onCompare).toHaveBeenCalledOnce();
  });
});

describe("explicit snapshot comparison", () => {
  it("shows both before and after decision states side by side, never asserting 'wrong' or 'overridden'", () => {
    const { container } = renderWithLocale(
      <SnapshotComparisonView before={FIXTURE_9_NEW_SNAPSHOT_AVAILABLE} after={FIXTURE_9_NEWER_SNAPSHOT} onBack={() => {}} />,
    );
    expect(document.querySelector('[data-decision-state="NO_ACTION"]')).not.toBeNull();
    expect(document.querySelector('[data-decision-state="NEXT_STEP_READY"]')).not.toBeNull();
    const text = container.textContent?.toLowerCase() ?? "";
    expect(text).not.toMatch(/was wrong/);
    expect(text).not.toMatch(/overrode/);
    expect(text).not.toMatch(/previous decision was incorrect/);
  });

  it("treats an unchanged decision as a valid outcome, not an error", () => {
    renderWithLocale(
      <SnapshotComparisonView before={FIXTURE_9_NEW_SNAPSHOT_AVAILABLE} after={FIXTURE_9_NEW_SNAPSHOT_AVAILABLE} onBack={() => {}} />,
    );
    expect(screen.getByText(/unchanged/i)).toBeInTheDocument();
  });

  it("preserves history across the comparison", () => {
    renderWithLocale(
      <SnapshotComparisonView before={FIXTURE_9_NEW_SNAPSHOT_AVAILABLE} after={FIXTURE_9_NEWER_SNAPSHOT} onBack={() => {}} />,
    );
    expect(screen.getByText(new RegExp(`${FIXTURE_9_NEWER_SNAPSHOT.history.length}`))).toBeInTheDocument();
  });
});
