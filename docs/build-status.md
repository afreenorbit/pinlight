# Build status — 24 October 2026

## Image-only PDF correction

The previous demo only validated a text-readable Arduino source. The user reproduced a failure on SparkFun HSTX: Find me I2C logic conversion. Added local Tesseract OCR with bundled English data, PDF rasterization, normalized source bounds and persistent OCR metadata. Commands automatically read image-only sheets before retrieval; the workspace also exposes a manual read action. Existing reference IDs, pins, findings and original PDFs are retained. OCR runs locally; subsequent assistant requests still send recognized context to Groq as disclosed in the UI.

Verified the exact failed request in Edge: Logic Conversion is now located, zoomed to and highlighted on the HSTX sheet. Recovered 142 text lines. Thirteen tests pass, including a real raster-only PDF and tolerant multiword heading lookup; production build passes. Small OCR labels can still be wrong. Highlights identify text rather than a verified electrical subsystem boundary.

Idea direction: guided walkthroughs of a user’s own schematic, with source-linked explanations and reviewed observations. The external Learn Arduino site is a reference for structured lessons and spatial context; no code or assets copied, and no 3D PDF reconstruction implemented.

## Live source annotation fix

Typed assistant requests now return visible circle, box or underline annotations at validated PDF reference bounds, including explanation answers that omit a model reference ID. The viewer zooms and pans to the source. Confirmed findings also have source badges. Unknown identifiers such as UFA produce an explicit U5A suggestion; repeated labels require clarification rather than silently picking one.

Responses have bold captions and optional browser speech synthesis with replay/stop controls. This narration is separate from Bolna. Bolna does not yet drive live drawing annotations through backend tools. These marks locate existing source labels; they do not redraw circuits or verify electrical connections.

Verification: 11 automated tests passed, two live Groq checks passed, production build passed. Edge verified actual U5A circle and C9 underline results from typed Mastra/Groq requests, with no visible errors. A 79-second continuous typed demo is recorded at output/demo/tracepoint-typed-demo.mp4 with system playback audio (browser narration). It demonstrates live Mastra source requests, zoom, circle/underline, on-sheet preview notes, explicitly confirmed saved notes, refresh persistence and report creation. Confirmed observations remain source-linked overlays; original PDFs are retained. No full Bolna voice demonstration has been recorded.

## Completed and checked

- Imported all three user-downloaded PDFs without modifying the originals.
- Arduino: 2 pages, 604 extracted text items, 88 reference occurrences. SparkFun HSTX: 1 page, no extractable text. SparkFun GNSS: 3 pages, no extractable text. The latter two support manually labelled pins.
- Live Groq / Mastra: openai/gpt-oss-120b found C9 and prepared an unconfirmed draft, preserving a negated observation. No findings were saved by the provider test.
- Automated integration: PDF extraction, rotated coordinates, duplicate import, invalid-file rejection, unknown-reference rejection, explicit confirmation, idempotent confirmation, amendments, stale-version rejection, status updates, report PDF/JSON contents, SQLite restart persistence, HTTP uploads, malformed JSON, cross-site writes, missing credentials, dismissed-draft rejection, invented/ambiguous model references and downloads all passed (5 reported tests).
- Edge browser: library listed the imported documents; real Arduino canvas rendered; selected C9; prepared and confirmed a DEMO TEST note; refreshed and saw it persist; amended it while keeping earlier text; created a report; AI navigation selected U5A; switched to SparkFun and added a DEMO HSTX section pin.
- Report appendix rendered and visually reviewed; full export contains original source pages and the inspection appendix.
- Prepared-draft recovery and dismissal passed in Edge after refresh. A Reports-to-Inspections route-state crash was fixed and the transition retested.
- Production Vite build passed; the PDF workspace is lazy-loaded separately from the homepage.

## Next session

1. Perform real Wispr dictation into both observation and question fields. Browser testing used typed text; no microphone or Wispr recording was simulated.
2. Improve dictation flow after watching the real input behavior. Observation, amendments and questions are supported; batch walkthrough and handover composers remain planned.
3. Draft recovery and dismissal are now implemented and verified after browser refresh. Extend with batch walkthrough and handover composers next.
4. Bolna agent configuration, browser controls and real session minting are now checked. Next: test a real microphone conversation; live backend tools still need a separately authenticated public endpoint. See bolna-setup.md.
5. Local OCR is now connected for image-only documents. Assess small-label accuracy and add a separately verified vision model only if richer visual reasoning is needed. The GPT-OSS text model still cannot see images.
6. Embed a Unicode font for multilingual PDF reports; JSON already preserves all text.
7. Add user identity and managed persistence before deployment.

Demo findings are explicitly labelled DEMO TEST, and the manual pin is labelled DEMO HSTX section. These are software test records, not actual engineering inspection results. Original sample documents came from Arduino and SparkFun via the links supplied in this chat.

## Bolna configuration update

Dedicated English/Hindi agent created and ID saved in .env. Real account and 120-second browser-session mint verified in both English and Hindi. Eight automated tests pass, including Bolna scoping and transcript-to-draft review. Browser controls checked without capturing microphone audio. Image-only PDF extraction remains unchanged at the user’s request.

## Homepage polish

Navigation enlarged to 16px on desktop. Added real inspection and Bolna screenshot views with a one-time upward scroll reveal, reduced-motion fallback, and working screenshot toggles. Edge checks confirmed image loading, hidden-to-visible reveal states, navigation, and no desktop horizontal overflow or console errors. Production build passed. No Craft code or assets were imported; see provenance.md.
