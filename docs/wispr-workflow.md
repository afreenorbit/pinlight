# Wispr in Tracepoint

Research checked 24 October 2026. Wispr remains external desktop dictation. Observation and correction fields are implemented; real microphone testing is pending.

## Input boundary

Wispr inserts completed, formatted text into a focused field. On Windows, hold Ctrl+Win and release to insert, or use Ctrl+Win+Space to start and again to stop. This does not provide continuous listening or a wake-word interface. Source: [Wispr dictation controls](https://docs.wisprflow.ai/articles/6409258247-starting-your-first-dictation).

## Recommended components

1. Observation composer: select a source reference, dictate a detailed observation, and review the resulting draft before saving. Keep the reference fixed during dictation.
2. Correction composer: dictate an amendment to a selected finding. Preserve the original and show the proposed change before confirmation.
3. Walkthrough inbox: dictate several observations in one recording. Split them into proposed findings, ask about ambiguous references and keep unmatched notes unassigned.
4. Handover composer: dictate unresolved concerns and next checks, linked to existing findings. Generate a reviewable handover rather than a generic chat summary.

Build in that order. Navigation commands are supporting controls; substantive observation capture is the main voice use case.

## UX constraints

Keep one visible, focused field with its active document/revision/reference. Accept typing and pasted text too: browser input events cannot authenticate Wispr as the source. Start with an explicit Prepare draft action after insertion; never auto-publish. Verify identifiers and measurements visually. Wispr can format and resolve corrections, so inserted text is not a verbatim recording transcript.

Snippets can expand repeated templates and context awareness can help nearby domain terms. Neither verifies evidence. Sources: [Snippets](https://docs.wisprflow.ai/articles/5784437944-create-and-use-snippets), [Context awareness](https://docs.wisprflow.ai/articles/4678293671-feature-context-awareness).

Keep Wispr dictation and future Bolna conversation as separate modes; do not capture the microphone simultaneously or assume an available text bridge. Mastra orchestrates validated drafts and later evidence retrieval; it does not handle dictation. See [Mastra workflows](https://mastra.ai/docs/workflows/overview).

## Future demo

Load a real drawing → select reference → dictate with Wispr → prepare source-linked draft → review and confirm → store finding → dictate amendment → export confirmed history. The local workflow is implemented; batch walkthrough/handover composers and Bolna remain planned. The local MVP now imports PDFs, highlights references, prepares/confirms/amends findings and exports reports. Browser input testing used typed text; actual Wispr dictation is still pending.
