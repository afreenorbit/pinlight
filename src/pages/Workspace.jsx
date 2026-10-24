import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import PdfViewer from '../components/PdfViewer.jsx';
import SpokenResponse from '../components/SpokenResponse.jsx';
import { apiRequest, post } from '../lib/api.js';

const BolnaConversation = lazy(() => import('../components/BolnaConversation.jsx'));

export default function Workspace() {
  const params = new URLSearchParams(location.search);
  const [voiceActive,setVoiceActive] = useState(false);
  const [annotation,setAnnotation] = useState(null), [suggestions,setSuggestions] = useState([]);
  const [autoRead,setAutoRead] = useState(false);
  const [documents, setDocuments] = useState([]), [documentId, setDocumentId] = useState(params.get('document') || '');
  const [document, setDocument] = useState(null), [findings, setFindings] = useState([]), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), [search, setSearch] = useState(''), [text, setText] = useState('');
  const [mode, setMode] = useState('observation'), [draft, setDraft] = useState(null), [amending, setAmending] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [pending, setPending] = useState([]);
  const [pin, setPin] = useState(null), [pinLabel, setPinLabel] = useState(''), [engine, setEngine] = useState(null);
  const input = useRef(null), generation = useRef(0);
  const loadPending = id => apiRequest(`/drafts?documentId=${id}`).then(setPending);
  const loadFindings = id => apiRequest(`/inspections?documentId=${id}`).then(setFindings);
  useEffect(() => { let active = true; Promise.all([apiRequest('/documents'), apiRequest('/engine')]).then(([docs, info]) => { if (!active) return; setDocuments(docs); setEngine(info); setDocumentId(id => id || docs.find(d => d.referenceCount)?.id || docs[0]?.id || ''); }).catch(e => { if(active) setError(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const token = ++generation.current;
    setDocument(null); setSelected(null); setDraft(null); setAmending(null); setText(''); setMessage(''); setSearch(''); setPage(1); setPin(null); setFindings([]); setPending([]); setMode('observation'); setAnnotation(null); setSuggestions([]);
    if (!documentId) return;
    Promise.all([apiRequest(`/documents/${documentId}`), apiRequest(`/inspections?documentId=${documentId}`), apiRequest(`/drafts?documentId=${documentId}`)]).then(([doc, notes, drafts]) => {
      if (generation.current !== token) return;
      setDocument(doc); setFindings(notes); setPending(drafts);
      const finding = notes.find(f => f.id === params.get('finding'));
      if (finding) { const ref = doc.references.find(r => r.id === finding.referenceId); setSelected(ref); setPage(ref?.page || 1); }
    }).catch(e => { if (generation.current === token) setError(e.message); });
    return () => { generation.current++; };
  }, [documentId]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const choose = ref => { const saved=findings.find(f=>f.referenceId===ref.id&&!findings.some(next=>next.supersedes===f.id)); setSelected(ref); setAnnotation({id:crypto.randomUUID(),referenceId:ref.id,shape:'circle',label:ref.label,page:ref.page,...(saved?{note:saved.observation,confirmed:true}:{})}); setSuggestions([]); setPage(ref.page); setDraft(null); setAmending(null); setText(''); setMessage(''); setError(''); input.current?.focus(); };
  const work = async fn => { setBusy(true); setError(''); try { await fn(); } catch(e) { setError(e.message); } finally { setBusy(false); } };
  const prepare = () => work(async () => {
    if (voiceActive || busy) return;
    if (!text.trim()) throw new Error('Dictate or type something first.');
    if (mode === 'observation') {
      if (!selected) throw new Error('Select or pin a source reference first.');
      const prepared=await post('/drafts', { documentId, referenceId: selected.id, observation: text, ...(amending ? { supersedes: amending.id } : {}) });
      setDraft(prepared); setAnnotation({id:crypto.randomUUID(),referenceId:selected.id,shape:'box',label:selected.label,page:selected.page,note:prepared.observation});
      setMessage('Draft prepared. Check the source and wording before confirming.');
    } else {
      const result = await post('/commands', { documentId, ...(selected ? { referenceId: selected.id } : {}), text });
      if(document.pages.some(p=>!p.items.length))setDocument(await apiRequest(`/documents/${documentId}`));
      setMessage(result.message); setSuggestions(result.suggestions || []); setAnnotation(result.annotation ? {...result.annotation,note:result.draft?.observation || result.message} : null);
      if (result.reference) { setSelected(result.reference); setPage(result.reference.page); }
      setDraft(result.draft || null);
    }
    await loadPending(documentId);
  });
  const confirm = () => work(async () => { await post(`/drafts/${draft.id}/confirm`, { confirmed: true }); await loadFindings(documentId); await loadPending(documentId); setAnnotation({id:crypto.randomUUID(),referenceId:selected.id,shape:'box',label:selected.label,page:selected.page,note:draft.observation,confirmed:true}); setDraft(null); setText(''); setAmending(null); setMessage('Finding confirmed and saved locally.'); });
  const amend = finding => { const ref = document.references.find(r => r.id === finding.referenceId); choose(ref); setAmending(finding); setMode('observation'); setText(finding.observation); setMessage('Amend this observation. The previous version will stay in the history.'); input.current?.focus(); };
  const makeReport = () => work(async () => { const report = await post('/reports', { documentId }); setMessage('Report created. Open Reports to download its PDF and JSON.'); setReport(report); });
  const [report, setReport] = useState(null);
  const latest = findings.filter(f => !findings.some(n => n.supersedes === f.id));
  const matches = document?.references.filter(r => !search || r.label.toLowerCase().includes(search.toLowerCase())) || [];
  return <section className="section-wrap app-page working-workspace"><div className="page-heading"><div><div className="eyebrow">WORKSPACE / SOURCE & OBSERVATION</div><h1>Your inspection desk.</h1><p>Keep the drawing in view. Dictate what you observe, then review the evidence before saving.</p></div><a className="text-link" href="/documents">Document library →</a></div>
    <div className="workspace-top"><label className="field-label">Active drawing<select value={documentId} disabled={busy || voiceActive} onChange={e => { setDocumentId(e.target.value); history.replaceState(null, '', `/workspace?document=${e.target.value}`); setReport(null); setError(''); }} aria-label="Active drawing"><option value="">Choose a drawing</option>{documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label><span className="outline-badge">{engine?.providerCallsEnabled ? `Groq · ${engine.model}` : 'AI not configured'}</span></div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {!documents.length && <div className="empty-state"><h2>Start with a drawing.</h2><p>Import the PDFs you saved or upload a document in the library.</p><a href="/documents" className="button button-dark">Open document library</a></div>}
    {document && <><div className="workspace-shell live-workspace"><div className="source-column"><PdfViewer key={document.id} document={document} annotation={annotation} findings={findings} pageNumber={page} onPage={setPage} selected={selected} onSelect={busy || voiceActive ? () => {} : choose} onPin={p => { if(!busy && !voiceActive) { setPin(p); setPinLabel(''); } }} />
      {document.pages.some(p => !p.items.length) && <div className="feedback">This drawing includes image-only sheets. Your first assistant request reads their text locally; this may take a moment. <button className="text-link" disabled={busy || voiceActive} onClick={()=>work(async()=>{setDocument(await post(`/documents/${documentId}/read-images`,{}));setMessage('Image text read. Ask for a visible heading or label. OCR can misread small text; verify the highlighted source.');})}>Read image text now</button></div>}
      {document.ocr && <p className="dictation-hint">Local OCR enabled. Highlights locate recognized text, not verified circuit connections. Check small labels against the original sheet.</p>}
      {pin && <form className="pin-form" onSubmit={e => { e.preventDefault(); work(async () => { const ref = await post(`/documents/${documentId}/references`, { ...pin, label: pinLabel }); setDocument(d => ({ ...d, references: [...d.references, ref] })); choose(ref); setPin(null); }); }}><label className="field-label">Label for pinned location<input autoFocus value={pinLabel} onChange={e => setPinLabel(e.target.value)} maxLength={60} required placeholder="e.g. J1 or power connector" /></label><button className="button button-dark" disabled={busy || voiceActive}>Add reference</button><button type="button" className="text-link" onClick={() => setPin(null)}>Cancel</button></form>}
      <div className="reference-search"><label className="field-label">Find a reference<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Try R1, U5A, or C9" /></label><div className="reference-list">{matches.slice(0,80).map(r => <button key={r.id} disabled={busy || voiceActive} aria-pressed={selected?.id === r.id} onClick={() => choose(r)}>{r.label}<small>sheet {r.page}{r.manual ? ' · pinned' : ''}</small></button>)}{!matches.length && <p>No matching labels. Pin a reference directly on the drawing.</p>}{matches.length > 80 && <p>Showing 80 of {matches.length}. Narrow your search.</p>}</div></div></div>
      <aside className="inspection-panel composer"><div className="eyebrow">INSPECTION NOTEBOOK</div><h2>{selected ? selected.label : 'Follow the reference.'}</h2><p>{selected ? `Sheet ${selected.page} · revision ${document.revision}${selected.manual ? ' · manually pinned' : ''}` : 'Choose a label on the drawing to attach your observation.'}</p>
      <div className="composer-tabs"><button disabled={busy || voiceActive} aria-pressed={mode === 'observation'} onClick={() => { setMode('observation'); setDraft(null); }}>Observation</button><button disabled={busy || voiceActive} aria-pressed={mode === 'assistant'} onClick={() => { setMode('assistant'); setDraft(null); setAmending(null); }}>Ask / navigate</button></div>
      {amending && <p className="feedback">Amending a confirmed finding. History will be preserved.</p>}
      <label className="field-label" htmlFor="inspection-input">{mode === 'observation' ? 'Your observation' : 'Question or navigation request'}</label>
      <textarea id="inspection-input" ref={input} value={text} disabled={busy || voiceActive} onChange={e => { setText(e.target.value); setDraft(null); setSuggestions([]); }} onKeyDown={e => { if(!voiceActive && !busy && e.ctrlKey && e.key === 'Enter') {e.preventDefault(); prepare();} }} placeholder={mode === 'observation' ? 'Dictate what you checked, what you observed, and what needs another look…' : 'Find C9. Or: what text does this sheet show for U5A?'} rows={7} />
      <p className="dictation-hint">Wispr: focus this field, hold Ctrl + Win, speak, then release. Ctrl + Enter prepares your draft.</p>
      <button className="button button-dark wide" disabled={busy || voiceActive || !text.trim() || (mode === 'assistant' && !engine?.providerCallsEnabled)} onClick={prepare}>{busy ? (mode === 'assistant' ? 'Mastra is interpreting…' : 'Preparing source-linked draft…') : mode === 'observation' ? 'Prepare review draft' : 'Ask drawing assistant'}</button>
      <p className="privacy-hint">{mode === 'assistant' ? 'This sends your request and relevant extracted PDF text to Groq. It does not verify diagram connections.' : 'Direct observations stay local. Preparation does not send your note to an AI provider.'}</p>
      <label className="read-aloud-setting"><input type="checkbox" checked={autoRead} disabled={voiceActive} onChange={e=>setAutoRead(e.target.checked)}/>Read answers aloud <small>browser narration</small></label>
      {busy && <p className="workflow-progress" role="status">{mode==='assistant'?(document.pages.some(p=>!p.items.length)?'Reading image text locally → Mastra → sheet annotation':'Mastra agent → source validation → sheet annotation'):'Mastra workflow → source-linked review draft'}</p>}
      {message && <SpokenResponse text={message} autoRead={autoRead} blocked={voiceActive}/>}
      {suggestions.length>0 && <div className="reference-suggestions"><p>Choose the source you meant:</p>{suggestions.map(ref=><button key={ref.id} onClick={()=>{choose(ref);setMode('assistant');setText(`What does this sheet show for ${ref.label}?`);}}>{ref.label} · sheet {ref.page}</button>)}</div>}
      {draft && <div className="draft-review"><div className="eyebrow">REVIEW BEFORE SAVING</div><h3>{draft.reference.label} · sheet {draft.reference.page}</h3><p>{draft.observation}</p><button className="button button-dark wide" onClick={confirm} disabled={busy || voiceActive}>Confirm and save finding</button><button className="text-link" disabled={busy || voiceActive} onClick={() => { setText(draft.observation); setMode('observation'); setDraft(null); input.current?.focus(); }}>Edit wording</button><button className="text-link" disabled={busy || voiceActive} onClick={() => work(async () => { await post(`/drafts/${draft.id}/dismiss`, {}); await loadPending(documentId); setDraft(null); setMessage('Draft dismissed. No finding was saved.'); })}>Dismiss</button></div>}
      </aside></div><Suspense fallback={<p className="empty-note">Loading voice controls…</p>}><BolnaConversation key={document.id} document={document} reference={selected} configured={engine?.voice?.bolna?.configured} blocked={busy} onActiveChange={active=>{setVoiceActive(active);if(active)window.speechSynthesis?.cancel();}} onDraft={draft=>{const ref=document.references.find(r=>r.id===draft.referenceId);choose(ref);setText(draft.observation);setDraft(draft);setMode('observation');loadPending(documentId);input.current?.focus();}} /></Suspense>
      <section className="saved-findings">{pending.length > 0 && <div className="pending-drafts"><div className="eyebrow">UNCONFIRMED DRAFTS · {pending.length}</div><p className="empty-note">Prepared drafts survive refresh. Review one to confirm it or dismiss it.</p>{pending.map(d => <article className="finding-card" key={d.id}><div className="finding-title"><strong>{d.reference.label} · sheet {d.reference.page}</strong><span className="outline-badge">Awaiting review</span></div><p>{d.observation}</p><div className="finding-actions"><button className="text-link" disabled={busy || voiceActive} onClick={() => { const ref = document.references.find(r => r.id === d.referenceId); choose(ref); setText(d.observation); setDraft(d); setMode('observation'); setAmending(d.supersedes ? findings.find(f => f.id === d.supersedes) : null); input.current?.focus(); }}>Review draft</button><button className="text-link" disabled={busy || voiceActive} onClick={() => work(async () => { await post(`/drafts/${d.id}/dismiss`, {}); await loadPending(documentId); if(draft?.id === d.id) setDraft(null); })}>Dismiss draft</button></div></article>)}</div>}<div className="section-heading"><div><div className="eyebrow">CONFIRMED FINDINGS</div><h2>The evidence so far.</h2></div><button className="button button-dark" disabled={busy || voiceActive || !latest.length} onClick={makeReport}>Create report</button></div>
      {report && <p className="feedback">Download report: <a download href={`/api/reports/${report.id}/pdf`}>Annotated PDF</a> · <a download href={`/api/reports/${report.id}/json`}>Full JSON record</a></p>}
      {!latest.length && <p className="empty-note">No confirmed findings for this drawing yet. Review and confirm an observation above.</p>}
      {latest.map(f => <article className="finding-card" key={f.id}><div className="finding-title"><button className="text-link" disabled={busy || voiceActive} onClick={() => choose(document.references.find(r => r.id === f.referenceId))}>{f.reference.label} · sheet {f.reference.page} ↗</button><span className="outline-badge">{f.status}</span></div><p>{f.observation}</p><small>Confirmed {new Date(f.confirmedAt).toLocaleString()}</small><div className="finding-actions"><button className="text-link" disabled={busy || voiceActive} onClick={() => amend(f)}>Amend observation</button><label>Status <select aria-label={`Status for ${f.reference.label}`} value={f.status} disabled={busy || voiceActive} onChange={e => { const status=e.target.value; work(async () => { await apiRequest(`/inspections/${f.id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({status}) }); await loadFindings(documentId); }); }}>{['open','reviewed','resolved'].map(s => <option key={s}>{s}</option>)}</select></label></div>{f.supersedes && <details><summary>Earlier observation</summary>{findings.filter(old => old.id === f.supersedes).map(old => <p key={old.id}>{old.observation}</p>)}</details>}</article>)}
      </section></>}
  </section>;
}
