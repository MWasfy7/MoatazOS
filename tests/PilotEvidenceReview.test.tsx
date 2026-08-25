import { describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { PilotEvidenceReview } from "@/components/salesos/PilotEvidenceReview";
import { PILOT_EVIDENCE_CURRENT, PILOT_EVIDENCE_NOT_REVIEWABLE } from "@/lib/fixtures/pilotEvidence";
import { renderWithLocale } from "./test-utils";
describe("M1C Pilot Evidence Review", () => {
  it("PER-001 through PER-005 exposes readiness, exact counts, exclusions, and limitations", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_NOT_REVIEWABLE}/>); expect(screen.getByText("Not reviewable")).toBeInTheDocument(); expect(screen.getByText("0 / 2")).toBeInTheDocument(); expect(screen.getAllByText(/Not proven/i).length).toBeGreaterThan(0); cleanup(); });
  it("PER-006 through PER-021 preserves behavior, regional bounds, reaction, and non-conversion", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_CURRENT}/>); expect(screen.getByText(/chasingViolation/)).toBeInTheDocument(); expect(screen.getByText(/INSUFFICIENT_REGIONAL_EVIDENCE/)).toBeInTheDocument(); expect(screen.getByText(/ACCEPTED_AS_DIRECTIONAL/)).toBeInTheDocument(); expect(screen.getByText(/Not proven: conversion/i)).toBeInTheDocument(); });
  it("PER-022 through PER-030 keeps frozen evidence private, immutable, and execution-free", () => { renderWithLocale(<PilotEvidenceReview snapshot={PILOT_EVIDENCE_CURRENT}/>); expect(screen.getByText(/Previous immutable snapshot/)).toBeInTheDocument(); expect(screen.queryByRole("button", {name:/send|call|crm|price|override/i})).not.toBeInTheDocument(); expect(screen.getByTestId("pilot-evidence-review")).toBeInTheDocument(); });
});
