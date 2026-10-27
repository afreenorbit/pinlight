import Icon from '../components/Icon.jsx';
import SavedWork from '../review/SavedWork.jsx';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { listItems, deleteItem, deleteChat, pdfLink, kindLabels } from '../lib/desk.js';

const when = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Desk() {
  const { user, ready, configured } = useAuth();
  const [items, setItems] = useState(null), [error, setError] = useState('');
  const load = () => listItems().then(setItems).catch(e => setError(e.message));
  useEffect(() => { if (user) {load();} }, [user]);
  if (!ready) return <section className="section-wrap app-page"><p role="status">Opening your desk…</p></section>;
  if (!user) return <section className="section-wrap auth-page"><div className="auth-card"><div className="eyebrow">MY DESK</div><h1>Your boards, chips and chats live here.</h1><p>{configured ? 'Sign in to see everything you have uploaded and every conversation about it.' : 'Accounts are not connected on this copy yet.'}</p><div className="auth-actions">{configured && <a className="button button-dark" href="/signin"><>{"Sign in or sign up "}<Icon name="diagonal" size={16}/></></a>}<a className="button button-light" href="/learn">Try without an account</a></div></div></section>;
  const groups = Object.keys(kindLabels).map(kind => [kind, (items || []).filter(i => i.kind === kind)]).filter(([, rows]) => rows.length);
  const remove = async item => { if (!confirm(`Remove “${item.title}” and its chats from your desk?`)) return; try { await deleteItem(item); load(); } catch (e) { setError(e.message); } };
  const removeChat = async chat => { try { await deleteChat(chat.id); load(); } catch (e) { setError(e.message); } };
  const openPdf = async item => { try { open(await pdfLink(item), '_blank', 'noopener'); } catch (e) { setError(e.message); } };
  return <section className="section-wrap desk-page">
    <div className="desk-page-heading"><div><div className="eyebrow">MY DESK</div><h1>Everything you’re learning.</h1><p>Uploads are sorted into boards, chips, modules and other documents. Each one keeps its own chats.</p></div><div className="desk-heading-actions"><a className="button button-dark" href="/build"><Icon name="plus" size={16}/> New build</a><a className="button button-light" href="/learn"><>{"Open the learning desk "}<Icon name="diagonal" size={16}/></></a></div></div>
    {error && <p className="auth-note" role="alert">{error}</p>}
    <SavedWork/>
    {!items ? <p role="status">Loading…</p> : !items.length ? <div className="desk-empty"><h2>Nothing here yet.</h2><p>Your build reviews, viva sessions and uploaded PDFs save here automatically when you are signed in. Explore a build or start learning to get going.</p><a className="text-link" href="/learn"><>{"Start learning "}<Icon name="arrow" size={16}/></></a></div> :
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
