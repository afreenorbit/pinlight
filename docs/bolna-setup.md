# Bolna in Tracepoint

Configured and checked 24 October 2026.

## Account configuration

The dedicated **Tracepoint Inspection Companion** agent was created through Bolna's v2 API. Its ID is stored in the local .env file. The API key stays server-only.

- English: Deepgram Nova-3 transcription and ElevenLabs Angelica / eleven_turbo_v2_5 speech.
- Hindi: Deepgram Nova-3 transcription and Sarvam Suhani / bulbul:v3 speech. Switching is caller-requested.
- Bolna-managed LLM: gpt-4.1-mini. This is separate from the existing Groq GPT-OSS drawing assistant. The Groq credential was not uploaded to Bolna.
- FreeSWITCH browser transport; no telephone number, outbound phone call, transfer, or auto-rescheduling configured.
- Maximum conversation duration: 180 seconds. Post-session summary enabled.

Voice/model availability was checked against the account's live voice catalogue before agent creation. Registration alone does not prove speech quality or provider runtime availability.

## Run and use

Start the API and Vite as described in README. Open Workspace, choose a drawing and preferably a reference, then scroll to Your voice companion. Select English or Hindi, read the consent disclosure, and click Start voice conversation. Allow microphone access when you are ready. Use End conversation to stop; the SDK also releases audio when leaving the page. Use Wispr separately, after stopping Bolna.

The server constructs the context from the actual document, selected reference, extracted sheet text and current confirmed findings. It does not accept arbitrary browser-provided prompt text. Context is a capped snapshot and does not change during the conversation. Start a new conversation after changing drawings or findings. The current document/reference controls are locked while connected.

Audio, transcripts and the context snapshot go to Bolna and its configured speech/LLM providers. They may consume account credits and are subject to provider retention. A limited transcript and summary are synced to local SQLite only when requested or through the bounded post-session polling. Session passwords and TURN credentials are never persisted locally or printed by our scripts.

After a completed session, expand its history item and refresh the result if needed. Review transcript as a draft requires a reference selected at session start. It copies the complete role-labelled transcript into an unconfirmed draft; **edit it into the intended observation before confirming**, since assistant statements are not inspector observations. The original transcript remains in voice history. Nothing spoken automatically confirms or resolves a finding.

## Local architecture

- Official @bolna/web-call 3.0.1 SDK, lazy-loaded in the workspace.
- POST /api/bolna/session requires explicit consent and document scope. The server mints a single-use session through https://api.bolna.ai/web-call/session. Real sessions expire in 120 seconds.
- GET /api/bolna/status exposes non-secret configuration status.
- GET /api/bolna/sessions?documentId=… lists locally registered sessions.
- POST /api/bolna/executions/:id retrieves status, transcript and summary only for registered executions whose agent matches.
- POST /api/bolna/executions/:id/draft creates an unconfirmed review draft. Repeat imports are idempotent; already reviewed/dismissed imports are rejected.
- Session minting has an in-process cooldown and concurrent-request guard. Existing local host / cross-site write checks apply. This remains a local single-user service, not a publicly deployable session mint.

No webhook or live cloud-to-local function endpoint is configured. Bolna cannot reach localhost; live navigation/save tools would require a separately authenticated public backend. No tunnel or public exposure was created. The prompt explicitly explains this limitation rather than pretending tools are available.

## Validation

`npm run configure:bolna` creates a dedicated agent only when one does not already exist, then verifies and saves its ID. Re-running reuses it; it does not overwrite unrelated agents or silently update an existing prompt.

`npm run test:bolna` checks the real account, retrieves the dedicated agent, and mints a real short-lived session using copied document metadata in memory. Both English and Hindi session minting were verified (`--hindi` selects Hindi). It does not request microphone access, start audio or place a phone call. The actual two-way microphone conversation remains to be tested by the user.

Automated tests cover consent, arbitrary context rejection, source scoping, mint cooldown, no persistent temporary passwords, matching execution ownership, sanitized errors, transcript review and HTTP route handling. Edge checks confirmed context display, English/Hindi selection, and disabled Start until consent; no audio was captured.

## Official references

- [Browser SDK setup](https://www.bolna.ai/docs/developer-resources/sdks/web-call)
- [SDK API reference](https://www.bolna.ai/docs/developer-resources/sdks/web-call-api)
- [Create agent schema](https://www.bolna.ai/docs/api-reference/agent/v2/create)
- [Multilingual configuration](https://www.bolna.ai/docs/customizations/multilingual-config-reference)
