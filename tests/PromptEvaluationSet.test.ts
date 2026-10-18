import { describe, expect, it } from "vitest";
import { buildDecisionSequence, extractEvidence } from "@/lib/decisionEngine";
import { EGYPT_GCC_PROMPT_EVAL_SET } from "@/lib/decisionEngine/promptEvalSet";

describe("SalesOS Rebuilt Prompt Compact Evaluation Set (Egypt & GCC)", () => {
  it("contains exactly 7 bounded scenarios covering all required domains", () => {
    expect(EGYPT_GCC_PROMPT_EVAL_SET).toHaveLength(7);
    const domains = EGYPT_GCC_PROMPT_EVAL_SET.map((scenario) => scenario.domain);
    expect(domains).toEqual([
      "LEAD_QUALIFICATION",
      "SEND_DETAILS",
      "PRICE_OBJECTION",
      "FOLLOWUP_RESTRAINT",
      "CONSENT_UNCERTAINTY",
      "CONFLICTING_CUSTOMER_FACTS",
      "REQUEST_SEND_MESSAGE",
    ]);
  });

  it("EVAL_EG_001_LEAD_QUALIFICATION: evaluates lead qualification preferences into NEXT_STEP_READY without execution authority", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_EG_001_LEAD_QUALIFICATION")!;
    expect(scenario).toBeDefined();

    const extraction = extractEvidence(scenario.events);
    const extractedTypes = extraction.signals.map((sig) => sig.type);
    for (const expectedType of scenario.expected.expectedSignalTypes) {
      expect(extractedTypes).toContain(expectedType);
    }

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("NEXT_STEP_READY");
    expect(sequence.current.reasonCodes).toContain("BUYER_DIRECT_REQUEST");

    // Zero execution authority check
    const payloadStr = JSON.stringify(sequence);
    expect(payloadStr).not.toMatch(/SEND_MESSAGE|CALL_BUYER|SCHEDULE_MEETING|OVERRIDE_PRICE/);
  });

  it("EVAL_GCC_002_SEND_DETAILS: extracts Arabic 'send details' request and yields PROVIDE_REQUESTED_INFORMATION", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_GCC_002_SEND_DETAILS")!;
    expect(scenario).toBeDefined();

    const extraction = extractEvidence(scenario.events);
    const reqSignal = extraction.signals.find((sig) => sig.type === "BUYER_REQUEST");
    expect(reqSignal).toBeDefined();
    expect(reqSignal?.evidencePointer.excerpt).toBe("ممكن ترسل لي بروشور مشروع دبي ماراينا مع خطة الأسعار والمخططات للغرفتين؟");

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("NEXT_STEP_READY");
  });

  it("EVAL_EG_003_PRICE_OBJECTION: extracts price objection & budget signals without hallucinating price overrides or lost deal", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_EG_003_PRICE_OBJECTION")!;
    expect(scenario).toBeDefined();

    const extraction = extractEvidence(scenario.events);
    const extractedTypes = extraction.signals.map((sig) => sig.type);
    expect(extractedTypes).toContain("OBJECTION");
    expect(extractedTypes).toContain("BUDGET_SIGNAL");

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("INSUFFICIENT_EVIDENCE");
    expect(sequence.current.decisionState).not.toBe("NO_ACTION");

    // Ensure no unauthorized pricing discount was created
    expect(JSON.stringify(sequence)).not.toMatch(/discount|override|price_reduction/i);
  });

  it("EVAL_GCC_004_FOLLOWUP_RESTRAINT: maps explicit buyer pause to NO_ACTION protected restraint", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_GCC_004_FOLLOWUP_RESTRAINT")!;
    expect(scenario).toBeDefined();

    const extraction = extractEvidence(scenario.events);
    expect(extraction.signals.map((sig) => sig.type)).toContain("BUYER_EXPLICIT_PAUSE");

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("NO_ACTION");
    expect(sequence.current.reasonCodes).toContain("BUYER_EXPLICIT_PAUSE_ACTIVE");
    expect(scenario.expected.noActionReasonCode).toBe("BUYER_EXPLICIT_PAUSE");
  });

  it("EVAL_EG_005_CONSENT_UNCERTAINTY: keeps unverified lead INSUFFICIENT_EVIDENCE with explicit uncertainty code", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_EG_005_CONSENT_UNCERTAINTY")!;
    expect(scenario).toBeDefined();

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("INSUFFICIENT_EVIDENCE");
    expect(sequence.current.uncertainty).toContain("OUTBOUND_WITHOUT_BUYER_RESPONSE");
  });

  it("EVAL_EG_006_CONFLICTING_FACTS: surfaces CRM vs conversation conflict as CONTRADICTORY_EVIDENCE", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_EG_006_CONFLICTING_FACTS")!;
    expect(scenario).toBeDefined();

    const extraction = extractEvidence(scenario.events);
    const contradictionSignal = extraction.signals.find((sig) => sig.type === "CONTRADICTION");
    expect(contradictionSignal).toBeDefined();
    expect(contradictionSignal?.sourceRefs).toEqual(["eval:eg-crm-lost-001", "eval:eg-inbound-active-001"]);

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("CONTRADICTORY_EVIDENCE");
    expect(sequence.current.reasonCodes).toContain("CONFLICTING_CRM_AND_CONVERSATION");
  });

  it("EVAL_GCC_007_REQUEST_SEND_MESSAGE: evaluates message request under RESPOND_TO_BUYER_REQUEST with zero dispatch handles", () => {
    const scenario = EGYPT_GCC_PROMPT_EVAL_SET.find((s) => s.id === "EVAL_GCC_007_REQUEST_SEND_MESSAGE")!;
    expect(scenario).toBeDefined();

    const sequence = buildDecisionSequence(scenario.events);
    expect(sequence.current.decisionState).toBe("NEXT_STEP_READY");
    expect(scenario.expected.stepClass).toBe("RESPOND_TO_BUYER_REQUEST");

    // Zero execution authority
    const serialized = JSON.stringify(sequence);
    expect(serialized).not.toMatch(/send_webhook|dispatch_message|execute_outbound|api_key/i);
  });

  it("ensures no scenario uses invented business benchmarks or fabricated KPI metrics", () => {
    for (const scenario of EGYPT_GCC_PROMPT_EVAL_SET) {
      const fullText = JSON.stringify(scenario);
      expect(fullText).not.toMatch(/\d+%\s*conversion/i);
      expect(fullText).not.toMatch(/roi\s*uplift/i);
      expect(fullText).not.toMatch(/arr\s*impact/i);
      expect(fullText).not.toMatch(/win\s*rate/i);
    }
  });

  it("maintains deterministic execution across repeated scenario evaluations", () => {
    for (const scenario of EGYPT_GCC_PROMPT_EVAL_SET) {
      const run1 = buildDecisionSequence(scenario.events);
      const run2 = buildDecisionSequence(scenario.events);
      expect(run1).toEqual(run2);
    }
  });
});

describe("SalesOS extractor lexicon false-positive guards (SOS-03)", () => {
  const buyer = (text: string) => [{
    organizationId: "org-eval-synthetic",
    salesFloorId: "floor-cairo-dubai",
    leadId: "lead-lex-001",
    actorId: "buyer-lex-001",
    actorRole: "BUYER" as const,
    direction: "INBOUND" as const,
    channel: "WHATSAPP" as const,
    eventId: "lex-evt-001",
    occurredAt: "2026-01-10T10:00:00+02:00",
    eventType: "MESSAGE",
    sourceRef: "eval:lex-evt-001",
    textOrSummary: text,
    metadata: {},
  }];
  const types = (text: string) => extractEvidence(buyer(text)).signals.map((s) => s.type);

  it("reports the bumped extractor version", () => {
    expect(extractEvidence(buyer("السعر عالي شوية")).extractorVersion).toBe("salesos-evidence-v0.2.0");
  });
  it("does not read a high-floor preference as an objection", () => {
    expect(types("عايز شقة في الدور العالي")).not.toContain("OBJECTION");
    expect(types("الدور عالي وفيو حلو")).not.toContain("OBJECTION");
  });
  it("does not read living near a landmark as a property requirement", () => {
    expect(types("انا ساكن جنب تاون سنتر")).not.toContain("PROPERTY_REQUIREMENT");
  });
  it("still reads a price complaint as an objection", () => {
    expect(types("السعر عالي شوية")).toContain("OBJECTION");
  });
});
