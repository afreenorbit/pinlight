import {auth0OwnerKey,safeReturnPath} from '../../shared/identity.js';

const domain=import.meta.env.VITE_AUTH0_DOMAIN,clientId=import.meta.env.VITE_AUTH0_CLIENT_ID;
export const auth0Enabled=import.meta.env.VITE_ACCOUNTS==='on'&&!!domain&&!!clientId;
export const auth0Issuer=domain?`https://${domain}/`:null;
let clientPromise,initialization;
export function authClient(){
 if(!auth0Enabled)throw Error('Auth0 is not configured.');
 return clientPromise||=(async()=>{const {Auth0Client}=await import('@auth0/auth0-spa-js');return new Auth0Client({domain,clientId,authorizationParams:{audience:import.meta.env.VITE_AUTH0_AUDIENCE,redirect_uri:`${location.origin}/signin`,scope:'openid profile email'},cacheLocation:'memory'});})();
}
export function initializeAuth(){
 return initialization||=(async()=>{const client=await authClient(),params=new URLSearchParams(location.search);
  if(location.pathname==='/signin'&&params.has('state')&&(params.has('code')||params.has('error'))){
   try{const {appState}=await client.handleRedirectCallback();history.replaceState(null,'',safeReturnPath(appState?.returnTo));dispatchEvent(new PopStateEvent('popstate'));}
   catch(error){history.replaceState(null,'','/signin');const code=/^[a-z_]{1,60}$/.test(error.error||'')?error.error:'callback_failed';const help={access_denied:'Check the Auth0 application connection and Login Actions.',invalid_request:'Authorize Pinlight’s user-delegated access to its API, and check the audience and callback URL in Auth0.',unauthorized_client:'Check that this application is a Single Page Application with Authorization Code enabled.',invalid_state:'The sign-in session expired. Start sign-in again.'};throw Error(`Auth0 sign-in failed (${code}). ${help[code]||'Please start sign-in again.'}`);}
  }else{try{await client.checkSession();}catch{/* A signed-out visitor can still explore. */}}
  return currentAuth0User();
 })();
}
export async function currentAuth0User(){
 const client=await authClient();if(!await client.isAuthenticated())return null;
 const user=await client.getUser();if(!user?.sub)return null;
 return {...user,id:auth0OwnerKey(auth0Issuer,user.sub),email:user.email||user.name||'Learner'};
}
export async function startAuth0Login({signup=false,returnTo='/desk'}={}){
 const client=await authClient();return client.loginWithRedirect({appState:{returnTo:safeReturnPath(returnTo)},authorizationParams:signup?{screen_hint:'signup'}:{}});
}
export async function endAuth0Session(){const client=await authClient();return client.logout({logoutParams:{returnTo:location.origin}});}
export async function apiAccessToken(){
 if(!auth0Enabled)return null;
 const client=await authClient();if(!await client.isAuthenticated())return null;
 return client.getTokenSilently();
}
export async function supabaseAccessToken(){
 const client=await authClient();if(!await client.isAuthenticated())return null;
 await client.getTokenSilently();
 const claims=await client.getIdTokenClaims();
 if(claims?.role!=='authenticated')throw Error('Finish the Auth0 Post Login Action and Supabase third-party provider setup to save your desk.');
 return claims.__raw;
}
