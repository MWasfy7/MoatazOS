# One-Page Diagnostic Workflow

## 1. Define the bounded question

Agree the sales floor, observation window, source systems, sanitized lead population, and the decisions the report must not make. Record that the diagnostic is descriptive and does not measure causality, ROI, willingness to pay, or individual performance.

## 2. Sanitize outside SalesOS

The customer data owner removes direct identifiers, unnecessary message content, credentials, attachments, and commercially sensitive fields. Stable aliases must preserve event-to-lead and actor-to-role relationships.

## 3. Validate exported inputs

Use the supported CSV schema and WhatsApp instructions. Confirm date order, fixed UTC offset, participant mapping, and source lineage. Reject ambiguous identity or timestamp cases rather than guessing.

## 4. Preview locally

Load each sanitized export in the Real Input Layer. Review PII masking, accepted and rejected counts, duplicates, chronology, source references, and the separate real-estate adapter. No file is uploaded or persisted by the product.

## 5. Review deterministic evidence

Inspect extracted evidence signals and deterministic decision snapshots. Confirm that silence is not treated as rejection, explicit pauses produce restraint, contradictions remain unresolved, and later evidence creates a new immutable snapshot.

## 6. Review the Lead Loss Report

For every metric, inspect the exact numerator, semantic denominator, and exclusions. Drill into Decision Card evidence for stale, unresolved, contradictory, NO_ACTION, ownership-gap, and behavior-observation cases. Treat missing evidence as missing evidence, not individual fault.

## 7. Record findings and delete working inputs

Retain only the agreed sanitized diagnostic artifact and its bounded limitations. Delete temporary exports according to the customer's approved retention process. Any transition to real customer data, durable storage, integrations, or production use requires a separate security and business decision.
