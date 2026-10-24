import { z } from 'zod';
import { createBolnaClient } from './client.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const sessionInput = z.object({ documentId: z.string().uuid(), referenceId: z.string().uuid().optional(), language: z.enum(['en','hi']).default('en'), consent: z.literal(true) }).strict();

export function buildInspectionContext(store, input) {
  const document = store.get('document', input.documentId);
  if (!document) throw fail('Document not found.', 404);
  const selected = document.references.find(r => r.id === input.referenceId);
  if (input.referenceId && !selected) throw fail('Selected reference does not belong to this drawing.');
  const references = selected ? [selected, ...document.references.filter(r => r.id !== selected.id)].slice(0, 120) : document.references.slice(0, 120);
  const history = store.list('finding').filter(f => f.documentId === document.id);
  const current = history.filter(f => !history.some(n => n.supersedes === f.id));
  const page = document.pages[(selected?.page || 1) - 1];
  const snapshot = { title: document.title, revision: document.revision, sheets: document.pages.length,
    selectedReference: selected ? { id: selected.id, label: selected.label, page: selected.page } : null,
    references: references.map(({id,label,page,manual}) => ({id,label,page,manual:!!manual})),
    confirmedFindings: current.slice(0, 15).map(f => ({ label: f.reference.label, page: f.reference.page, observation: f.observation.slice(0, 800), status: f.status })),
    extractedSheet: page ? { page: page.page, text: page.items.map(i => i.text).join(' ').slice(0, 5000) } : null,
    partialSnapshot: references.length < document.references.length || current.length > 15,
    toolsAvailable: false,
  };
  return { document, references, snapshot };
}

export function bolnaService(store, { api = createBolnaClient(), agentId = process.env.BOLNA_AGENT_ID, configured = Boolean(process.env.BOLNA_API_KEY?.trim() && agentId?.trim()) } = {}) {
  let minting = false, lastMint = 0;
  const importing = new Set();
  return {
    status() { return { configured, agentId: configured ? agentId : null, transport: 'browser-webrtc', languages: ['en','hi'], maxDurationSeconds: 180, liveToolsConnected: false }; },
    async mint(raw) {
      const input = sessionInput.parse(raw);
      if (!configured) throw fail('Configure BOLNA_API_KEY and BOLNA_AGENT_ID, then restart the API.', 503);
      if (minting || Date.now() - lastMint < 15000) throw fail('Please wait a few seconds before starting another voice session.', 429);
      const { document, references, snapshot } = buildInspectionContext(store, input);
      minting = true;
      try {
        const session = await api('/web-call/session', { method:'POST', body:JSON.stringify({ agent_id: agentId, user_data:{ inspection_context:JSON.stringify(snapshot) }, agent_data:{language:input.language} }) });
        if (!z.string().uuid().safeParse(session.run_id).success || session.agent_id !== agentId || !session.sip_password || !session.wss_url?.startsWith('wss:')) throw fail('Bolna returned an invalid browser session.', 502);
        store.put('voice-session', { id:session.run_id, agentId, documentId:document.id, revision:document.revision, referenceId:input.referenceId, referenceIds:references.map(r=>r.id), language:input.language, status:'minted', createdAt:new Date().toISOString() });
        lastMint = Date.now();
        return session; // Only the short-lived SDK credentials reach the browser.
      } finally { minting = false; }
    },
    list(documentId) { return store.list('voice-session').filter(s => !documentId || s.documentId === documentId); },
    async sync(id) {
      const local = store.get('voice-session', id);
      if (!local) throw fail('Voice session not found.', 404);
      if (['completed','failed','no-answer','busy','canceled','stopped','error','balance-low'].includes(local.status)) return local;
      const last = Date.parse(local.syncedAt || 0);
      if (last && Date.now() - last < 4000) return local;
      const result = await api(`/executions/${encodeURIComponent(id)}`);
      if (result.agent_id !== local.agentId) throw fail('Execution does not match this voice agent.', 502);
      // Whitelist useful fields; do not expose provider account data or recording URLs.
      return store.put('voice-session', { ...local, status:result.status || 'pending', transcript:typeof result.transcript === 'string' ? result.transcript.slice(0, 60000) : '', summary:typeof result.summary === 'string' ? result.summary.slice(0, 10000) : '', duration:result.conversation_duration || 0, syncedAt:new Date().toISOString() });
    },
    async draft(id, inspections) {
      const session = store.get('voice-session', id);
      if (!session) throw fail('Voice session not found.',404);
      if (session.draftId) {
        const previous = store.get('draft', session.draftId);
        if (previous?.status !== 'awaiting_review') throw fail('This transcript was already reviewed or dismissed.',409);
        return previous;
      }
      if (importing.has(id)) throw fail('This transcript is already being prepared.',429);
      if (session.status !== 'completed' || !session.transcript) throw fail('Wait for the completed transcript, then try importing your note.');
      // Only a reference selected before the call can receive imported voice notes.
      // The exact transcript is retained for review; no silent AI reinterpretation.
      if (!session.referenceId) throw fail('This conversation had no selected reference. Select a reference and copy your observation into the notebook.');
      if (session.transcript.length > 9000) throw fail('This transcript is too long for one finding. Copy the relevant observation into the notebook.');
      importing.add(id);
      try {
        const draft = await inspections.draft({documentId:session.documentId,referenceId:session.referenceId,observation:`Voice-session transcript — review and replace with your observation before confirming:\n\n${session.transcript}`});
        store.put('voice-session',{...session,draftId:draft.id});
        return draft;
      } finally { importing.delete(id); }
    },
  };
}
