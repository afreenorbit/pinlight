// Stable, storage-safe owner keys. Existing Supabase accounts keep their UUIDs.
export function auth0OwnerKey(issuer,subject){
 if(!/^https:\/\/[a-z0-9.-]+\/$/i.test(issuer)||typeof subject!=='string'||!subject||subject.length>255)throw Error('Invalid account identity.');
 return `auth0-${Array.from(new TextEncoder().encode(`${issuer}|${subject}`),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
export function safeReturnPath(path,fallback='/desk'){
 return typeof path==='string'&&/^\/(?!\/)/.test(path)&&!/[\\\r\n]/.test(path)?path:fallback;
}
