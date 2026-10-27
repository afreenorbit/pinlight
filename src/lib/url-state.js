// Record ids, chat ids, room codes and similar handles never stay in the address bar. A link
// may still carry one (an Arena invite has to), but on arrival it moves into session storage
// for that page and the address is cleaned. Pages read it back with pageParam(), so a reload
// of the same tab still reopens the same build, chat or room.
const PRIVATE = ['saved', 'item', 'chat', 'room', 'concept', 'document'];
const KEY = 'pinlight-page-params';

const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = all => { try { sessionStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: the page just opens fresh after a reload */ } };
const pathOf = path => path.replace(/\/$/, '') || '/';

// Returns the address to show. `fresh` (a followed link) replaces what the page had stashed;
// otherwise (reload, back button) an address without handles keeps the stash.
export function hideParams(href, { fresh = false } = {}) {
  const url = new URL(href, location.href), path = pathOf(url.pathname), all = read(), found = {};
  for (const name of PRIVATE) if (url.searchParams.has(name)) { found[name] = url.searchParams.get(name); url.searchParams.delete(name); }
  if (fresh || Object.keys(found).length) { all[path] = found; write(all); }
  return url.pathname + url.search;
}

export const pageParam = name => new URLSearchParams(location.search).get(name) ?? read()[pathOf(location.pathname)]?.[name] ?? null;

// Remembers (or with null, forgets) a handle for the current page without touching the address.
export function setPageParam(name, value) {
  const all = read(), path = pathOf(location.pathname), page = { ...all[path] };
  if (value == null) delete page[name]; else page[name] = String(value);
  all[path] = page; write(all);
}
