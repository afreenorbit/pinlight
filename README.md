# Pinlight

Current direction: Raspberry Pi 5 visual learning desk, an 18-stop board walkthrough and five electronics experiments. Start at `/learn`. See [chat.md](chat.md) for the complete continuation plan, workflows, hackathon alignment and honest integration status.

The desk has a detailed original Three.js learning model, a 40-pin inspector, LED/button/RGB/piezo/servo behavior previews, local progress, source-linked curated answers, typed/Wispr-input commands and browser narration. Geometry remains approximate, not official CAD. Live source-linked AI Q&A and a consent-gated English/Hindi Bolna tutor are connected. Bolna uses a lesson snapshot and cannot control the scene. It does not yet generate lessons or CAD from PDFs. Actual microphone conversation remains untested. Prior Tracepoint source/PDF tools remain at `/source`, with data and credentials preserved. The historical implementation notes below describe those retained tools.

---

# Tracepoint

A local, voice-friendly inspection notebook for technical PDFs. React + Vite render the interface. PDF.js supplies document text, reference occurrences and an interactive source canvas; Mastra runs validated drafts and the Groq interpretation agent. SQLite and local files preserve records between restarts.

## Run

Requires Node.js 24+ (the built-in SQLite module currently emits an experimental warning).

```sh
npm install
npm run import:documents
npm run dev:api
```

In a second terminal:

```sh
npm run dev
```

Open http://localhost:5173. API listens only on 127.0.0.1:4100. Keep both processes running. Do not overwrite the existing `.env`; copy `.env.example` only on a fresh checkout. Restart the API after changing credentials.

## What works

- Upload unencrypted PDFs up to 20 MB / 100 pages, or import PDFs from the project root and DOCUMENTS_DIR. Hash-based duplicate detection; originals are copied to managed storage and are not changed.
- Render sheets, zoom, search extracted reference occurrences and select their exact label bounds. Duplicate labels remain separate occurrences.
- Manually pin and label source locations in image-only/vector-outline PDFs. Pins are user-supplied evidence locations, not AI detections.
- Dictate or type an observation, prepare a Mastra-validated review draft, and explicitly confirm it. Direct drafts stay local; the AI cannot confirm findings.
- Ask / navigate uses the configured Groq model through Mastra with extracted text and scoped reference candidates. It validates selected IDs and requests clarification for ambiguous occurrences. Review AI-written observations before confirmation.
- Save confirmed findings, amend while retaining previous versions, and set open/reviewed/resolved status. Confirmation is idempotent and transactional.
- Create immutable annotated PDF + JSON report snapshots with current findings and amendment history. PDF uses a standard font; unsupported Unicode is replaced with ? in the PDF. JSON retains original Unicode.
- Optional Hear response uses browser speech synthesis, independently of Wispr/Bolna.

## Wispr

Use the normal desktop Flow shortcut in the focused observation/question field. On Windows the default is hold Ctrl+Win, speak, release. Ctrl+Enter prepares a draft or sends an assistant request. Flow formats the input before insertion; it is not a verbatim recording. There is no automatic microphone capture or wake-word integration. Actual microphone dictation still requires a user test with Wispr installed. See docs/wispr-workflow.md.

## Credentials and data

GROQ_API_KEY and GROQ_MODEL are server-only. The tested model is `openai/gpt-oss-120b` (no groq/ prefix in .env). Direct notes do not call Groq; Ask / navigate sends your question and relevant extracted PDF text to it. No browser secret variables are used.

Bolna is configured with a dedicated English/Hindi browser agent; its ID is saved in .env. The workspace has consent-gated Start/End/Mute controls, a drawing snapshot, session history and post-session transcript review. No phone calls are made. Live backend tools are not connected, and actual two-way microphone testing is still pending. See docs/bolna-setup.md.

Back up the entire data directory: SQLite, managed PDFs and report files belong together. Domain records are durable; Mastra execution traces currently use in-memory storage. This is a local single-user app with local-host and cross-site write checks, not a deployable multi-user service. Authentication, quotas, durable Mastra execution storage and managed file storage must precede public hosting.

DATABASE_PATH defaults to ./data/tracepoint.sqlite; DOCUMENTS_DIR defaults to ./data/documents. Paths are resolved from the project directory. Prepared drafts survive refresh and are listed under Unconfirmed drafts for review or dismissal. Text not yet prepared remains an unsaved input. Revision identifiers are content hashes, not engineering revision names. Text extraction does not establish diagram topology or component connectivity. Local Tesseract OCR now reads image-only sheets automatically on their first assistant request, or through Read image text now. OCR runs on this computer, uses bundled English language data, and stores recognized text with source bounds. It processes up to ten unread sheets per pass; use the button again for more. Small labels may be misread. This is text location, not circuit topology or visual reasoning. No cloud vision model is connected.

## Validation

```sh
npm test
npm run build
npm run test:live
npm run test:bolna
```

The first suite uses temporary PDFs, SQLite files and HTTP servers; it makes no provider requests. The live test makes two real Groq requests using a copy of the imported Arduino metadata in memory and does not save demo findings in the real notebook. Test files use temporary directories and remove only their own generated fixtures.

See docs/build-status.md for the browser-tested flow and remaining work. The notebook contains clearly labelled DEMO TEST findings created during browser verification.

## Structure

- src/components/PdfViewer.jsx: canvas rendering and source overlays.
- src/pages: overview, real workspace, document/finding/report collections, settings.
- server/app.js: local HTTP API and request validation.
- server/services: PDF extraction, SQLite records, confirmation, Groq commands and report export.
- server/mastra: optional agent and validated draft workflow.
- shared: domain contracts.
- scripts: local import and live provider checks.

Routes use normal paths: /, /workspace, /documents, /inspections, /reports, /settings. Frontend hosting needs an index.html fallback; API paths must be routed separately. The homepage illustration remains an illustrative preview; the workspace uses actual imported PDFs. Legacy Radar extension code has been removed. No deployment was performed.
## UI polish

The homepage includes real local-test captures in a two-view product showcase. Screenshots slide upward and fade in once when entering the viewport; reduced-motion preferences disable the effect. Navigation uses larger text and a persistent header. See docs/provenance.md for the source/dependency/reference record.

