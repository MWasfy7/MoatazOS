import type { QualificationEvidenceItem, QualificationStatus, RevenueNextStep } from "./types";

const CORE_QUALIFICATION_TYPES = ["BUDGET_CONFIRMED", "TIMELINE_CONFIRMED", "AUTHORITY_CONFIRMED", "NEED_CONFIRMED"] as const;

/**
 * Derives a qualification status from evidence only — never from
 * elapsed time, contact attempts, or absence of a response. No
 * evidence at all always reads `"UNKNOWN"`, never `"DISQUALIFIED"`:
 * missing qualification must stay unknown until a buyer-attributed
 * signal says otherwise, explicitly, one way or the other.
 */
export function deriveQualificationStatus(evidence: QualificationEvidenceItem[]): QualificationStatus {
  if (evidence.length === 0) {
    return "UNKNOWN";
  }
  if (evidence.some((item) => item.type === "DISQUALIFYING_SIGNAL")) {
    return "DISQUALIFIED";
  }
  const presentCoreTypes = new Set(evidence.map((item) => item.type).filter((type) => (CORE_QUALIFICATION_TYPES as readonly string[]).includes(type)));
  if (presentCoreTypes.size >= CORE_QUALIFICATION_TYPES.length) {
    return "QUALIFIED";
  }
  return "PARTIALLY_QUALIFIED";
}

/**
 * Maps a qualification status to a bounded, descriptive next-step
 * class. Like the rest of this product, this names a *class* of next
 * step for a human seller to act on — it is never itself an action.
 */
export function deriveNextStep(
  status: QualificationStatus,
  evidence: QualificationEvidenceItem[],
  asOf: string,
): RevenueNextStep {
  if (status === "DISQUALIFIED") {
    return {
      stepClass: "NO_STEP_IDENTIFIED",
      basedOnEvidenceIds: evidence.filter((item) => item.type === "DISQUALIFYING_SIGNAL").map((item) => item.id),
      identifiedAt: asOf,
    };
  }
  if (status === "UNKNOWN") {
    return {
      stepClass: "GATHER_MISSING_QUALIFICATION_EVIDENCE",
      basedOnEvidenceIds: [],
      identifiedAt: asOf,
    };
  }
  if (status === "PARTIALLY_QUALIFIED") {
    return {
      stepClass: "GATHER_MISSING_QUALIFICATION_EVIDENCE",
      basedOnEvidenceIds: evidence.map((item) => item.id),
      identifiedAt: asOf,
    };
  }
  return {
    stepClass: "SCHEDULE_QUALIFICATION_FOLLOWUP",
    basedOnEvidenceIds: evidence.map((item) => item.id),
    identifiedAt: asOf,
  };
}
