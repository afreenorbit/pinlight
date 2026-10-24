import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const noteSchema = z.object({ documentId: z.string().uuid(), referenceId: z.string().uuid(), observation: z.string().trim().min(1).max(10000), supersedes: z.string().uuid().optional() }).strict();
export const confirmSchema = z.object({ confirmed: z.literal(true) }).strict();
export function inspectionService(store, engine) {
  return {
    async draft(raw) {
      const input = noteSchema.parse(raw);
      const document = store.get('document', input.documentId);
      const reference = document?.references.find(r => r.id === input.referenceId);
      if (!reference) throw Object.assign(new Error('Select a reference from this document first.'), { status: 400 });
      if (input.supersedes) {
        const current = store.get('finding', input.supersedes);
        if (!current || current.documentId !== document.id || current.referenceId !== reference.id) throw Object.assign(new Error('The amendment must use the original finding’s reference.'), { status: 400 });
        if (store.list('finding').some(f => f.supersedes === current.id)) throw Object.assign(new Error('This finding already has a newer amendment. Open the latest version.'), { status: 409 });
      }
      const run = await engine.getWorkflow('draftFindingWorkflow').createRun();
      const result = await run.start({ inputData: { reference: { documentId: document.id, revision: document.revision, page: reference.page, label: reference.label }, observation: input.observation } });
      if (result.status !== 'success') throw new Error('Draft preparation failed.');
      return store.put('draft', { ...result.result, documentId: document.id, referenceId: reference.id, supersedes: input.supersedes, createdAt: new Date().toISOString() });
    },
    confirm(id, raw) {
      confirmSchema.parse(raw);
      return store.transaction(() => {
      const draft = store.get('draft', id);
      if (!draft) throw Object.assign(new Error('Draft not found.'), { status: 404 });
      if (draft.findingId) return store.get('finding', draft.findingId);
      if (draft.status !== 'awaiting_review') throw Object.assign(new Error('This draft has been dismissed.'), { status: 409 });
      if (draft.supersedes && store.list('finding').some(f => f.supersedes === draft.supersedes)) throw Object.assign(new Error('A newer amendment was already saved. Prepare a new draft from the latest finding.'), { status: 409 });
      const finding = store.put('finding', { id: randomUUID(), documentId: draft.documentId, referenceId: draft.referenceId, reference: draft.reference, observation: draft.observation, status: 'open', supersedes: draft.supersedes, confirmedAt: new Date().toISOString() });
      store.put('draft', { ...draft, findingId: finding.id, status: 'confirmed' });
      return finding;
      });
    },
    dismiss(id) {
      const draft = store.get('draft', id);
      if (!draft) throw Object.assign(new Error('Draft not found.'), { status: 404 });
      if (draft.findingId) throw Object.assign(new Error('This draft is already a confirmed finding.'), { status: 409 });
      return store.put('draft', { ...draft, status: 'dismissed' });
    },
    status(id, status) {
      if (!['open', 'reviewed', 'resolved'].includes(status)) throw Object.assign(new Error('Invalid finding status.'), { status: 400 });
      const current = store.get('finding', id);
      if (!current) throw Object.assign(new Error('Finding not found.'), { status: 404 });
      if (store.list('finding').some(f => f.supersedes === id)) throw Object.assign(new Error('Update the latest finding version.'), { status: 409 });
      return store.put('finding', { ...current, status, statusHistory: [...(current.statusHistory || []), { status: current.status, at: current.updatedAt || current.confirmedAt }], updatedAt: new Date().toISOString() });
    },
  };
}
