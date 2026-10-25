import Icon from '../components/Icon.jsx';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/auth.jsx';
import {importLearningPdf} from '../lib/learning-documents.js';
import {apiRequest} from '../lib/api.js';
import {ensureItem,uploadItemPdf} from '../lib/desk.js';
import { listItems, deleteItem, deleteChat, pdfLink, kindLabels } from '../lib/desk.js';

const when = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Desk() {
  const { user, ready, configured } = useAuth();
  const uploadInput=useRef(null);
  const [uploading,setUploading]=useState(false),[pdfs,setPdfs]=useState([]),[uploadNote,setUploadNote]=useState('');
  const [items, setItems] = useState(null), [error, setError] = useState('');
  const load = () => listItems().then(setItems).catch(e => setError(e.message));
  useEffect(() => { if (user) {load();apiRequest('/learning/documents').then(setPdfs).catch(()=>{});} }, [user]);
  const upload=async event=>{const file=event.target.files?.[0];if(!file)return;setUploading(true);setError('');setUploadNote('Reading your PDF…');try{const doc=await importLearningPdf(file),row=await ensureItem({slug:`doc:${doc.revision}`,kind:doc.kind||'other',title:doc.title,localDocumentId:doc.id,boardId:doc.status==='supported'?doc.matches[0].boardId:null});await uploadItemPdf(row,file);await load();setPdfs(await apiRequest('/learning/documents'));setUploadNote('PDF saved. Open its item below to continue the journey.');}catch(e){setError(e.message);setUploadNote('');}finally{setUploading(false);event.target.value='';}};
  if (!ready) return <section className="section-wrap app-page"><p role="status">Opening your desk…</p></section>;
  if (!user) return <section className="section-wrap auth-page"><div className="auth-card"><div className="eyebrow">MY DESK</div><h1>Your boards, chips and chats live here.</h1><p>{configured ? 'Sign in to see everything you have uploaded and every conversation about it.' : 'Accounts are not connected on this copy yet.'}</p><div className="auth-actions">{configured && <a className="button button-dark" href="/signin"><>{"Sign in or sign up "}<Icon name="diagonal" size={16}/></></a>}<a className="button button-light" href="/learn">Try without an account</a></div></div></section>;
  const groups = Object.keys(kindLabels).map(kind => [kind, (items || []).filter(i => i.kind === kind)]).filter(([, rows]) => rows.length);
  const remove = async item => { if (!confirm(`Remove “${item.title}” and its chats from your desk?`)) return; try { await deleteItem(item); load(); } catch (e) { setError(e.message); } };
  const removeChat = async chat => { try { await deleteChat(chat.id); load(); } catch (e) { setError(e.message); } };
  const openPdf = async item => { try { open(await pdfLink(item), '_blank', 'noopener'); } catch (e) { setError(e.message); } };
  return <section className="section-wrap desk-page">
    <div className="desk-page-heading"><div><div className="eyebrow">MY DESK</div><h1>Everything you’re learning.</h1><p>Uploads are sorted into boards, chips, modules and other documents. Each one keeps its own chats.</p></div><a className="button button-dark" href="/learn"><>{"Open the learning desk "}<Icon name="diagonal" size={16}/></></a></div>
    <details className="desk-pdf-tools"><summary><Icon name="file" size={16}/> PDF tools <Icon name="down" size={14}/></summary><div><input ref={uploadInput} type="file" accept="application/pdf,.pdf" hidden onChange={upload}/><button className="text-link" disabled={uploading} onClick={()=>uploadInput.current.click()}><Icon name="upload" size={16}/>{uploading?'Reading PDF…':'Upload a datasheet'}</button><select aria-label="Your PDF journeys" value="" onChange={e=>{if(e.target.value)location.assign(`/learn?document=${e.target.value}`);}}><option value="">Your PDF journeys</option>{pdfs.map(doc=><option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></div></details>
    {uploadNote&&<p className="command-help" role="status">{uploadNote}</p>}
    {error && <p className="auth-note" role="alert">{error}</p>}
    {!items ? <p role="status">Loading…</p> : !items.length ? <div className="desk-empty"><h2>Nothing here yet.</h2><p>Use PDF tools above to upload a document, or open the learning desk and ask about a board. It will appear here automatically.</p><a className="text-link" href="/learn"><>{"Start learning "}<Icon name="arrow" size={16}/></></a></div> :
      groups.map(([kind, rows]) => <div className="desk-group" key={kind}>
        <div className="desk-group-heading"><span className="eyebrow">{kindLabels[kind].toUpperCase()}</span><span>{rows.length}</span></div>
        <div className="desk-items">{rows.map(item => <article className="desk-item" key={item.id}>
          <div className="desk-item-top"><span className={`desk-kind kind-${item.kind}`}>{item.kind}</span><small>Updated {when(item.updated_at)}</small></div>
          <h3>{item.title}</h3>
          <div className="desk-item-actions"><a className="button button-dark" href={`/learn?item=${item.id}`}><>{"Continue "}<Icon name="diagonal" size={16}/></></a>{item.file_path && <button className="button button-light" onClick={() => openPdf(item)}>PDF</button>}<button className="desk-remove" onClick={() => remove(item)} aria-label={`Remove ${item.title}`}>Remove</button></div>
          <div className="desk-chats"><strong>Chats</strong>{item.chats?.length ? [...item.chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(chat => <div key={chat.id} className="desk-chat"><a href={`/learn?item=${item.id}&chat=${chat.id}`}>{chat.title}</a><small>{when(chat.updated_at)}</small><button onClick={() => removeChat(chat)} aria-label={`Delete chat ${chat.title}`}><><Icon name="close" size={16}/></></button></div>) : <small>No chats yet.</small>}</div>
        </article>)}</div>
      </div>)}
  </section>;
}
