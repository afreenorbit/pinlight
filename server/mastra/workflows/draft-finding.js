import { randomUUID } from 'node:crypto';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// References must eventually come from the document adapter, never model guesses.
export const draftInput = z.object({
  reference: z.object({
    documentId: z.string().trim().min(1),
    revision: z.string().trim().min(1),
    page: z.number().int().positive(),
    label: z.string().trim().min(1),
  }).strict(),
  observation: z.string().trim().min(1).max(10000),
}).strict();

const draftOutput = draftInput.extend({
  id: z.string().uuid(),
  status: z.literal('awaiting_review'),
  persisted: z.literal(false),
});

const prepareDraft = createStep({
  id: 'prepare-draft',
  inputSchema: draftInput,
  outputSchema: draftOutput,
  execute: async ({ inputData }) => ({
    ...inputData, id: randomUUID(), status: 'awaiting_review', persisted: false,
  }),
});

export const draftFindingWorkflow = createWorkflow({
  id: 'draft-finding',
  inputSchema: draftInput,
  outputSchema: draftOutput,
}).then(prepareDraft).commit();
