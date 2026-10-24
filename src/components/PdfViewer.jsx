import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer({ document, pageNumber, onPage, selected, onSelect, onPin, annotation, findings = [] }) {
  const canvas = useRef(null), pdfRef = useRef(null), viewportRef = useRef(null), selectedEl = useRef(null);
  const scroll = useRef(null), pageElement = useRef(null), viewerRoot=useRef(null);
  const [loaded, setLoaded] = useState(0), [error, setError] = useState(''), [rendering, setRendering] = useState(true);
  const [zoom, setZoom] = useState(100), [pinning, setPinning] = useState(false);
  useEffect(() => {
    setError(''); setRendering(true); setLoaded(0);
    const task = getDocument({ url: `/api/documents/${document.id}/file`, isEvalSupported: false });
    let active = true;
    task.promise.then(pdf => { if (active) { pdfRef.current = pdf; setLoaded(n => n + 1); } }).catch(() => { if (active) setError('The PDF could not be displayed. Check the API connection.'); });
    return () => { active = false; pdfRef.current = null; task.destroy(); };
  }, [document.id]);
  useEffect(() => {
    if (!loaded || !pdfRef.current) return;
    let active = true, task;
    setRendering(true);
    pdfRef.current.getPage(pageNumber).then(page => {
      if (!active) return;
      const viewport = page.getViewport({ scale: 1 });
      viewportRef.current = viewport;
      const renderViewport = page.getViewport({ scale: Math.min(2, 1400 / viewport.width) });
      const el = canvas.current;
      el.width = renderViewport.width; el.height = renderViewport.height;
      task = page.render({ canvasContext: el.getContext('2d'), viewport: renderViewport });
      return task.promise;
    }).then(() => { if (active) setRendering(false); }).catch(e => { if (active && e.name !== 'RenderingCancelledException') setError('This page could not be rendered.'); });
    return () => { active = false; task?.cancel(); };
  }, [loaded, pageNumber, document.id]);
  useEffect(() => { if(annotation?.id) {setZoom(value=>Math.max(value,200));viewerRoot.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});} },[annotation?.id]);
  useEffect(() => {
    if(rendering || !selected || selected.page!==pageNumber || !scroll.current || !pageElement.current)return;
    const container=scroll.current, sheet=pageElement.current;
    const x=(selected.bounds.x+selected.bounds.width/2)*sheet.offsetWidth;
    const y=(selected.bounds.y+selected.bounds.height/2)*sheet.offsetHeight;
    container.scrollTo({left:Math.max(0,x-container.clientWidth/2+15),top:Math.max(0,y-container.clientHeight/2+15),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  },[selected?.id,annotation?.id,rendering,zoom,pageNumber]);
  const focus = selected?.page===pageNumber ? selected : null;
  const bounds=focus?.bounds;
  const x=bounds?(bounds.x+bounds.width/2)*1000:0,y=bounds?(bounds.y+bounds.height/2)*1000:0;
  const rx=bounds?Math.max(bounds.width*500+10,20):20,ry=bounds?Math.max(bounds.height*500+8,16):16;
  const labelWidth=Math.max(172,Math.min(460,(focus?.label.length||0)*10+100));
  const labelX=Math.max(8,Math.min(992-labelWidth,x+28)),labelY=Math.max(8,Math.min(950,y-62));
  const recorded=[...new Map(findings.filter(f=>!findings.some(next=>next.supersedes===f.id)).map(f=>[f.referenceId,f])).values()];

  const pin = event => {
    if (!pinning || !viewportRef.current || rendering) return;
    const box = event.currentTarget.getBoundingClientRect(), viewport = viewportRef.current;
    const bounds = { x: Math.max(0, Math.min(.97, (event.clientX - box.left) / box.width - .015)), y: Math.max(0, Math.min(.98, (event.clientY - box.top) / box.height - .01)), width: .03, height: .02 };
    const a = viewport.convertToPdfPoint(bounds.x * viewport.width, bounds.y * viewport.height);
    const b = viewport.convertToPdfPoint((bounds.x + bounds.width) * viewport.width, (bounds.y + bounds.height) * viewport.height);
    onPin({ page: pageNumber, bounds, pdfBounds: { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(a[0] - b[0]), height: Math.abs(a[1] - b[1]) } });
    setPinning(false);
  };
  return <div className="pdf-viewer" ref={viewerRoot}>
    <div className="pdf-toolbar"><button aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => onPage(pageNumber - 1)}>←</button><span>Sheet {pageNumber} / {document.pages.length}</span><button aria-label="Next page" disabled={pageNumber >= document.pages.length} onClick={() => onPage(pageNumber + 1)}>→</button><label>Zoom <select aria-label="Drawing zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[100,150,200,300].map(v => <option key={v} value={v}>{v}%</option>)}</select></label><button aria-pressed={pinning} onClick={() => setPinning(!pinning)}>{pinning ? 'Cancel pin' : 'Pin a reference'}</button></div>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <div className="pdf-scroll" ref={scroll}><div ref={pageElement} className={`pdf-page ${pinning ? 'pinning' : ''}`} style={{ width: `${zoom}%` }} onClick={pin}>
      <canvas ref={canvas} aria-label={`${document.title}, sheet ${pageNumber}`} />
      {!rendering && document.references.filter(r => r.page === pageNumber).map(r => <button key={r.id} ref={selected?.id === r.id ? selectedEl : null} className={`reference-hit ${selected?.id === r.id ? 'selected' : ''}`} aria-label={`Select ${r.label}, sheet ${r.page}`} aria-pressed={selected?.id === r.id} title={`${r.label}${r.manual ? ' · manually pinned' : ''}`} style={{ left: `${r.bounds.x * 100}%`, top: `${r.bounds.y * 100}%`, width: `${r.bounds.width * 100}%`, height: `${r.bounds.height * 100}%` }} onClick={e => { if (!pinning) { e.stopPropagation(); onSelect(r); } }} />)}
      {!rendering && recorded.map(f=>{const r=document.references.find(r=>r.id===f.referenceId);return r?.page===pageNumber?<button className="finding-source-marker" key={f.id} aria-label={`Show confirmed finding at ${r.label}`} title={`Confirmed finding · ${r.label}`} style={{left:`${(r.bounds.x+r.bounds.width)*100}%`,top:`${r.bounds.y*100}%`}} onClick={e=>{e.stopPropagation();if(!pinning)onSelect(r);}}>✓</button>:null;})}
      {!rendering && focus && <svg key={annotation?.id||focus.id} className="source-annotation" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={`${annotation?.shape||'circle'} annotation at ${focus.label}, sheet ${pageNumber}`}>
        {annotation?.shape==='underline'?<path className="annotation-stroke" pathLength="1" d={`M ${x-rx} ${y+ry} L ${x+rx} ${y+ry}`}/>:annotation?.shape==='box'?<rect className="annotation-stroke" pathLength="1" x={x-rx} y={y-ry} width={rx*2} height={ry*2} rx="4"/>:<ellipse className="annotation-stroke" pathLength="1" cx={x} cy={y} rx={rx} ry={ry}/>}
        <path className="annotation-leader" d={`M ${x+rx*.7} ${y-ry*.7} L ${labelX} ${labelY+28}`}/><rect className="annotation-label-bg" x={labelX} y={labelY} width={labelWidth} height="34" rx="5"/><text x={labelX+10} y={labelY+22} textLength={labelWidth-20} lengthAdjust="spacingAndGlyphs" className="annotation-label">{focus.label.length>32?`${focus.label.slice(0,29)}…`:focus.label} · source</text>
      </svg>}
      {!rendering && focus && annotation?.note && <div className="sheet-annotation-note" style={{left:`${Math.max(1,Math.min(75,(bounds.x+bounds.width)*100+3))}%`,top:`${Math.max(1,Math.min(87,(bounds.y+bounds.height)*100+3))}%`}}><strong>{focus.label} · {annotation.confirmed ? 'saved finding' : 'preview note'}</strong><span>{annotation.note.length>220?`${annotation.note.slice(0,217)}…`:annotation.note}</span><small>{annotation.confirmed ? 'Confirmed · saved in the inspection record' : 'Preview · confirm an observation to save it'}</small></div>}
    </div></div>
    <div className="pdf-caption" role="status">{rendering ? 'Rendering source drawing…' : pinning ? 'Click a location in the drawing, then give it a label.' : selected ? `Source marked: ${selected.label} · sheet ${selected.page} · revision ${document.revision}` : 'Select a label in the drawing or ask the assistant to mark a reference.'}</div>
  </div>;
}
