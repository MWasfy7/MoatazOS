import { CouncilWorkspace } from "@/components/donna/CouncilWorkspace";
import { getOpportunity, getSnapshot } from "@/lib/fixtures";
import { checkSnapshotIntegrity } from "@/lib/types";
import { notFound } from "next/navigation";

export default function SalesCouncilPage({ params }: { params: { opportunityId: string } }) {
  const opportunity = getOpportunity(params.opportunityId);
  const snapshot = opportunity ? getSnapshot(opportunity.currentSnapshotId) : undefined;
  if (!opportunity || !snapshot) notFound();
  const integrity = checkSnapshotIntegrity(snapshot);
  const allowed = integrity.ok && snapshot.decisionState === "NEXT_STEP_READY" && snapshot.freshness === "CURRENT";
  const reason = !integrity.ok ? "Integrity blocked" : `${snapshot.decisionState} · ${snapshot.freshness}`;
  const facts = snapshot.evidence.filter((item) => item.group === "validated").map((item) => `- ${item.label}`).join("\n");
  const initialCase = `Synthetic SalesOS opportunity ${snapshot.opportunityId} (${snapshot.buyerAlias}).\nDecision: ${reason}.\nValidated evidence:\n${facts || "- None supplied"}\nSource: ${snapshot.provenance.source}`;
  return <CouncilWorkspace initialCase={initialCase} salesGate={{ allowed, reason, snapshotId: snapshot.snapshotId }} />;
}
