import { supabase } from './supabase.js';

// Signed-in desk storage. Every call relies on row-level security; user_id defaults to auth.uid().
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export const kindLabels = { board: 'Boards', chip: 'Chips', module: 'Modules', other: 'Other documents' };

export async function ensureItem({ slug, kind, title, boardId = null, localDocumentId = null }) {
  return check(await supabase.from('learning_items')
    .upsert({ slug, kind, title, board_id: boardId, local_document_id: localDocumentId }, { onConflict: 'user_id,slug' })
    .select().single());
}

export async function uploadItemPdf(item, file) {
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${user.id}/${item.id}.pdf`;
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
  return check(await supabase.from('chats').insert({ item_id: itemId, title: title.slice(0, 120) || 'New chat' }).select().single());
}

export async function deleteChat(id) { check(await supabase.from('chats').delete().eq('id', id)); }

export async function listMessages(chatId) {
  return check(await supabase.from('messages').select('role, content, meta, created_at').eq('chat_id', chatId).order('created_at'));
}

export async function addMessages(chatId, messages) {
  check(await supabase.from('messages').insert(messages.map(m => ({ chat_id: chatId, role: m.role, content: m.text.slice(0, 8000), meta: { engine: m.engine || null, sources: m.sources || [] } }))));
}
