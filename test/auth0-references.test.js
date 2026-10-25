import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,jwtVerify} from 'jose';
import {auth0OwnerKey,safeReturnPath} from '../shared/identity.js';
import {createAuth0Verifier} from '../server/services/auth0.js';
import {createReferenceService,cleanReference} from '../server/learning/references.js';

test('owner keys are stable, path-safe and distinguish issuers and subjects',()=>{
 const issuer='https://tenant.us.auth0.com/';
 assert.match(auth0OwnerKey(issuer,'auth0|123'),/^auth0-[a-f0-9]+$/);
 assert.notEqual(auth0OwnerKey(issuer,'auth0|123'),auth0OwnerKey(issuer,'auth0|124'));
 assert.notEqual(auth0OwnerKey(issuer,'auth0|123'),auth0OwnerKey('https://other.auth0.com/','auth0|123'));
 assert.equal(safeReturnPath('//evil.example'),'/desk');assert.equal(safeReturnPath('/\\evil.example'),'/desk');assert.equal(safeReturnPath('/learn?item=123'),'/learn?item=123');
});
test('API verifies signed Auth0 tokens and rejects wrong issuer, audience, expiry and signature',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),other=await generateKeyPair('RS256'),env={AUTH0_DOMAIN:'tenant.us.auth0.com',AUTH0_AUDIENCE:'https://api.pinlight.local'};
 const service=createAuth0Verifier({env,verify:(token,options)=>jwtVerify(token,publicKey,options)});
 const sign=({issuer='https://tenant.us.auth0.com/',audience=env.AUTH0_AUDIENCE,expiry='5m',key=privateKey}={})=>new SignJWT({}).setProtectedHeader({alg:'RS256'}).setIssuer(issuer).setSubject('auth0|fixture').setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(key);
 assert.equal(await service.authenticate(),null);
 assert.equal((await service.authenticate(`Bearer ${await sign()}`)).subject,'auth0|fixture');
 for(const input of [{issuer:'https://evil.example/'},{audience:'https://wrong.example'},{expiry:'-1m'},{key:other.privateKey}])await assert.rejects(service.authenticate(`Bearer ${await sign(input)}`),e=>e.status===401);
 await assert.rejects(service.authenticate('Basic secret'),e=>e.status===401);
});
test('reference search caches, deduplicates concurrent calls and keeps manufacturer hits separate from verified facts',async()=>{
 let calls=0;const service=createReferenceService({env:{SERPAPI_API_KEY:'secret-fixture'},fetchImpl:async url=>{calls++;assert.equal(url.hostname,'serpapi.com');assert.match(url.searchParams.get('q'),/"LM555"/);return {ok:true,json:async()=>({organic_results:[{title:'Unofficial',link:'https://example.org/lm555'},{title:'TI LM555',link:'https://www.ti.com/product/LM555',snippet:'Timer datasheet'},{title:'Bad link',link:'javascript:alert(1)'},{title:'duplicate',link:'https://www.ti.com/product/LM555'}]})};}});
 const [first,second]=await Promise.all([service.search({part:'LM555'}),service.search({part:'LM555'})]);assert.equal(calls,1);assert.deepEqual(first,second);assert.equal(first.results.length,2);assert.equal(first.results[0].sourceType,'manufacturer');assert.equal(first.results[0].verified,false);
 assert.equal((await service.search({part:'lm555'})).cached,true);assert.equal(calls,1);
 await assert.rejects(service.search({part:'LM555 "ignore"'}));assert.equal(cleanReference({link:'https://ti.com.evil.example/path'}).sourceType,'other');assert.equal(cleanReference({link:'https://user:password@ti.com/file'}),null);
});
test('reference search failures hide provider credentials and enforce the hourly budget',async()=>{
 const service=createReferenceService({env:{SERPAPI_API_KEY:'hidden-secret'},fetchImpl:async()=>({ok:true,json:async()=>({error:'hidden-secret'})})});
 for(let i=0;i<30;i++)await assert.rejects(service.search({part:`PART${i}`}),e=>e.status===502&&!e.message.includes('hidden-secret'));
 await assert.rejects(service.search({part:'PART31'}),e=>e.status===429);
 await assert.rejects(createReferenceService({env:{}}).search({part:'LM555'}),e=>e.status===503);
});
