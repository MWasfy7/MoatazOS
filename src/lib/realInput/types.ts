export type SalesChannel = "CRM" | "WHATSAPP" | "EMAIL" | "CALL" | "OTHER";
export type EventDirection = "INBOUND" | "OUTBOUND" | "INTERNAL" | "UNKNOWN";
export type SalesActorRole = "BUYER" | "BUYER_DELEGATE" | "REP" | "MANAGER" | "SYSTEM";

export interface NormalizedSalesEvent {
  organizationId: string;
  salesFloorId: string;
  leadId: string;
  actorId: string;
  actorRole: SalesActorRole;
  eventId: string;
  occurredAt: string;
  channel: SalesChannel;
  eventType: string;
  direction: EventDirection;
  sourceRef: string;
  textOrSummary: string;
  crmStage?: string;
  metadata: Record<string, string>;
}

/** Industry-specific context is deliberately kept outside the core event. */
export interface RealEstateEventContext {
  project?: string;
  developer?: string;
  unit?: string;
  budget?: string;
  areaOrLocation?: string;
  paymentPlanContext?: string;
}

export type ImportIssueSeverity = "ERROR" | "WARNING";

export interface ImportIssue {
  severity: ImportIssueSeverity;
  code: string;
  message: string;
  line?: number;
}

export interface ImportResult {
  status: "ACCEPTED" | "REJECTED";
  events: NormalizedSalesEvent[];
  realEstateByEventId: Record<string, RealEstateEventContext>;
  issues: ImportIssue[];
  sourceRecordCount: number;
  duplicateCount: number;
}

export interface ImportContext {
  organizationId: string;
  salesFloorId: string;
  sourceId: string;
  /** Fixed UTC offset used only when a source timestamp has no offset. */
  defaultTimezoneOffset: string;
}

export interface WhatsappParticipant {
  aliases: string[];
  actorId: string;
  actorRole: Extract<SalesActorRole, "BUYER" | "BUYER_DELEGATE" | "REP" | "MANAGER">;
  leadId: string;
  direction: Extract<EventDirection, "INBOUND" | "OUTBOUND" | "INTERNAL">;
}

export interface WhatsappImportOptions extends ImportContext {
  dateOrder: "DMY" | "MDY";
  participants: WhatsappParticipant[];
}

export interface MaskedEventPreview extends Omit<NormalizedSalesEvent, "eventId" | "leadId" | "actorId" | "sourceRef" | "textOrSummary" | "metadata"> {
  eventId: string;
  leadId: string;
  actorId: string;
  sourceRef: string;
  textOrSummary: string;
  metadata: Record<string, string>;
}

export interface ImportPreview {
  status: ImportResult["status"];
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  events: MaskedEventPreview[];
  issues: ImportIssue[];
}
