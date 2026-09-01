import { describe, expect, it } from "vitest";
import {
  createImportPreview,
  maskPii,
  normalizePhone,
  parseCrmCsv,
  parseWhatsappExport,
  SYNTHETIC_CRM_CSV,
  SYNTHETIC_WHATSAPP_EXPORT,
  type ImportContext,
  type WhatsappImportOptions,
} from "@/lib/realInput";

const context: ImportContext = {
  organizationId: "org-synthetic",
  salesFloorId: "floor-synthetic",
  sourceId: "fixture-001",
  defaultTimezoneOffset: "+02:00",
};

const whatsappOptions: WhatsappImportOptions = {
  ...context,
  dateOrder: "DMY",
  participants: [
    { aliases: ["Buyer Synth", "+20 100 111 2233"], actorId: "buyer-001", actorRole: "BUYER", leadId: "lead-001", direction: "INBOUND" },
    { aliases: ["Rep Synth"], actorId: "rep-001", actorRole: "REP", leadId: "lead-001", direction: "OUTBOUND" },
  ],
};

const minimalHeader = "event_id,lead_id,occurred_at,actor_id,actor_role,channel,event_type,direction,source_ref,text_or_summary";

describe("S1 CRM CSV normalization", () => {
  it("S1-001 normalizes events while preserving explicit provenance", () => {
    const result = parseCrmCsv(SYNTHETIC_CRM_CSV, context);
    expect(result.status).toBe("ACCEPTED");
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      organizationId: "org-synthetic",
      salesFloorId: "floor-synthetic",
      sourceRef: "crm-export:synthetic:1",
      occurredAt: "2026-08-24T07:15:00.000Z",
    });
  });

  it("S1-002 keeps real-estate fields outside the industry-neutral core event", () => {
    const result = parseCrmCsv(SYNTHETIC_CRM_CSV, context);
    const event = result.events[0];
    expect(event).toBeDefined();
    expect(event).not.toHaveProperty("project");
    expect(event?.metadata).not.toHaveProperty("project");
    expect(result.realEstateByEventId["crm-001"]).toMatchObject({ project: "Palm Grove", areaOrLocation: "New Cairo" });
  });

  it("S1-003 rejects a missing required column without partial events", () => {
    const result = parseCrmCsv("event_id,lead_id\ne-1,l-1", context);
    expect(result.status).toBe("REJECTED");
    expect(result.events).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "MISSING_COLUMN")).toBe(true);
  });

  it("S1-004 rejects malformed timestamps fail-closed", () => {
    const result = parseCrmCsv(`${minimalHeader}\ne-1,l-1,not-a-date,a-1,REP,CRM,NOTE,INTERNAL,src-1,test`, context);
    expect(result.status).toBe("REJECTED");
    expect(result.events).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_TIMESTAMP" }));
  });

  it("S1-005 removes exact duplicate rows without timeline inflation", () => {
    const headerWithoutSource = "event_id,lead_id,occurred_at,actor_id,actor_role,channel,event_type,direction,text_or_summary";
    const row = "e-1,l-1,2026-08-24T10:00:00Z,a-1,REP,CRM,NOTE,INTERNAL,test";
    const result = parseCrmCsv(`${headerWithoutSource}\n${row}\n${row}`, context);
    expect(result.status).toBe("ACCEPTED");
    expect(result.events).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("S1-006 rejects conflicting content under one event identity", () => {
    const result = parseCrmCsv(`${minimalHeader}\ne-1,l-1,2026-08-24T10:00:00Z,a-1,REP,CRM,NOTE,INTERNAL,src-1,first\ne-1,l-1,2026-08-24T10:01:00Z,a-1,REP,CRM,NOTE,INTERNAL,src-2,second`, context);
    expect(result.status).toBe("REJECTED");
    expect(result.events).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "EVENT_ID_COLLISION" }));
  });

  it("S1-007 rejects normalized phone identity collisions", () => {
    const header = `${minimalHeader},contact_phone`;
    const result = parseCrmCsv(`${header}\ne-1,l-1,2026-08-24T10:00:00Z,a-1,REP,CRM,NOTE,INTERNAL,src-1,first,+201001112233\ne-2,l-2,2026-08-24T10:01:00Z,a-2,REP,CRM,NOTE,INTERNAL,src-2,second,00201001112233`, context);
    expect(result.status).toBe("REJECTED");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "IDENTITY_COLLISION" }));
  });

  it("S1-008 normalizes international phone formatting deterministically", () => {
    expect(normalizePhone("+20 (100) 111-2233")).toBe("+201001112233");
    expect(normalizePhone("0020 100 111 2233")).toBe("+201001112233");
  });

  it("S1-009 sorts out-of-order events and reports the correction", () => {
    const result = parseCrmCsv(`${minimalHeader}\ne-2,l-1,2026-08-24T11:00:00Z,a-1,REP,CRM,NOTE,INTERNAL,src-2,later\ne-1,l-1,2026-08-24T10:00:00Z,a-1,REP,CRM,NOTE,INTERNAL,src-1,earlier`, context);
    expect(result.events.map((event) => event.eventId)).toEqual(["e-1", "e-2"]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "OUT_OF_ORDER", severity: "WARNING" }));
  });

  it("S1-010 preserves Arabic and quoted multiline CSV content", () => {
    const result = parseCrmCsv(`${minimalHeader}\ne-1,l-1,2026-08-24T10:00:00Z,a-1,BUYER,CRM,NOTE,INBOUND,src-1,"أرسل التفاصيل\nوالأسعار المتاحة"`, context);
    expect(result.status).toBe("ACCEPTED");
    expect(result.events[0]?.textOrSummary).toBe("أرسل التفاصيل\nوالأسعار المتاحة");
  });

  it("S1-011 ignores blank records explicitly and preserves source references", () => {
    const result = parseCrmCsv(`${minimalHeader}\n\ne-1,l-1,2026-08-24T10:00:00Z,a-1,REP,CRM,NOTE,INTERNAL,immutable:row:44,test\n`, context);
    expect(result.events[0]?.sourceRef).toBe("immutable:row:44");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "BLANK_RECORD" }));
  });

  it("S1-012 rejects ambiguous local timestamp shapes rather than guessing", () => {
    const result = parseCrmCsv(`${minimalHeader}\ne-1,l-1,01/02/2026 10:00,a-1,REP,CRM,NOTE,INTERNAL,src-1,test`, context);
    expect(result.status).toBe("REJECTED");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_TIMESTAMP" }));
  });
});

describe("S1 WhatsApp export normalization", () => {
  it("S1-013 preserves Arabic and multiline message boundaries", () => {
    const result = parseWhatsappExport(SYNTHETIC_WHATSAPP_EXPORT, whatsappOptions);
    expect(result.status).toBe("ACCEPTED");
    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.textOrSummary).toContain("صباح الخير");
    expect(result.events[0]?.textOrSummary).toContain("\nMy email is");
  });

  it("S1-014 applies explicit DMY parsing and fixed-offset normalization", () => {
    const result = parseWhatsappExport("[01/02/2026, 10:30 PM] - Buyer Synth: test", whatsappOptions);
    expect(result.events[0]?.occurredAt).toBe("2026-02-01T20:30:00.000Z");
  });

  it("S1-015 removes duplicate messages deterministically", () => {
    const line = "[24/08/2026, 10:20] - Buyer Synth: same message";
    const result = parseWhatsappExport(`${line}\n${line}`, whatsappOptions);
    expect(result.status).toBe("ACCEPTED");
    expect(result.events).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
  });

  it("S1-016 rejects unknown senders rather than merging by guesswork", () => {
    const result = parseWhatsappExport("[24/08/2026, 10:20] - Unknown Person: hello", whatsappOptions);
    expect(result.status).toBe("REJECTED");
    expect(result.events).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "UNKNOWN_PARTICIPANT" }));
  });

  it("S1-017 rejects participant alias collisions before parsing", () => {
    const result = parseWhatsappExport(SYNTHETIC_WHATSAPP_EXPORT, {
      ...whatsappOptions,
      participants: [
        ...whatsappOptions.participants,
        { aliases: ["Buyer Synth"], actorId: "other-buyer", actorRole: "BUYER", leadId: "lead-002", direction: "INBOUND" },
      ],
    });
    expect(result.status).toBe("REJECTED");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "IDENTITY_COLLISION" }));
  });

  it("S1-018 rejects malformed leading content fail-closed", () => {
    const result = parseWhatsappExport("not a WhatsApp export\n[24/08/2026, 10:20] - Buyer Synth: hello", whatsappOptions);
    expect(result.status).toBe("REJECTED");
    expect(result.events).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MALFORMED_RECORD" }));
  });

  it("S1-019 sorts out-of-order messages", () => {
    const result = parseWhatsappExport("[24/08/2026, 11:20] - Rep Synth: later\n[24/08/2026, 10:20] - Buyer Synth: earlier", whatsappOptions);
    expect(result.events.map((event) => event.textOrSummary)).toEqual(["earlier", "later"]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "OUT_OF_ORDER" }));
  });

  it("S1-020 creates stable per-message source references", () => {
    const first = parseWhatsappExport(SYNTHETIC_WHATSAPP_EXPORT, whatsappOptions);
    const second = parseWhatsappExport(SYNTHETIC_WHATSAPP_EXPORT, whatsappOptions);
    expect(first.events.map((event) => event.sourceRef)).toEqual(second.events.map((event) => event.sourceRef));
    expect(first.events[0]?.sourceRef).toMatch(/^whatsapp:fixture-001:message:/);
  });
});

describe("S1 privacy-safe preview", () => {
  it("S1-021 masks email and phone PII while retaining bounded recognition", () => {
    expect(maskPii("Email buyer@example.test or +20 100 111 2233")).toBe("Email [EMAIL REDACTED] or [PHONE REDACTED ••33]");
  });

  it("S1-022 never exposes raw PII through the preview projection", () => {
    const result = parseWhatsappExport(SYNTHETIC_WHATSAPP_EXPORT, whatsappOptions);
    const sensitiveResult = {
      ...result,
      events: result.events.map((event, index) => index === 0
        ? { ...event, sourceRef: "whatsapp:buyer@example.test:+201001112233", leadId: "+201001112233" }
        : event),
    };
    const preview = createImportPreview(sensitiveResult);
    expect(preview.events[0]?.textOrSummary).toContain("[EMAIL REDACTED]");
    expect(JSON.stringify(preview)).not.toContain("buyer@example.test");
    expect(JSON.stringify(preview)).not.toContain("201001112233");
  });

  it("S1-023 reports every rejected source record and no plausible partial timeline", () => {
    const result = parseWhatsappExport("[24/08/2026, 10:20] - Unknown Person: +20 100 111 2233", whatsappOptions);
    const preview = createImportPreview(result);
    expect(preview).toMatchObject({ status: "REJECTED", acceptedCount: 0, rejectedCount: 1, events: [] });
  });

  it("S1-026 rejects oversized parser input before allocating a timeline", () => {
    const result = parseCrmCsv("x".repeat(5_000_001), context);
    expect(result).toMatchObject({ status: "REJECTED", events: [] });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INPUT_TOO_LARGE" }));
  });
});
