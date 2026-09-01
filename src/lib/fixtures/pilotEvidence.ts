import type { PilotEvidenceSnapshot } from "../types";

// Deterministic, aggregate-only M1C evidence. No event is a real buyer record.
export const PILOT_EVIDENCE_CURRENT: PilotEvidenceSnapshot = {
  pilotId: "pilot-eg-gcc-001", snapshotId: "pilot-snapshot-002", alias: "EGYPT_GCC_FROZEN", observationWindow: "AUGUST_2026", readiness: "EVIDENCE_READY", freshness: "SUPERSEDED", validatedEpisodes: 12, excludedEpisodes: 3, distinctCompanies: 8,
  regions: { Egypt: { numerator: 8, denominator: 10, excluded: 2, state: "MEANINGFUL" }, GCC: { numerator: 1, denominator: 2, excluded: 1, state: "INSUFFICIENT_REGIONAL_EVIDENCE" } },
  behavior: { nextStepReady: 5, noAction: 7, restraintRespected: 4, chasingViolation: 1, buyerSignalAfterRestraint: 2, buyerSignalAfterChasing: 1 },
  buyerReaction: "ACCEPTED_AS_DIRECTIONAL", commercial: "PROPOSAL_REQUEST", dispute: "CORRECTION_VALIDATED", correctionSnapshotId: "pilot-snapshot-003", limitations: ["notProven", "descriptiveOnly", "regionalLimit"], provenance: "SYNTHETIC_FROZEN_AGGREGATE",
};

export const PILOT_EVIDENCE_DISPUTED: PilotEvidenceSnapshot = { ...PILOT_EVIDENCE_CURRENT, snapshotId: "pilot-snapshot-001", alias: "DISPUTED_FROZEN", readiness: "EVIDENCE_READY", freshness: "SUPERSEDED", buyerReaction: "DISPUTED", dispute: "DISPUTED", correctionSnapshotId: "pilot-snapshot-003" };
export const PILOT_EVIDENCE_PENDING_CORRECTION: PilotEvidenceSnapshot = { ...PILOT_EVIDENCE_DISPUTED, alias: "CORRECTION_PENDING_FROZEN", dispute: "CORRECTION_PENDING", correctionSnapshotId: undefined };
export const PILOT_EVIDENCE_NOT_REVIEWABLE: PilotEvidenceSnapshot = {
  ...PILOT_EVIDENCE_CURRENT,
  snapshotId: "pilot-snapshot-000",
  alias: "INSUFFICIENT_FROZEN",
  readiness: "NOT_REVIEWABLE",
  validatedEpisodes: 0,
  excludedEpisodes: 2,
  distinctCompanies: 0,
  regions: { Egypt: { numerator: 0, denominator: 0, excluded: 1, state: "INSUFFICIENT_REGIONAL_EVIDENCE" }, GCC: { numerator: 0, denominator: 0, excluded: 1, state: "INSUFFICIENT_REGIONAL_EVIDENCE" } },
  behavior: { nextStepReady: 0, noAction: 0, restraintRespected: 0, chasingViolation: 0, buyerSignalAfterRestraint: 0, buyerSignalAfterChasing: 0 },
  buyerReaction: "NOT_REVIEWED",
  commercial: "NO_COMMERCIAL_STEP",
  dispute: "NO_DISPUTE",
  correctionSnapshotId: undefined,
};
