export async function apiRequest(path, options = {}) {
  let response;
  try { response = await fetch(`/api${path}`, options); } catch { throw new Error('The local API is unavailable. Start npm run dev:api and try again.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('The local API is unavailable. Start npm run dev:api and try again.'); }
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

export const post = (path, data) => apiRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
