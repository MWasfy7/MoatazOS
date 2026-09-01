# Supported CRM CSV Schema

Use UTF-8 CSV with one header row. The importer rejects the entire file when required structure, identity, or timestamp safety cannot be established.

## Required columns

| Column | Meaning | Accepted shape |
| --- | --- | --- |
| `event_id` | Stable source event identity | Non-empty string, unique unless the row is an exact duplicate |
| `lead_id` | Sanitized stable lead identity | Non-empty string |
| `occurred_at` | Source event time | ISO 8601 with offset, or local date-time used with an explicit fixed UTC offset |
| `actor_id` | Sanitized stable actor identity | Non-empty string |
| `actor_role` | Evidence attribution | `BUYER`, `BUYER_DELEGATE`, `REP`, `MANAGER`, or `SYSTEM` |
| `channel` | Source channel | `CRM`, `WHATSAPP`, `EMAIL`, `CALL`, or `OTHER` |
| `event_type` | Source event class | Non-empty source-defined value |
| `direction` | Message/activity direction | `INBOUND`, `OUTBOUND`, `INTERNAL`, or `UNKNOWN` |

## Optional core columns

`source_ref`, `text_or_summary`, `crm_stage`, and `contact_phone` are supported. Columns prefixed with `meta_` are preserved as industry-neutral metadata. Phone values are used only for deterministic collision detection and are masked in preview.

## Optional real-estate adapter columns

`project`, `developer`, `unit`, `budget`, `area_location`, and `payment_plan_context` are kept outside the core event schema.

## Fail-closed rules

Missing required columns or values, malformed or ambiguous timestamps, invalid enumerations, conflicting event IDs, phone-to-lead identity collisions, unclosed CSV quotes, and mismatched column counts reject the import. Exact duplicates are removed and reported. Out-of-order valid events are sorted and reported.
