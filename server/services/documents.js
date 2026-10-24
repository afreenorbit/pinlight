import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { getDocument, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readImagePages } from './ocr.js';

export async function extractPdf(bytes) {
  if (bytes.length > 20 * 1024 * 1024) throw Object.assign(new Error('PDF must be smaller than 20 MB.'), { status: 413 });
  if (!Buffer.from(bytes).subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw Object.assign(new Error('Choose a valid PDF file.'), { status: 400 });
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false });
  let pdf;
  try {
    pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('Use a PDF with 100 pages or fewer.');
    const pages = [], references = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = [];
      for (const item of content.items) {
        if (!item.str?.trim()) continue;
        const t = Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(t[2], t[3]);
        const style = content.styles[item.fontName];
        const ascent = (style?.ascent ?? 0.8) * fontHeight;
        const directionLength = Math.hypot(t[0], t[1]) || 1, upLength = fontHeight || 1;
        const dx = t[0] / directionLength, dy = t[1] / directionLength;
        const ux = t[2] / upLength, uy = t[3] / upLength;
        const textWidth = Math.max(item.width, fontHeight * .4);
        const corners = [0, textWidth].flatMap(w => [ascent, ascent - fontHeight].map(h => [t[4] + dx * w + ux * h, t[5] + dy * w + uy * h]));
        const x = Math.max(0, Math.min(viewport.width, Math.min(...corners.map(c => c[0]))));
        const y = Math.max(0, Math.min(viewport.height, Math.min(...corners.map(c => c[1]))));
        const width = Math.min(viewport.width, Math.max(...corners.map(c => c[0]))) - x;
        const height = Math.min(viewport.height, Math.max(...corners.map(c => c[1]))) - y;
        if (width <= 0 || height <= 0) continue;
        const bounds = { x: x / viewport.width, y: y / viewport.height, width: width / viewport.width, height: height / viewport.height };
        items.push({ text: item.str.trim(), bounds });
        // One occurrence is one selectable reference. Repeated labels stay distinct.
        if (/^[A-Z]{1,5}\d+[A-Z]?$/i.test(item.str.trim())) {
          const a = viewport.convertToPdfPoint(x, y), b = viewport.convertToPdfPoint(x + width, y + height);
          references.push({ id: randomUUID(), label: item.str.trim(), page: p, bounds,
            pdfBounds: { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) } });
        }
      }
      pages.push({ page: p, width: viewport.width, height: viewport.height, rotation: page.rotate, items });
    }
    return { pages, references };
  } finally { await task.destroy(); }
}

export function documentService(store, directory) {
  const root = resolve(directory);
  const pendingOcr=new Map();
  return {
    async readImages(id) {
      if(pendingOcr.has(id))return pendingOcr.get(id);
      const job=(async()=>{
        const doc=store.get('document',id);
        if(!doc)throw Object.assign(new Error('Document not found.'),{status:404});
        if(doc.pages.every(p=>p.items.length))return doc;
        const results=await readImagePages(await this.file(id),doc.pages);
        const latest=store.get('document',id);
        return store.put('document',{...latest,pages:latest.pages.map(p=>{const result=results.find(r=>r.page===p.page);return result?{...p,items:result.items,extraction:'local-ocr'}:p;}),references:[...latest.references,...results.flatMap(r=>r.references)],ocr:{status:'complete',processedAt:new Date().toISOString(),pages:results.length}});
      })();
      pendingOcr.set(id,job);
      try{return await job;}finally{pendingOcr.delete(id);}
    },
    async import(bytes, name) {
      const hash = createHash('sha256').update(bytes).digest('hex');
      const existing = store.list('document').find(d => d.hash === hash);
      if (existing) return { document: existing, duplicate: true };
      let extracted;
      try { extracted = await extractPdf(bytes); } catch (e) { throw Object.assign(new Error(e.status ? e.message : 'This PDF could not be read. Use an unencrypted PDF with 100 pages or fewer.'), { status: e.status || 422 }); }
      await mkdir(root, { recursive: true });
      const id = randomUUID();
      await writeFile(join(root, `${id}.pdf`), bytes, { flag: 'wx' });
      const document = store.put('document', { id, hash, title: basename(name).slice(0, 180), revision: hash.slice(0, 10), createdAt: new Date().toISOString(), ...extracted });
      return { document, duplicate: false };
    },
    file(id) {
      if (!store.get('document', id)) throw Object.assign(new Error('Document not found.'), { status: 404 });
      return readFile(join(root, `${id}.pdf`));
    },
    async pinGeometry(id, pageNumber, bounds) {
      const task = getDocument({ data: new Uint8Array(await this.file(id)), isEvalSupported: false });
      try {
        const pdf = await task.promise, page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const a = viewport.convertToPdfPoint(bounds.x * viewport.width, bounds.y * viewport.height);
        const b = viewport.convertToPdfPoint((bounds.x + bounds.width) * viewport.width, (bounds.y + bounds.height) * viewport.height);
        return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(a[0] - b[0]), height: Math.abs(a[1] - b[1]) };
      } finally { await task.destroy(); }
    },
    async importLocal(projectRoot) {
      const outcomes = [];
      for (const dir of new Set([resolve(projectRoot), root])) {
        await mkdir(dir, { recursive: true });
        for (const file of await readdir(dir, { withFileTypes: true })) {
          if (!file.isFile() || !file.name.toLowerCase().endsWith('.pdf') || /^[0-9a-f-]{36}\.pdf$/.test(file.name)) continue;
          try { const result = await this.import(await readFile(join(dir, file.name)), file.name); outcomes.push({ name: file.name, id: result.document.id, duplicate: result.duplicate }); }
          catch (e) { outcomes.push({ name: file.name, error: e.message }); }
        }
      }
      return outcomes;
    },
  };
}
