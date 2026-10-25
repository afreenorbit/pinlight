import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { createStore } from './services/store.js';
import { documentService } from './services/documents.js';
import {identifyDocument} from '../shared/learning/catalog.js';
import {createTutorService} from './learning/tutor.js';
import {buildJourney} from './learning/journey.js';
import {createProcessingService} from './learning/processing.js';
import {createDeviceExtractor} from './learning/extractor.js';
import {extractLayout} from './learning/layout.js';
import {createLearningVoiceService} from './learning/voice.js';
import {createVoiceBridge,sendVoiceCompletion,VOICE_MODEL} from './learning/voice-bridge.js';
import {createAuth0Verifier} from './services/auth0.js';
import {createReferenceService} from './learning/references.js';
import { board,experiments,sources } from '../shared/learning/raspberry-pi-5.js';

const fail = (message, status) => Object.assign(new Error(message), { status });
// Public deployment: extra hosts and browser origins come from the environment; local defaults are unchanged.
const listEnv = name => (process.env[name] || '').split(',').map(s => s.trim()).filter(Boolean);
// Requests that spend provider credits or disk are capped per client IP (and overall) when RATE_LIMIT=on.
const limits = { ask: [20, 600e3, 400], voice: [60, 3600e3, 300], upload: [10, 3600e3, 100], command: [30, 600e3, 600] };
function createLimiter() {
  const hits = new Map(), count = (key, windowMs) => { const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs); hits.set(key, list); return list; };
  return (request, bucket) => {
    const [perClient, windowMs, overall] = limits[bucket], ip = (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || request.socket.remoteAddress;
    const mine = count(`${bucket}:${ip}`, windowMs), all = count(bucket, windowMs);
    if (mine.length >= perClient || all.length >= overall) return true;
    mine.push(Date.now()); all.push(Date.now()); return false;
  };
}
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
export function createApplication({ projectRoot = process.cwd(), databasePath = process.env.DATABASE_PATH || './data/pinlight.sqlite', documentsDir = process.env.DOCUMENTS_DIR || './data/documents', learningOptions, learningVoiceOptions, processingOptions, extensionFactory,authOptions,referenceOptions } = {}) {
  const store = createStore(databasePath), documents = documentService(store, documentsDir);
  const extractor=createDeviceExtractor(),processing=createProcessingService({store,documents,cacheKey:`${extractor.status().model}:${process.env.DOCLING_ENABLED||'off'}`,extract:args=>extractor.extract(args),layout:doc=>extractLayout({file:resolve(documentsDir,`${doc.id}.pdf`)}),...processingOptions});
  const extension=extensionFactory?.({store,documents});
  const auth=createAuth0Verifier(authOptions),references=createReferenceService({store,...referenceOptions});
  const voiceBridge=createVoiceBridge();
  const tutor=createTutorService({store,...learningOptions}),learningVoice=createLearningVoiceService({store,bridge:voiceBridge,...learningVoiceOptions});
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', ...listEnv('PUBLIC_HOSTS')]);
  const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', ...listEnv('ALLOWED_ORIGINS')]);
  const limited = process.env.RATE_LIMIT === 'on' ? createLimiter() : () => false;
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const origin = request.headers.origin, trusted = origin && allowedOrigins.has(origin);
      if (trusted) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
      if (request.method === 'OPTIONS') {
        if (!trusted) throw fail('Origin not allowed.', 403);
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' });
        return response.end();
      }
      const host = new URL(`http://${request.headers.host}`).hostname;
      // The hosting platform's health check may use an internal host name.
      if (!allowedHosts.has(host) && request.url !== '/api/health') throw fail('Unsupported host.', 403);
      if (request.method !== 'GET') {
        if ((origin && !trusted && origin !== `http://${request.headers.host}`) || (request.headers['sec-fetch-site'] === 'cross-site' && !trusted)) throw fail('Cross-site writes are not allowed.', 403);
      }
      const url = new URL(request.url, 'http://localhost');
      if(url.pathname.startsWith('/api/learning/voice-model/')){
        if(!voiceBridge.authenticate(request.headers.authorization))throw fail('Unauthorized voice provider.',401);
        if(url.pathname==='/api/learning/voice-model/models'&&request.method==='GET'){response.setHeader('Content-Type','application/json');return response.end(JSON.stringify({object:'list',data:[{id:VOICE_MODEL,object:'model',owned_by:'pinlight'}]}));}
        if(url.pathname==='/api/learning/voice-model/chat/completions'&&request.method==='POST'){const input=await body(request);return sendVoiceCompletion(response,await voiceBridge.complete(input),input.stream!==false);}
        throw fail('Not found.',404);
      }
      const identity=await auth.authenticate(request.headers.authorization);
      const canReadDocument=documentId=>{const access=store.get('document-access',documentId);return !access||access.public||!!identity&&access.owners.includes(identity.ownerKey);};
      const requireDocument=documentId=>{if(!canReadDocument(documentId))throw fail('Document not found.',404);};
      const parts = url.pathname.split('/').filter(Boolean), [, kind, id, action] = parts, method = request.method;
      const bucket = method !== 'POST' ? null : kind === 'learning' && ['ask','journey','process','references'].includes(id) ? 'ask' : kind === 'learning' && id === 'voice-session' ? 'voice' : kind === 'documents' && (!id || id === 'import-local') ? 'upload' : kind === 'commands' ? 'command' : null;
      if (bucket && limited(request, bucket)) throw fail('Too many requests right now. Try again in a few minutes.', 429);
      const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
      if (url.pathname === '/api/health' && method === 'GET') return send({ name: 'pinlight', stage: 'pdf-learning-pipeline', documents: store.list('document').length });
      if (parts[0] !== 'api') throw fail('Not found.', 404);
      if(kind==='auth'&&id==='me'&&method==='GET'){if(!identity)throw fail('Sign in to continue.',401);return send(identity);}
      if(kind==='learning'&&id==='references'&&method==='POST')return send(await references.search(await body(request)));
      if(kind==='learning'&&id==='documents'&&method==='GET')return send(store.list('document').filter(d=>canReadDocument(d.id)).map(d=>({id:d.id,title:d.title,revision:d.revision,...identifyDocument(d)})));
      if(kind==='learning'&&id==='resolve'&&method==='POST'){const input=z.object({documentId:z.string().uuid()}).strict().parse(await body(request));requireDocument(input.documentId);const doc=store.get('document',input.documentId);if(!doc)throw fail('Document not found.',404);return send({documentId:doc.id,title:doc.title,revision:doc.revision,...identifyDocument(doc)});}
      if(kind==='learning'&&id==='journey'&&method==='POST'){
        const input=z.object({documentId:z.string().uuid()}).strict().parse(await body(request));
        requireDocument(input.documentId);
        let doc=store.get('document',input.documentId);if(!doc)throw fail('Document not found.',404);
        if(doc.pages.some(p=>!p.items.length)&&!doc.ocr)doc=await documents.readImages(doc.id);
        return send(buildJourney(doc));
      }
      if(kind==='learning'&&id==='process'&&method==='POST'){
        const input=z.object({documentId:idSchema,retry:z.boolean().optional()}).strict().parse(await body(request));
        requireDocument(input.documentId);
        return send(processing.start(input.documentId,{retry:input.retry}),202);
      }
      if(kind==='learning'&&id==='jobs'&&action&&method==='GET'){idSchema.parse(action);const job=processing.get(action);requireDocument(job.documentId);return send(job);}
      if(kind==='learning'&&id==='status'&&method==='GET')return send({tutor:tutor.status(),voice:learningVoice.status(),extraction:extractor.status(),processing:processing.status(),auth:auth.status(),references:references.status()});
      if(kind==='learning'&&id==='ask'&&method==='POST'){const input=await body(request);if(input.context?.documentId)requireDocument(input.context.documentId);return send(await tutor.ask(input));}
      if(kind==='learning'&&['voice-poll','voice-reply','voice-close'].includes(id)&&method==='POST'){
        const input=z.object({token:z.string().uuid(),id:z.string().uuid().optional(),text:z.string().min(1).max(2400).optional()}).strict().parse(await body(request));
        if(id==='voice-poll')return send(voiceBridge.poll(input.token));
        if(id==='voice-close')return send(voiceBridge.close(input.token));
        return send(voiceBridge.reply(input.token,input.id,input.text));
      }
      if(kind==='learning'&&id==='voice-session'&&method==='POST'){const input=await body(request);if(input.context?.documentId)requireDocument(input.context.documentId);return send(await learningVoice.mint(input),201);}
      if (kind === 'learning' && id === 'catalog' && method === 'GET') return send({board,experiments,sources,stage:'detailed-learning-desk',continuousVoice:learningVoice.status().configured,liveSceneTools:false,automatic3d:false});
      if (kind === 'documents' && method === 'GET' && !id) return send(store.list('document').filter(d=>canReadDocument(d.id)).map(({ pages, references, ...d }) => ({ ...d, pageCount: pages.length, referenceCount: references.length, textCount: pages.reduce((n, p) => n + p.items.length, 0) })));
      if (kind === 'documents' && method === 'POST' && id === 'import-local'){if(auth.status().configured&&!identity)throw fail('Sign in to import server files.',401);return send({ results: await documents.importLocal(projectRoot) });}
      if (kind === 'documents' && method === 'POST' && !id){
        const result=await documents.import(await body(request,true),url.searchParams.get('name')||'datasheet.pdf'),existing=store.get('document-access',result.document.id);
        if(!result.duplicate)store.put('document-access',{id:result.document.id,public:!identity,owners:identity?[identity.ownerKey]:[]});
        else if(existing&&!existing.public&&identity&&!existing.owners.includes(identity.ownerKey))store.put('document-access',{...existing,owners:[...existing.owners,identity.ownerKey]});
        // Knowing an ID or a hash is not enough: dedup access is granted only after
        // the caller supplies the complete, byte-identical PDF.
        else if(existing&&!existing.public&&!identity)throw fail('Sign in to save this document.',401);
        return send(result,201);
      }
      if (kind === 'documents' && id) {
        idSchema.parse(id);requireDocument(id);const document = store.get('document', id);
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
      if(extension?.handle&&await extension.handle({kind,id,action,method,url,parts,request,body,idSchema,z,send:(value,status=200,format)=>{if(format){response.writeHead(status,{'Content-Type':format==='pdf'?'application/pdf':'application/json','Content-Disposition':`attachment; filename="inspection-${id}.${format}"`});response.end(value);}else send(value,status);}}))return;
      throw fail('Not found.', 404);
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : (error.status || 500);
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error instanceof z.ZodError ? 'Some fields are missing or invalid.' : status === 500 ? 'The operation could not be completed.' : error.message }));
      if (status === 500) console.error('API operation failed:', error.name, error.message);
    }
  });
  return { server, store, documents, processing, ...extension?.services };
}



