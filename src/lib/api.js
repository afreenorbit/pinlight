// Locally Vite proxies /api to the Node server. A deployed site sets VITE_API_URL (e.g. https://api.afreenorbit.tech).
export const apiBase = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api`;
const unavailable = import.meta.env.VITE_API_URL ? 'The Pinlight API is waking up or unavailable. Try again in a moment.' : 'The local API is unavailable. Start npm run dev:api and try again.';

export async function apiRequest(path, options = {}) {
  let response;
  try { response = await fetch(`${apiBase}${path}`, options); } catch { throw new Error(unavailable); }
  let result;
  try { result = await response.json(); } catch { throw new Error(unavailable); }
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

export const post = (path, data) => apiRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
