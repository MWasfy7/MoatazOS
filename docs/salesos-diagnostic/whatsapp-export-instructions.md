# WhatsApp Export Instructions

1. Export the chat as a text file without media.
2. Keep the original timestamp lines and multiline message continuations intact.
3. Before sharing, replace real participant names with stable aliases such as `Buyer A` and `Rep 01`.
4. Remove attachments, addresses, account numbers, contract identifiers, and any free text not needed for the diagnostic question.
5. Provide the source date order, either day-month-year or month-day-year.
6. Provide the fixed UTC offset that applied during the export window.
7. Provide an explicit alias map to sanitized actor IDs, actor roles, directions, and lead IDs.
8. Review the local PII-masked preview before analysis.

The parser supports standard bracketed and dash-prefixed WhatsApp export lines, Arabic and English text, and multiline messages. Unknown participants, ambiguous timestamps, identity collisions, conflicting duplicate messages, and malformed structure fail closed.

Do not supply a live-chat backup, device database, credentials, OAuth access, media archive, or unsanitized customer export.
