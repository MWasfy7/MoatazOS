# Data and Privacy Requirements

## Required before real or sanitized customer data

- Written authorization from the customer data owner for the named diagnostic purpose and observation window.
- A documented lawful basis and regional handling requirements for CRM and conversation data.
- A customer-approved sanitization method and explicit list of fields permitted for transfer.
- Stable pseudonymous IDs that preserve joins without exposing names, phone numbers, email addresses, account numbers, or precise addresses.
- A fixed retention period, deletion owner, storage location, and access list.
- Confirmation that exports contain no credentials, tokens, attachments, media, payment data, government IDs, health data, or unrelated conversation history.
- A documented incident path for unexpected personal data.

## Product boundary

The current build performs local in-tab parsing and preview only. It has no OAuth, CRM API, database, analytics beacon, durable browser storage, external write, contact, scheduling, pricing, billing, provisioning, or deployment authority.

## Stop conditions

Do not load real customer data until the authorization, sanitization, retention, access, and deletion decisions above are complete. Do not add persistence, external integrations, or production deployment under the diagnostic milestone.
