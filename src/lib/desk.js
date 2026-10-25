import { supabase } from './supabase.js';

// Signed-in desk storage. RLS binds owner_key to the verified token issuer and subject.
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
async function ownerKey(){const key=check(await supabase.rpc('current_owner_key'));if(!key)throw Error('Cloud storage could not recognize this sign-in. Sign out and sign in again after completing the Auth0 integration.');return key;}

export const kindLabels = { board: 'Boards', chip: 'Chips', module: 'Modules', other: 'Other documents' };

export async function ensureItem({ slug, kind, title, boardId = null, localDocumentId = null }) {
  const owner=await ownerKey();
  return check(await supabase.from('learning_items')
    .upsert({ owner_key:owner,slug, kind, title, board_id: boardId, local_document_id: localDocumentId }, { onConflict: 'owner_key,slug',defaultToNull:false })
    .select().single());
}

export async function uploadItemPdf(item, file) {
  const owner=await ownerKey();
  const path = `${owner}/${item.id}.pdf`;
  check(await supabase.storage.from('documents').upload(path, file, { contentType: 'application/pdf', upsert: true }));
  return check(await supabase.from('learning_items').update({ file_path: path }).eq('id', item.id).select().single());
}

export async function pdfLink(item) {
  return check(await supabase.storage.from('documents').createSignedUrl(item.file_path, 600)).signedUrl;
}

export async function listItems() {
  return check(await supabase.from('learning_items').select('*, chats(id, title, updated_at)').order('updated_at', { ascending: false }));
}

export async function findItem(slug) {
  return check(await supabase.from('learning_items').select('*').eq('slug', slug).maybeSingle());
}

export async function getItem(id) {
  return check(await supabase.from('learning_items').select('*').eq('id', id).maybeSingle());
}

export async function deleteItem(item) {
  if (item.file_path) await supabase.storage.from('documents').remove([item.file_path]);
  check(await supabase.from('learning_items').delete().eq('id', item.id));
}

export async function listChats(itemId) {
  return check(await supabase.from('chats').select('id, title, updated_at').eq('item_id', itemId).order('updated_at', { ascending: false }));
}

export async function createChat(itemId, title) {
  return check(await supabase.from('chats').insert({ owner_key:await ownerKey(),item_id: itemId, title: title.slice(0, 120) || 'New chat' }).select().single());
}

export async function deleteChat(id) { check(await supabase.from('chats').delete().eq('id', id)); }

export async function listMessages(chatId) {
  return check(await supabase.from('messages').select('role, content, meta, created_at').eq('chat_id', chatId).order('created_at'));
}

export async function addMessages(chatId, messages) {
  const owner=await ownerKey();
  check(await supabase.from('messages').insert(messages.map(m => ({ owner_key:owner,chat_id: chatId, role: m.role, content: m.text.slice(0, 8000), meta: { engine: m.engine || null, sources: m.sources || [] } }))));
}

export async function saveLearningArtifact(itemId,journey,progress){
 return check(await supabase.from('learning_artifacts').upsert({owner_key:await ownerKey(),item_id:itemId,pipeline_version:journey.processing.version,document_revision:journey.revision,journey,progress,updated_at:new Date().toISOString()},{onConflict:'owner_key,item_id,pipeline_version',defaultToNull:false}).select('id').single());
}
export async function getLearningArtifact(itemId){
 return check(await supabase.from('learning_artifacts').select('*').eq('item_id',itemId).order('updated_at',{ascending:false}).limit(1).maybeSingle());
}
export async function saveLearningProgress(itemId,version,progress){
 check(await supabase.from('learning_artifacts').update({progress,updated_at:new Date().toISOString()}).eq('item_id',itemId).eq('pipeline_version',version));
}
