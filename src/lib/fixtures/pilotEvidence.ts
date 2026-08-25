import type { PilotEvidenceSnapshot } from "../types";

// Deterministic, aggregate-only M1C evidence. No event is a real buyer record.
export const PILOT_EVIDENCE_CURRENT: PilotEvidenceSnapshot = {
  pilotId: "pilot-eg-gcc-001", snapshotId: "pilot-snapshot-002", alias: "Egypt/GCC frozen pilot review", observationWindow: "2026-08-01 to 2026-08-25", readiness: "EVIDENCE_READY", freshness: "CURRENT", validatedEpisodes: 12, excludedEpisodes: 3, distinctCompanies: 8,
  regions: { Egypt: { numerator: 8, denominator: 10, excluded: 2, state: "MEANINGFUL" }, GCC: { numerator: 1, denominator: 2, excluded: 1, state: "INSUFFICIENT_REGIONAL_EVIDENCE" } },
  behavior: { nextStepReady: 5, noAction: 7, restraintRespected: 4, chasingViolation: 1, buyerSignalAfterRestraint: 2, buyerSignalAfterChasing: 1 },
  buyerReaction: "ACCEPTED_AS_DIRECTIONAL", commercial: "PROPOSAL_REQUEST", dispute: "CORRECTION_VALIDATED", correctionSnapshotId: "pilot-snapshot-002", limitations: ["Not proven: causality, pricing/WTP, ROI, repeatability, or conversion.", "Buyer signals after restraint or chasing are descriptive only and never erase historical behavior.", "GCC has insufficient regional evidence and is not validated by Egypt."], provenance: "Synthetic frozen aggregate; bounded, read-only pilot evidence.",
};

export const PILOT_EVIDENCE_DISPUTED: PilotEvidenceSnapshot = { ...PILOT_EVIDENCE_CURRENT, snapshotId: "pilot-snapshot-001", alias: "Disputed frozen pilot review", readiness: "BUYER_DISPUTED", freshness: "SUPERSEDED", dispute: "DISPUTED", correctionSnapshotId: "pilot-snapshot-002" };
export const PILOT_EVIDENCE_NOT_REVIEWABLE: PilotEvidenceSnapshot = { ...PILOT_EVIDENCE_CURRENT, snapshotId: "pilot-snapshot-000", alias: "Insufficient frozen evidence set", readiness: "NOT_REVIEWABLE", validatedEpisodes: 0, excludedEpisodes: 2, distinctCompanies: 0, regions: { Egypt: { numerator: 0, denominator: 0, excluded: 1, state: "INSUFFICIENT_REGIONAL_EVIDENCE" }, GCC: { numerator: 0, denominator: 0, excluded: 1, state: "INSUFFICIENT_REGIONAL_EVIDENCE" } } };
