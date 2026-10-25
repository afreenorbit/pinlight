import {createRemoteJWKSet,jwtVerify} from 'jose';
import {auth0OwnerKey} from '../../shared/identity.js';

export function createAuth0Verifier({env=process.env,verify}={}){
 const domain=env.AUTH0_DOMAIN,audience=env.AUTH0_AUDIENCE;
 if(domain&&!/^[a-z0-9.-]+$/i.test(domain))throw Error('Invalid Auth0 domain configuration.');
 const issuer=domain?`https://${domain}/`:null,configured=!!(issuer&&audience);
 const jwks=configured&&!verify?createRemoteJWKSet(new URL('.well-known/jwks.json',issuer)):null;
 return {status:()=>({configured,provider:'auth0'}),async authenticate(header){
  if(!header)return null;
  if(!configured)throw Object.assign(Error('Token verification is not configured.'),{status:503});
  const match=typeof header==='string'&&header.length<=16000&&header.match(/^Bearer ([^\s]+)$/i);
  if(!match)throw Object.assign(Error('Sign in again to continue.'),{status:401});
  try{const {payload}=await(verify?verify(match[1],{issuer,audience,algorithms:['RS256']}):jwtVerify(match[1],jwks,{issuer,audience,algorithms:['RS256'],clockTolerance:5}));if(typeof payload.sub!=='string'||payload.iss!==issuer)throw Error('Invalid subject');return {subject:payload.sub,issuer,ownerKey:auth0OwnerKey(issuer,payload.sub)};}catch{throw Object.assign(Error('Your sign-in token is invalid or expired. Sign in again.'),{status:401});}
 }};
}
