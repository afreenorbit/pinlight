# Build review, practice and community

Implemented as additional routes; the existing learning desk, electronics activities and PDF-to-3D pipeline remain available.

## Routes

- `/build`: an empty idea-first form for the project, parts owned and an AI-generated list. An intake agent maps recognised parts to the supported catalogue; planner and reviewer generate a possibilities graph covering ownership, missing requirements, alternatives, complements and optional items. Unverified alternatives are labelled. Checks, evidence, saving and project viva remain available after generation.
- `/arena`: a voice battle of four spoken explanations (concepts in `shared/arena/concepts.js`, each with fixed key points and a model answer). Players dictate with Wispr and say “that’s my answer” to submit; each player moves on immediately at their own pace, with a 60-second limit per concept. Answers are graded in the background for accuracy and clarity against the key points (Groq via `server/arena/coach.js`, keyword fallback), so scores update live; clarity only counts in proportion to accuracy. Solo opponents are rule-based bots that pick one of three pre-written, pre-graded answers per concept and never call a model; they do not speak. Duo is two people in a five-letter room on their own devices. After both finish, the results compare every answer side by side and a coach verdict says who was more accurate and who was clearer. Rooms live in API memory and close after 30 idle minutes or a server restart. `/practice` and `/community` redirect here; the community and viva API endpoints still exist but have no page.
- `/desk`: private saved build reports, practice answers and viva conversations, with reopening for builds and viva.

Guests can use review, practice and viva. Saving and publishing require authenticated ownership. A sign-in-to-save action keeps one temporary pending record in session storage until sign-in completes. Normal guest reviews are not written to cloud storage.

## Backend

`server/review/service.js` uses Mastra agents hosted on Groq. The planner defaults to `GROQ_MODEL` (`openai/gpt-oss-120b`); the reviewer defaults to `openai/gpt-oss-20b`, override with `GROQ_REVIEW_MODEL`.

Both agents have bounded tool execution: inspect supported dependencies, retrieve selected component evidence, submit a Zod-validated review. There is a concurrency limit and IP request throttling. The reviewer may fail independently; the UI labels that result as a planner draft. Both model perspectives remain inspectable. Neither overwrites the deterministic check statuses.

Viva questions use source excerpts: the model selects relevant snippet IDs and the server composes questions and feedback from those exact passages. Unknown references are rejected. Licensing boilerplate is excluded from the electronics question pool. Questions retain exact source excerpts. Answer assessment uses the question, student response and excerpts to produce an AI practice score out of ten, constructive feedback and a reference answer. Assessment source IDs are validated; scores are study guidance, not examination grades.

Supabase full-text retrieval selects source facts seeded from the existing curated component catalogue. The API uses a server-only service key when configured, or the existing TLS database connection for private operations. All queries are parameterized and use the owner key from verified authentication. Public tables and private records also have RLS policies. No browser database secret is required.

Run `npm run migrate:review` after the existing learning migrations. Production requires `SUPABASE_URL` (or existing `VITE_SUPABASE_URL`) plus a public key for retrieval, and either `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` for server-side saving. Existing `DATABASE_SSL_CA` is supported. Keys remain server-only.

## Dataset and evaluation

Source: https://huggingface.co/datasets/afdsafas/EEE-Bench (dataset card declares MIT). Original questions and images are preserved. The importer takes rows 0–23 as practice and 24–39 as a disjoint evaluation slice; this is a Pinlight partition, not an official dataset split. Answer keys and held-out images live under `server/review/data`, outside the frontend public directory. They are not returned by the question-list endpoint.

`npm run import:eee` refreshes this small collection. `npm run evaluate:review` runs a small evaluation, requiring `GROQ_VISION_MODEL` to describe diagrams before the two text models answer. `EVAL_COUNT` defaults to 3. Results record the vision model and both answers. This pipeline is an evaluation experiment, not the live build-review workflow and not fine-tuning.

The first one-question smoke evaluation on 2026-10-26 found the planner correct and reviewer incorrect. This is too small to estimate accuracy and does not support a claim that multi-agent review improves answers. Preserve failed cases and run a larger independent evaluation before making performance claims. Public benchmark contamination in pretrained models is also possible.

## Voice

Wispr inserts text into normal fields; the viva reuses the existing opt-in auto-send dictation field. Use the user's configured shortcuts. Bolna reads the new review, practice, viva and community text through the existing muted-microphone narration flow. Enable spoken replies, then use Read aloud. Viva questions additionally use browser speech synthesis for automatic reading, replay and stop controls; users can turn question reading off. No voice navigation is added. Full continuous spoken viva is not implemented; input remains text/Wispr.

## Boundaries

The dependency graph is not an electrical solver. Current checks cover selected dependency rules and an ideal LED resistor calculation. Arbitrary voltage/pin/power checks, CAD generation and drop-in substitute certification are not provided. AI proposals require source review. EEE-Bench practice checks answer labels, not open-ended reasoning. PDF viva does not OCR scanned documents or inspect diagrams, and states its excerpt limit. Existing PDF 3D visuals remain illustrative, with their existing source-validation rules.

Community answers are opinions with a project snapshot, not expert certification. Measurements are student-reported. External posting, production deployment and a browser sign-in session must be verified separately where credentials/session access are unavailable.

## Automatic saving and project handoff

Signed-in build reviews save on the server before returning their result. The client retries saving through a shared status control if storage is unavailable. Build, viva and circuit-practice records use stable UUIDs; repeated viva answers update the same owned record rather than inserting duplicates. The records endpoint supports updates only for the verified owner. Save failures are shown with a retry action. Guest work requires sign-in to persist in My desk.

Viva begins with a saved record as soon as its first question is available, and updates with every answer, score and reference answer. Selecting a PDF saves its excerpts as part of the viva and separately uploads the original PDF to the existing private documents bucket when signed in, including when the PDF cannot be used for text-based viva. My desk no longer has the PDF tools/upload form; uploads start from the learning/practice flow.

Build-to-viva passes the design idea, owned list, suggested list, review and matching source facts; it does not rely only on component names. Generated graph cards include the consequence of a missing part and candidate alternatives with tradeoffs and compatibility checks. Unsupported alternatives may be removed by the reviewer.

The contextual dictation box accepts “practice explaining this build” and “ask in community”. The latter constructs an editable community draft with the idea, owned and missing parts, review summary and questions, then opens its preview. Publishing requires a separate “send post”/“post” action or the Send post button, and sign-in. Negated commands do not publish. No post is created merely by drafting it.


## 3D build view and printable enclosure

After the possibilities graph, Build review requests `/api/review/scene` once per review. One Groq call (`server/review/scene-agent.js`) returns the parts (shape, size in mm, colour, printed pin labels, owned or missing) and the connections between named pins. Everything after that is deterministic code in `shared/review/scene.js`:

- **Cleaning:** the main board comes from the review, not the model; wires to pins the board does not have are dropped; rover builds always get a chassis; on a Raspberry Pi a camera is connected by one ribbon into CAM/DISP 0 instead of any GPIO wiring the model proposed.
- **Wiring rules:** a wire is marked *Checked by rules* only when it passes fixed checks (ground to ground, supply to supply, signals to real board pins, driver outputs to motors). Warnings cover motors on a board pin, an LED without a resistor, 5 V HC-SR04 ECHO into a Pi GPIO, ground joined to a signal, and parts with an unwired ground. Everything else is labelled *AI suggestion*.
- **Layout:** parts are placed by role around the board (sensors in front, driver and power behind, actuators at the sides, small parts on a breadboard) and wires are routed between the real header positions of the Pi 5 and Uno models.

`src/review/BuildScene.jsx` draws the scene with three.js, reusing the Learn desk's Pi 5 and Uno models; other parts are drawn from simple shapes (`src/review/parts3d.js`). Missing parts are translucent with a dashed outline. Clicking a part or wire selects it; there is an exploded view and a wiring list. The scene is kept with the review result.

`src/review/Enclosure.jsx` generates a base and press-fit vented lid in the browser with manifold-3d (Apache-2.0) from `shared/review/enclosure.js`: published board dimensions, mounting holes and approximate port openings for the Pi 5 and Uno, or a half breadboard. Downloads: one STL with both parts, each part separately, and an editable OpenSCAD file. Port positions must be checked against the official mechanical drawings before printing.

### Project forms, project enclosures and the finished product

The scene description also names the project's **form** (rover, desk device, handheld, arm or box) and a **mount** for each part (for example a rover's top deck, lower deck, front or wheels; a desk device's inside, front face or lid). `shared/review/assembly.js` keeps the AI's choices when they make physical sense and overrides them when they do not: resistors and breadboards are always hidden inside, screens, cameras, speakers, microphones and distance sensors always face out, and every servo in an arm is a joint. It then places every part in millimetres: a rover becomes two decks on standoffs with drive wheels, a caster and the camera behind a front window; a desk device packs its electronics on the floor with the screen and sensors on the front wall and buttons and LEDs in the lid; an arm stacks its servos above a base housing.

From that assembly it designs the enclosure: an open-bottom body shell with screw tabs for a rover, or a rounded two-part case with a locating lip for the other forms. Openings are cut exactly where parts reach the outside (a window for a screen, a round hole for a lens, two "eyes" for an ultrasonic sensor, a grille for a speaker or microphone, holes for buttons and LEDs, a USB slot). `buildShell` in `shared/review/enclosure.js` builds it with manifold-3d and `shellScad` writes the same design as editable OpenSCAD. The board-only case remains available under "Just need a case for the board?".

`src/review/ProductViews.jsx` shows two sections after the 3D build: the enclosure (parts inside the clear shell, or the print layout, with STL and .scad downloads) and the finished product (the opaque shell in a chosen colour, slowly turning; not downloadable). Part sizes are AI estimates for anything outside the catalogue, so the page asks makers to measure before printing. If Groq reports a rate limit, the scene request waits the stated time (up to 25 s) and retries once.

All part models are drawn in code (`src/review/parts3d.js`); see `CREDITS.md` for the open-source libraries and reference data used.
