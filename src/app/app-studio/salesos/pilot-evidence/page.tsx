"use client";
import { PilotEvidenceReview } from "@/components/salesos/PilotEvidenceReview";
import { PILOT_EVIDENCE_CURRENT } from "@/lib/fixtures/pilotEvidence";
import { PILOT_EVIDENCE_DISPUTED, PILOT_EVIDENCE_NOT_REVIEWABLE, PILOT_EVIDENCE_PENDING_CORRECTION } from "@/lib/fixtures/pilotEvidence";
export default function PilotEvidencePage({ searchParams }: { searchParams?: { snapshot?: string } }) { const snapshots = { current: PILOT_EVIDENCE_CURRENT, disputed: PILOT_EVIDENCE_DISPUTED, notReviewable: PILOT_EVIDENCE_NOT_REVIEWABLE, pending: PILOT_EVIDENCE_PENDING_CORRECTION }; return <PilotEvidenceReview snapshot={snapshots[searchParams?.snapshot as keyof typeof snapshots] ?? PILOT_EVIDENCE_CURRENT}/>; }
