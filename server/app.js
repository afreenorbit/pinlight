import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { createStore } from './services/store.js';
import { documentService } from './services/documents.js';
import { inspectionService } from './services/inspections.js';
import { commandService } from './services/commands.js';
import { reportService } from './services/reports.js';
import { mastra } from './mastra/index.js';
import {identifyDocument,getPackage} from '../shared/learning/catalog.js';
import {createTutorService} from './learning/tutor.js';
import {createLearningVoiceService} from './learning/voice.js';
import { bolnaService } from './bolna/service.js';
import { board,experiments,sources } from '../shared/learning/raspberry-pi-5.js';

const fail = (message, status) => Object.assign(new Error(message), { status });
const idSchema = z.string().uuid();
const boundsSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).refine(b => b.x + b.width <= 1.001 && b.y + b.height <= 1.001);
const manualSchema = z.object({ page: z.number().int().positive(), label: z.string().trim().min(1).max(60), bounds: boundsSchema, pdfBounds: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }) }).strict();
async function body(request, binary = false) {
  const parts = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > (binary ? 20 * 1024 * 1024 : 64 * 1024)) throw fail('Request is too large.', 413); parts.push(chunk); }
  const bytes = Buffer.concat(parts);
  if (binary) return bytes;
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw fail('Invalid JSON body.', 400); }
}
export function createApplication({ projectRoot = process.cwd(), databasePath = process.env.DATABASE_PATH || './data/tracepoint.sqlite', documentsDir = process.env.DOCUMENTS_DIR || './data/documents', reportsDir = './data/reports', engine = mastra, bolnaOptions, learningOptions, learningVoiceOptions } = {}) {
  const store = createStore(databasePath), documents = documentService(store, documentsDir);
  const inspections = inspectionService(store, engine), commands = commandService(store, engine, inspections);
  const reports = reportService(store, documents, resolve(reportsDir));
  const bolna = bolnaService(store, bolnaOptions); const tutor=createTutorService({store,...learningOptions}), learningVoice=createLearningVoiceService({store,...learningVoiceOptions});
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const host = new URL(`http://${request.headers.host}`).hostname;
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) throw fail('Unsupported host.', 403);
      if (request.method !== 'GET') {
        const origin = request.headers.origin;
        if ((origin && !['http://localhost:5173', 'http://127.0.0.1:5173', `http://${request.headers.host}`].includes(origin)) || request.headers['sec-fetch-site'] === 'cross-site') throw fail('Cross-site writes are not allowed.', 403);
      }
      const url = new URL(request.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean), [, kind, id, action] = parts, method = request.method;
      const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
      if (url.pathname === '/api/health' && method === 'GET') return send({ name: 'tracepoint', stage: 'local-mvp', documents: store.list('document').length });
      if (url.pathname === '/api/engine' && method === 'GET') return send({ framework: 'Mastra', workflows: Object.keys(engine.listWorkflows()), agents: Object.keys(engine.listAgents()), providerCallsEnabled: Boolean(engine.listAgents().inspectionAgent), model: process.env.GROQ_MODEL || null, documentRetrievalConnected: true, persistenceConnected: true, voice: { wispr: 'external-dictation', bolna: bolna.status() } });
      if (parts[0] !== 'api') throw fail('Not found.', 404);
      if(kind==='learning'&&id==='documents'&&method==='GET')return send(store.list('document').map(d=>({id:d.id,title:d.title,revision:d.revision,...identifyDocument(d)})));
      if(kind==='learning'&&id==='resolve'&&method==='POST'){const input=z.object({documentId:z.string().uuid()}).strict().parse(await body(request));const doc=store.get('document',input.documentId);if(!doc)throw fail('Document not found.',404);return send({documentId:doc.id,title:doc.title,revision:doc.revision,...identifyDocument(doc)});}
      if(kind==='learning'&&id==='status'&&method==='GET')return send({tutor:tutor.status(),voice:learningVoice.status()});
      if(kind==='learning'&&id==='ask'&&method==='POST')return send(await tutor.ask(await body(request)));
      if(kind==='learning'&&id==='voice-session'&&method==='POST')return send(await learningVoice.mint(await body(request)),201);
      if (kind === 'learning' && id === 'catalog' && method === 'GET') return send({board,experiments,sources,stage:'detailed-learning-desk',continuousVoice:learningVoice.status().configured,liveSceneTools:false,automatic3d:false});
      if (kind === 'documents' && method === 'GET' && !id) return send(store.list('document').map(({ pages, references, ...d }) => ({ ...d, pageCount: pages.length, referenceCount: references.length, textCount: pages.reduce((n, p) => n + p.items.length, 0) })));
      if (kind === 'documents' && method === 'POST' && id === 'import-local') return send({ results: await documents.importLocal(projectRoot) });
      if (kind === 'documents' && method === 'POST' && !id) return send(await documents.import(await body(request, true), url.searchParams.get('name') || 'drawing.pdf'), 201);
      if (kind === 'documents' && id) {
        idSchema.parse(id); const document = store.get('document', id);
        if (!document) throw fail('Document not found.', 404);
        if (method === 'GET' && !action) return send(document);
        if (method === 'POST' && action === 'read-images') return send(await documents.readImages(id));
        if (method === 'GET' && action === 'file') { const file = await documents.file(id); response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' }); return response.end(file); }
        if (method === 'POST' && action === 'references') {
          const ref = manualSchema.parse(await body(request));
          if (!document.pages[ref.page - 1]) throw fail('Page not found.', 400);
          const reference = { ...ref, pdfBounds: await documents.pinGeometry(id, ref.page, ref.bounds), id: randomUUID(), manual: true };
          const latest = store.get('document', id);
          store.put('document', { ...latest, references: [...latest.references, reference] }); return send(reference, 201);
        }
      }
      if (kind === 'drafts' && method === 'POST' && !id) return send(await inspections.draft(await body(request)), 201);
      if (kind === 'drafts' && method === 'GET' && !id) return send(store.list('draft').filter(d => d.status === 'awaiting_review' && (!url.searchParams.get('documentId') || d.documentId === url.searchParams.get('documentId'))));
      if (kind === 'drafts' && method === 'POST' && action === 'dismiss') { idSchema.parse(id); return send(inspections.dismiss(id)); }
      if (kind === 'drafts' && method === 'POST' && action === 'confirm') { idSchema.parse(id); return send(inspections.confirm(id, await body(request)), 201); }
      if (kind === 'inspections' && method === 'GET' && !id) return send(store.list('finding').filter(f => !url.searchParams.get('documentId') || f.documentId === url.searchParams.get('documentId')));
      if (kind === 'inspections' && method === 'PATCH' && id) { idSchema.parse(id); const { status } = z.object({ status: z.string() }).strict().parse(await body(request)); return send(inspections.status(id, status)); }
      if (kind === 'commands' && method === 'POST' && !id) {
        const input=await body(request);
        idSchema.parse(input.documentId);
        const doc=store.get('document',input.documentId);
        if(doc?.pages.some(p=>!p.items.length)&&!doc.ocr)await documents.readImages(doc.id);
        return send(await commands(input));
      }
      if (kind === 'reports' && method === 'GET' && !id) return send(store.list('report'));
      if (kind === 'reports' && method === 'POST' && !id) { const input = z.object({ documentId: idSchema }).strict().parse(await body(request)); return send(await reports.create(input.documentId), 201); }
      if (kind === 'reports' && method === 'GET' && id && ['pdf', 'json'].includes(action)) { idSchema.parse(id); const file = await reports.file(id, action); response.writeHead(200, { 'Content-Type': action === 'pdf' ? 'application/pdf' : 'application/json', 'Content-Disposition': `attachment; filename="tracepoint-${id}.${action}"` }); return response.end(file); }
      if (kind === 'bolna' && id === 'status' && method === 'GET') return send(bolna.status());
      if (kind === 'bolna' && id === 'session' && method === 'POST') return send(await bolna.mint(await body(request)), 201);
      if (kind === 'bolna' && id === 'sessions' && method === 'GET') return send(bolna.list(url.searchParams.get('documentId')));
      if (kind === 'bolna' && id === 'executions' && action) {
        idSchema.parse(action);
        if (method === 'POST' && parts[4] === 'draft') return send(await bolna.draft(action, inspections),201);
        if (method === 'POST' && !parts[4]) return send(await bolna.sync(action));
      }
      throw fail('Not found.', 404);
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : (error.status || 500);
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error instanceof z.ZodError ? 'Some fields are missing or invalid.' : status === 500 ? 'The operation could not be completed.' : error.message }));
      if (status === 500) console.error('API operation failed:', error.name, error.message);
    }
  });
  return { server, store, documents, inspections, reports, bolna };
}



