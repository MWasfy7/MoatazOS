import { describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { PilotEvidenceReview } from "@/components/salesos/PilotEvidenceReview";
import { PILOT_EVIDENCE_CURRENT, PILOT_EVIDENCE_DISPUTED, PILOT_EVIDENCE_NOT_REVIEWABLE, PILOT_EVIDENCE_PENDING_CORRECTION } from "@/lib/fixtures/pilotEvidence";
import { renderWithLocale } from "./test-utils";
describe("M1C Pilot Evidence Review", () => {
  it("PER-001 through PER-005 exposes readiness, exact counts, exclusions, and limitations", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_NOT_REVIEWABLE}/>); expect(screen.getByText("Not reviewable")).toBeInTheDocument(); expect(screen.getByText("0 / 2")).toBeInTheDocument(); expect(screen.getAllByText("0 / 0")).toHaveLength(6); expect(screen.queryByText(/5 \/ 0|7 \/ 0/)).not.toBeInTheDocument(); expect(screen.getAllByText(/Not proven/i).length).toBeGreaterThan(0); cleanup(); });
  it("PER-006 through PER-009 preserves chasing, causality limits, and evidence authority", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_CURRENT}/>); expect(screen.getByText("Chasing violation")).toBeInTheDocument(); expect(screen.getAllByText(/Descriptive only; not causal/i).length).toBeGreaterThan(0); expect(screen.queryByRole("button", {name:/buyer relevance|acceptance/i})).not.toBeInTheDocument(); });
  it("PER-010 through PER-013 keeps disputed and pending snapshots immutable", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_DISPUTED}/>); expect(screen.getAllByText("Disputed").length).toBeGreaterThan(0); expect(screen.getByText(/Superseded by a later snapshot/)).toBeInTheDocument(); cleanup(); renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_PENDING_CORRECTION}/>); expect(screen.queryByText(/Current immutable snapshot/)).not.toBeInTheDocument(); });
  it("PER-014 through PER-021 bounds regions and commercial claims", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_CURRENT}/>); expect(screen.getByText(/1 \/ 2; 1; Insufficient regional evidence/)).toBeInTheDocument(); expect(screen.getByText("Accepted as directional")).toBeInTheDocument(); expect(screen.getByText("Buyer-requested proposal")).toBeInTheDocument(); expect(screen.getByText(/Conversion, pricing\/WTP, and ROI are not proven/i)).toBeInTheDocument(); });
  it("PER-022 through PER-030 keeps frozen evidence private, immutable, and execution-free", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_CURRENT}/>); expect(screen.getByText(/Previous immutable snapshot/)).toBeInTheDocument(); expect(screen.getByText(/4 \/ 7/)).toBeInTheDocument(); expect(screen.getByText(/2 \/ 4/)).toBeInTheDocument(); expect(screen.queryByRole("button", {name:/send|call|crm|price|override/i})).not.toBeInTheDocument(); expect(screen.getByTestId("pilot-evidence-review")).toBeInTheDocument(); });
  it("enforces correction identity and semantic denominators across every fixture", () => {
    const fixtures = [PILOT_EVIDENCE_CURRENT, PILOT_EVIDENCE_DISPUTED, PILOT_EVIDENCE_PENDING_CORRECTION, PILOT_EVIDENCE_NOT_REVIEWABLE];

    for (const fixture of fixtures) {
      expect(fixture.behavior.nextStepReady).toBeLessThanOrEqual(fixture.validatedEpisodes);
      expect(fixture.behavior.noAction).toBeLessThanOrEqual(fixture.validatedEpisodes);
      expect(fixture.behavior.restraintRespected).toBeLessThanOrEqual(fixture.behavior.noAction);
      expect(fixture.behavior.chasingViolation).toBeLessThanOrEqual(fixture.behavior.noAction);
      expect(fixture.behavior.buyerSignalAfterRestraint).toBeLessThanOrEqual(fixture.behavior.restraintRespected);
      expect(fixture.behavior.buyerSignalAfterChasing).toBeLessThanOrEqual(fixture.behavior.chasingViolation);
      if (fixture.correctionSnapshotId) expect(fixture.correctionSnapshotId).not.toBe(fixture.snapshotId);
      if (fixture.dispute === "CORRECTION_VALIDATED") {
        expect(fixture.correctionSnapshotId).toBeDefined();
        expect(fixture.freshness).toBe("SUPERSEDED");
      }
    }

    expect(Object.values(PILOT_EVIDENCE_NOT_REVIEWABLE.behavior).every((count) => count === 0)).toBe(true);
    expect(PILOT_EVIDENCE_NOT_REVIEWABLE.buyerReaction).toBe("NOT_REVIEWED");
    expect(PILOT_EVIDENCE_NOT_REVIEWABLE.commercial).toBe("NO_COMMERCIAL_STEP");
    expect(PILOT_EVIDENCE_NOT_REVIEWABLE.dispute).toBe("NO_DISPUTE");
    expect(PILOT_EVIDENCE_NOT_REVIEWABLE.correctionSnapshotId).toBeUndefined();
  });
});
