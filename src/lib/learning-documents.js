import {apiRequest,post} from './api.js';
import {pdfLink,getLearningArtifact} from './desk.js';

export async function importLearningPdf(file,name=file.name||'datasheet.pdf'){
 if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB.');
 const imported=await apiRequest(`/documents?name=${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});
 const resolved=await post('/learning/resolve',{documentId:imported.document.id});
 return {id:resolved.documentId,title:resolved.title,revision:resolved.revision,status:resolved.status,matches:resolved.matches,kind:resolved.kind};
}
export async function restoreLearningDocument(item){
 const rows=await apiRequest('/learning/documents');
 const existing=rows.find(d=>d.id===item.local_document_id);
 let cached=null;try{cached=await getLearningArtifact(item.id);}catch{}
 if(existing)return {...existing,cachedJourney:cached?.document_revision===existing.revision?cached.journey:null};
 if(!item.file_path)throw Error('The original PDF is unavailable on this server. Upload it again to restore the source.');
 const response=await fetch(await pdfLink(item));if(!response.ok)throw Error('The saved PDF could not be restored.');
 const doc=await importLearningPdf(await response.blob(),item.title);
 return {...doc,cachedJourney:cached?.document_revision===doc.revision?cached.journey:null};
}
