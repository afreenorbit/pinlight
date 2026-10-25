// Locally Vite proxies /api to the Node server. A deployed site sets VITE_API_URL (e.g. https://api.afreenorbit.tech).
import {apiAccessToken} from './auth-client.js';
export const apiBase = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api`;
const unavailable = import.meta.env.VITE_API_URL ? 'The Pinlight API is waking up or unavailable. Try again in a moment.' : 'The local API is unavailable. Start npm run dev:api and try again.';

export async function apiHeaders(initial){const headers=new Headers(initial),token=await apiAccessToken();if(token)headers.set('Authorization',`Bearer ${token}`);return headers;}
async function apiFetch(path,options={}){
  let response;
  const headers=await apiHeaders(options.headers);
  try { response = await fetch(`${apiBase}${path}`, {...options,headers}); } catch { throw new Error(unavailable); }
  return response;
}
export async function apiRequest(path, options = {}) {
  const response=await apiFetch(path,options);
  let result;
  try { result = await response.json(); } catch { throw new Error(unavailable); }
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
export async function apiFile(path){const response=await apiFetch(path);if(!response.ok)throw Error('The source PDF could not be opened. Sign in again if needed.');return response.blob();}

export const post = (path, data) => apiRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
