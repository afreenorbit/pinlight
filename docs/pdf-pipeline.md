# PDF-to-learning pipeline

1. `/api/documents` validates, hashes, extracts and persists the PDF (20 MB, 100-page limit). Duplicate bytes reuse the same document.
2. `POST /api/learning/process` creates or reuses a durable SQLite job. One worker processes up to 20 queued uploads, with stage updates and restart recovery. Failed jobs are explicitly retryable.
3. PDF.js retains text coordinates. Tesseract handles image-only pages. Optional Docling adds local table/layout records; install `server/workers/requirements.txt` in a dedicated Python environment and set `DOCLING_ENABLED=on` and `DOCLING_PYTHON`.
4. With `DEVICE_EXTRACTION_PROVIDER=groq`, the server sends a bounded selection of evidence and, if `GROQ_VISION_MODEL` is set, up to three rendered pages to Groq. The owner explicitly authorized this transfer in the implementation session. Deployments must disclose the configured provider to uploaders. Local mode never calls the device-extraction provider.
5. Zod validates the response shape. Source checks remove unknown references, unsupported numeric facts, incompatible package counts and conflicting pin labels. Unknowns remain unknown. Source linkage does not independently establish that a value belongs to the correct table column or variant.
6. A cached artifact supplies the scene, source-linked device review, lessons and available ideal teaching experiments. Dimensions influence package proportions; geometry remains illustrative. Pin labels are attached to geometry only when the top view and mapping are source-linked.
7. Signed-in browsers save journeys and progress in owner-scoped Supabase `learning_artifacts`, while PDFs use the existing private `documents` bucket. Guests retain browser progress and local server PDFs/artifacts.

## Cloud setup

Apply `supabase/migrations/0001_pinlight_desk.sql`, `0002_learning_artifacts.sql` and `0003_auth0_ownership.sql`, or run `npm run migrate:learning` with a server-only `DATABASE_URL` and `DATABASE_SSL_CA` pointing to the project's downloaded root certificate. The runner verifies certificates, runs DDL transactionally and applies `0003` when the ownership function is missing or Auth0 is configured, so native Supabase accounts also get `current_owner_key()`. It also needs `VITE_SUPABASE_URL` (or `SUPABASE_URL`) when applying `0003` and, when Auth0 is enabled, `AUTH0_DOMAIN`. Do not use `VITE_` variables for database credentials.

`node --env-file=.env scripts/test-learning-storage.js` checks owner reads, other-user writes, forged parent references and anonymous access using synthetic rows inside a rolled-back transaction.

## Verification

`npm test` tests grounding, variants, geometry, ideal circuit equations, PDF processing, retries and persistence. `npm run test:live` sends a synthetic fixture to the configured extraction provider. `npm run build` checks the production frontend.

## Boundaries

The shipped interactive experiments solve ideal voltage-divider and RC-charge equations. They do not run firmware, simulate arbitrary uploaded chips or validate real-world wiring. General schematic-to-netlist reconstruction, independently verified dimensions and manufacturer CAD retrieval remain future extensions. Docling is an optional integration and is not installed by `npm install`.

Prepared samples and legacy/guest imports remain a shared demo library. New Auth0-authenticated uploads receive an issuer-bound document ACL: metadata, source files, processing endpoints and job results are filtered to their owners. A second owner gains access to a duplicate only after uploading the complete identical PDF. Private guest-upload sessions are not implemented; use sign-in for private uploads and keep the demo API on loopback unless its shared guest behavior is appropriate for your deployment.

## Auth0 and web references

Auth0 can provide hosted sign-in while Supabase continues to store PDFs and journeys. Migration `0003_auth0_ownership.sql` preserves native UUID accounts and adds issuer-bound, storage-safe owner keys for Auth0 subjects. Read `docs/auth0-setup.md` before enabling the browser configuration. The API verifies audience-bound RS256 access tokens; Supabase uses the ID token with the Post Login role claim.

Reference search sends only the explicitly submitted component name to SerpApi. Results are cached for a day, concurrent identical requests are deduplicated, and the service caps new searches at 30 per hour per API process. Links are not fetched automatically and are never promoted into extracted device facts.
