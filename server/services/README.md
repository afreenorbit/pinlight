# Service boundaries

Implemented: PDF text/coordinate extraction, file import, manual pins, SQLite domain records, schema-validated Mastra drafts, explicit transactional confirmation, amendment history, scoped Groq interpretation, PDF/JSON report snapshots.

Direct observations stay local. Only Ask / navigate sends request text and selected PDF evidence to Groq. The agent receives reference candidates and cannot persist findings. The server validates reference IDs and rejects ambiguous automatic selections.

Still to implement: batch walkthrough/handover composers, OCR/vision, Unicode PDF fonts, authenticated multi-user access, and live Bolna function/webhook integration. Browser sessions, snapshot context, local execution sync and transcript review are implemented. Mastra execution storage is in memory; domain data is durable SQLite. Source coordinates identify text/pins, not diagram connectivity.
