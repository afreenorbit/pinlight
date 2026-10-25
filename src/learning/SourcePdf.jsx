import Icon from '../components/Icon.jsx';
import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {apiBase,apiHeaders} from '../lib/api.js';
GlobalWorkerOptions.workerSrc=workerUrl;

export default function SourcePdf({documentId,page,onPage}){
 const canvas=useRef(null),pdfRef=useRef(null),[loaded,setLoaded]=useState(0),[pageCount,setPageCount]=useState(0),[error,setError]=useState(''),[rendering,setRendering]=useState(true);
 useEffect(()=>{let alive=true,task;setError('');setPageCount(0);(async()=>{const headers=await apiHeaders();if(!alive)return;task=getDocument({url:`${apiBase}/documents/${documentId}/file`,httpHeaders:Object.fromEntries(headers),isEvalSupported:false});const pdf=await task.promise;if(alive){pdfRef.current=pdf;setPageCount(pdf.numPages);setLoaded(n=>n+1);}})().catch(()=>{if(alive)setError('The source PDF could not be opened. Use the full-PDF link or sign in again.');});return()=>{alive=false;pdfRef.current=null;task?.destroy();};},[documentId]);
 useEffect(()=>{if(!loaded||!pdfRef.current)return;let alive=true,render;setRendering(true);setError('');pdfRef.current.getPage(page).then(p=>{if(!alive)return;const base=p.getViewport({scale:1}),viewport=p.getViewport({scale:Math.min(2,1300/base.width)});canvas.current.width=viewport.width;canvas.current.height=viewport.height;render=p.render({canvasContext:canvas.current.getContext('2d'),viewport});return render.promise;}).then(()=>{if(alive)setRendering(false);}).catch(e=>{if(alive&&e.name!=='RenderingCancelledException')setError('This source page could not be rendered.');});return()=>{alive=false;render?.cancel();};},[loaded,page,documentId]);
 return <div className="journey-pdf"><div className="journey-pdf-controls"><button aria-label="Previous source page" disabled={page<=1} onClick={()=>onPage(page-1)}><><Icon name="left" size={16}/></></button><span>Page {page} / {pageCount||'…'}</span><button aria-label="Next source page" disabled={!pageCount||page>=pageCount} onClick={()=>onPage(page+1)}><><Icon name="arrow" size={16}/></></button></div>{error?<p role="alert">{error}</p>:rendering&&<p role="status">Rendering source page…</p>}<canvas ref={canvas} aria-label={`Original PDF, page ${page}`}/></div>;
}
