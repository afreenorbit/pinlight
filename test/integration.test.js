import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { createApplication } from '../server/app.js';
import { createInspectionEngine } from '../server/mastra/index.js';

test('PDF → validated draft → explicit confirmation → amendment → durable report', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'tracepoint-test-'));
  const config = { projectRoot: dir, databasePath: join(dir, 'test.sqlite'), documentsDir: join(dir, 'documents'), reportsDir: join(dir, 'reports'), engine: createInspectionEngine({}), bolnaOptions: {configured:false} };
  const app = createApplication(config);
  let closed = false;
  try {
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i++) { const p = pdf.addPage([400, 300]); if(i === 1) p.setRotation(degrees(90)); p.drawText('J12', { x: 50, y: 220, font, size: 12 }); p.drawText('C9', { x: 180, y: 140, font, size: 12 }); }
    const bytes = await pdf.save();
    const { document } = await app.documents.import(bytes, 'fixture.pdf');
    assert.equal(document.pages.length, 2); assert.equal(document.references.filter(r => r.label === 'J12').length, 2);
    const reference = document.references.find(r => r.label === 'J12');
    assert.ok(reference.bounds.x >= 0 && reference.bounds.y >= 0 && reference.bounds.width > 0);
    assert.ok(Math.abs(reference.pdfBounds.x - 50) < 1);
    const rotated = document.references.find(r => r.label === 'J12' && r.page === 2);
    assert.ok(Math.abs(rotated.pdfBounds.x - 50) < 1, 'Rotated page maps back to the correct PDF location');
    assert.equal((await app.documents.import(bytes, 'renamed.pdf')).duplicate, true);
    await assert.rejects(app.documents.import(Buffer.from('not a pdf'), 'bad.pdf'), /valid PDF/);
    await assert.rejects(app.inspections.draft({ documentId: document.id, referenceId: crypto.randomUUID(), observation: 'Unknown reference' }), /Select a reference/);
    const draft = await app.inspections.draft({ documentId: document.id, referenceId: reference.id, observation: ' No crack observed. Check tolerance ±0.2 mm. ' });
    assert.equal(app.store.list('finding').length, 0); assert.equal(draft.observation, 'No crack observed. Check tolerance ±0.2 mm.');
    assert.throws(() => app.inspections.confirm(draft.id, { confirmed: false }));
    const finding = app.inspections.confirm(draft.id, { confirmed: true });
    assert.equal(app.inspections.confirm(draft.id, { confirmed: true }).id, finding.id);
    assert.equal(app.store.list('finding').length, 1);
    const dismissed = await app.inspections.draft({documentId:document.id,referenceId:reference.id,observation:'Unconfirmed scratch note'});
    app.inspections.dismiss(dismissed.id);
    assert.throws(() => app.inspections.confirm(dismissed.id,{confirmed:true}), /dismissed/);
    const amendment = await app.inspections.draft({ documentId: document.id, referenceId: reference.id, observation: 'Verified against source; follow-up required.', supersedes: finding.id });
    const next = app.inspections.confirm(amendment.id, { confirmed: true });
    assert.equal(app.store.get('finding', finding.id).observation, 'No crack observed. Check tolerance ±0.2 mm.');
    await assert.rejects(app.inspections.draft({ documentId: document.id, referenceId: reference.id, observation: 'Stale amendment', supersedes: finding.id }), /newer amendment/);
    assert.throws(() => app.inspections.status(finding.id, 'resolved'), /latest finding/);
    app.inspections.status(next.id, 'reviewed');
    const report = await app.reports.create(document.id), exportPdf = await app.reports.file(report.id, 'pdf');
    assert.equal((await PDFDocument.load(exportPdf)).getPageCount(), 3);
    const record = JSON.parse((await app.reports.file(report.id, 'json')).toString());
    assert.equal(record.findings.length, 1); assert.equal(record.history.length, 2);
    assert.match(record.history.find(f => f.id === finding.id).observation, /±0.2/);

    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const request = (path, options = {}) => fetch(`${base}/api${path}`, options);
    await t.test('HTTP validation, cross-site protections and report download', async () => {
      assert.equal((await request('/documents')).status, 200);
      assert.equal((await (await request('/bolna/status')).json()).configured,false);
      assert.equal((await request('/bolna/session',{method:'POST',body:JSON.stringify({documentId:document.id,consent:false})})).status,400);
      assert.equal((await request('/bolna/session',{method:'POST',body:JSON.stringify({documentId:document.id,consent:true})})).status,503);
      assert.equal((await request(`/bolna/executions/${crypto.randomUUID()}`,{method:'POST',body:'{}'})).status,404);
      const upload = await request('/documents?name=duplicate.pdf', { method:'POST', headers:{'Content-Type':'application/pdf'}, body: bytes });
      assert.equal(upload.status, 201); assert.equal((await upload.json()).duplicate, true);
      assert.equal((await request('/documents?name=bad.pdf', {method:'POST',body:'invalid'})).status, 400);
      assert.equal((await request(`/documents/${document.id}/file`)).headers.get('content-type'), 'application/pdf');
      assert.equal((await request('/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
      assert.equal((await request('/drafts', { method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}' })).status, 403);
      assert.equal((await request(`/documents/${crypto.randomUUID()}`)).status, 404);
      const ambiguous=await request('/commands', { method: 'POST', body: JSON.stringify({ documentId: document.id, text: 'Find J12' }) });
      assert.equal(ambiguous.status,200);assert.equal((await ambiguous.json()).action,'clarify');
      assert.equal((await request('/commands', {method:'POST',body:JSON.stringify({documentId:document.id,text:'Explain this drawing'})})).status,503);
      const pin = await request(`/documents/${document.id}/references`, { method: 'POST', body: JSON.stringify({ page: 2, label: 'Manual connector', bounds: {x:.2,y:.2,width:.03,height:.02}, pdfBounds:{x:80,y:234,width:12,height:6} }) });
      assert.equal(pin.status, 201); assert.equal((await pin.json()).manual, true);
      const downloaded = await request(`/reports/${report.id}/pdf`);
      assert.match(downloaded.headers.get('content-disposition'), /attachment/); assert.equal(downloaded.status, 200);
    });
    await new Promise(resolve => app.server.close(resolve)); app.store.close(); closed = true;
    const restarted = createApplication(config);
    try { assert.equal(restarted.store.list('finding').length, 2); assert.equal(restarted.store.list('document').length, 1); assert.equal((await restarted.reports.file(report.id, 'pdf')).length, exportPdf.length); }
    finally { restarted.store.close(); }
  } finally { if (!closed) { if(app.server.listening) await new Promise(resolve=>app.server.close(resolve)); app.store.close(); } await rm(dir, { recursive: true, force: true }); }
});
