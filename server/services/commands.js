import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { matchReferences } from './reference-match.js';

const commandSchema = z.object({
  action: z.enum(['find', 'draft', 'explain', 'clarify']),
  referenceId: z.string(), observation: z.string(), message: z.string(),
}).strict();
export const commandInput = z.object({ documentId: z.string().uuid(), referenceId: z.string().uuid().optional(), text: z.string().trim().min(1).max(6000) }).strict();

export function commandService(store, engine, inspections) {
  let busy = false;
  return async raw => {
    const input = commandInput.parse(raw);
    const document = store.get('document', input.documentId);
    if (!document) throw Object.assign(new Error('Document not found.'), { status: 404 });
    const selected = document.references.find(r => r.id === input.referenceId);
    if (input.referenceId && !selected) throw Object.assign(new Error('Selected reference does not belong to this document.'), { status: 400 });
    const match=matchReferences(document,input.text,input.referenceId);
    if(match.clarification)return{action:'clarify',message:match.clarification,suggestions:match.suggestions};
    const agent = engine.listAgents().inspectionAgent;
    if (!agent) throw Object.assign(new Error('Add GROQ_API_KEY and GROQ_MODEL to .env, then restart the API.'), { status: 503 });
    if (busy) throw Object.assign(new Error('Another request is being interpreted. Please wait.'), { status: 429 });
    const relevant = match.named ? match.candidates : document.references.filter(r => r.id === selected?.id);
    const candidates = relevant.length ? relevant.slice(0, 150) : document.references.slice(0, 150);
    const pages = [...new Set(candidates.map(r => r.page))].slice(0, 3);
    const evidence = document.pages.filter(p => pages.includes(p.page)).map(p => ({ page: p.page, text: p.items.map(i => i.text).join(' ').slice(0, 14000) }));
    busy = true;
    try {
      const result = await agent.generate(JSON.stringify({ request: input.text, selectedReferenceId: match.reference?.id || selected?.id || null, document: { title: document.title, revision: document.revision }, candidates: candidates.map(({ id, label, page }) => ({ id, label, page })), evidence }), {
        structuredOutput: { schema: commandSchema }, maxSteps: 1,
        modelSettings: { temperature: 0, maxOutputTokens: 1400 },
        abortSignal: AbortSignal.timeout(45000),
      });
      const parsed = commandSchema.parse(result.object);
      if(parsed.referenceId && !candidates.some(r=>r.id===parsed.referenceId))return{action:'clarify',message:'The suggested source was not in this drawing. Choose a valid reference before continuing.'};
      const reference = match.reference || candidates.find(r => r.id === parsed.referenceId);
      const annotation=reference ? {id:randomUUID(),referenceId:reference.id,shape:/\bunderline\b/i.test(input.text)?'underline':/\b(?:box|rectangle)\b/i.test(input.text)?'box':'circle',label:reference.label,page:reference.page} : null;
      if (['draft', 'find'].includes(parsed.action) && !reference) return { action: 'clarify', message: 'Choose a matching source reference in the drawing, then try again.' };
      if (reference && ['draft', 'find'].includes(parsed.action) && reference.id !== selected?.id) {
        const requestedPage = /(?:sheet|page)\s+(\d+)/i.exec(input.text)?.[1];
        const sameLabel = document.references.filter(r => r.label.toUpperCase() === reference.label.toUpperCase() && (!requestedPage || r.page === Number(requestedPage)));
        if (sameLabel.length !== 1 || (requestedPage && reference.page !== Number(requestedPage))) return { action: 'clarify', message: `There are multiple occurrences of ${reference.label}. Select the intended occurrence in the drawing before continuing.` };
      }
      if (parsed.action === 'draft') {
        if (!parsed.observation.trim()) return { action: 'clarify', message: 'What did you observe at this reference?' };
        const draft = await inspections.draft({ documentId: document.id, referenceId: reference.id, observation: parsed.observation });
        return { ...parsed, message:parsed.message.trim()||`Review the proposed observation for ${reference.label} before confirming.`, draft, reference,annotation };
      }
      return { ...parsed, message: parsed.message.trim() || (reference ? `Selected ${reference.label} on sheet ${reference.page}.` : 'Please select a source reference or clarify your question.'), reference,annotation };
    } catch (error) {
      // Provider errors can contain request headers or prompt data; never forward them.
      console.error('Command interpretation failed:', error.name || 'ProviderError', error.status || '');
      throw Object.assign(new Error('AI interpretation failed or timed out. Check your Groq model, key and quota. You can still search and prepare notes directly.'), { status: 502 });
    } finally { busy = false; }
  };
}
