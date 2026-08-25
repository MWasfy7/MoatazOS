"use client";
import { PilotEvidenceReview } from "@/components/salesos/PilotEvidenceReview";
import { PILOT_EVIDENCE_CURRENT } from "@/lib/fixtures/pilotEvidence";
export default function PilotEvidencePage(){ return <PilotEvidenceReview snapshot={PILOT_EVIDENCE_CURRENT}/>; }
