import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The standard PDF font cannot encode all Unicode. Preserve full text in JSON.
const printable = text => String(text).replace(/[^\x20-\x7e\n]/g, '?');
export function reportService(store, documents, directory) {
  return {
    async create(documentId) {
      const document = store.get('document', documentId);
      if (!document) throw Object.assign(new Error('Document not found.'), { status: 404 });
      const history = store.list('finding').filter(f => f.documentId === documentId);
      if (!history.length) throw Object.assign(new Error('Confirm at least one finding before exporting.'), { status: 400 });
      const superseded = new Set(history.map(f => f.supersedes).filter(Boolean));
      const findings = history.filter(f => !superseded.has(f.id)).reverse();
      const pdf = await PDFDocument.load(await documents.file(documentId));
      for (const f of findings) {
        const ref = document.references.find(r => r.id === f.referenceId);
        if (ref?.pdfBounds) pdf.getPage(ref.page - 1).drawRectangle({ ...ref.pdfBounds, borderColor: rgb(0.85, 0.35, 0.15), borderWidth: 1.5, borderOpacity: 0.9 });
      }
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      let page, y;
      const newPage = () => { page = pdf.addPage([595, 842]); y = 790; };
      newPage();
      const line = (text, size = 10) => {
        if (y < 50) newPage();
        page.drawText(printable(text), { x: 42, y, font, size, color: rgb(0.1, 0.24, 0.2) }); y -= size + 7;
      };
      const paragraph = text => {
        for (const part of printable(text).split('\n')) {
          let current = '';
          for (const word of part.match(/\S{1,65}/g) || ['']) {
            if (font.widthOfTextAtSize(`${current} ${word}`, 10) > 505) { line(current); current = word; } else current += `${current ? ' ' : ''}${word}`;
          }
          line(current);
        }
      };
      line('TRACEPOINT / CONFIRMED INSPECTION RECORD', 15);
      paragraph(document.title); line(`Revision ${document.revision} | ${new Date().toISOString()}`);
      line('Inspector observations; not an automated safety assessment.'); y -= 12;
      for (const [index, f] of findings.entries()) {
        line(`${index + 1}. ${f.reference.label} / source page ${f.reference.page} / ${f.status}`, 12);
        paragraph(f.observation); line(`Confirmed ${f.confirmedAt}`); y -= 10;
      }
      line('AMENDMENT HISTORY', 13);
      for (const f of history.filter(f => superseded.has(f.id))) { line(`${f.reference.label} / superseded / ${f.confirmedAt}`); paragraph(f.observation); }
      const id = randomUUID(), createdAt = new Date().toISOString();
      const record = { id, documentId, title: document.title, revision: document.revision, findingCount: findings.length, createdAt };
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, `${id}.pdf`), await pdf.save());
      await writeFile(join(directory, `${id}.json`), JSON.stringify({ ...record, documentHash: document.hash, findings, history }, null, 2));
      return store.put('report', record);
    },
    async file(id, format) {
      if (!store.get('report', id)) throw Object.assign(new Error('Report not found.'), { status: 404 });
      return readFile(join(directory, `${id}.${format === 'json' ? 'json' : 'pdf'}`));
    },
  };
}
