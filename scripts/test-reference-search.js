import assert from 'node:assert/strict';
import {createReferenceService} from '../server/learning/references.js';
// Only a public component name is sent; no PDF or user data is used.
const result=await createReferenceService().search({part:'LM555',kind:'datasheet'});
assert.ok(result.results.length,'No search results returned.');
assert.ok(result.results.some(r=>r.sourceType==='manufacturer'),'Expected a manufacturer-domain reference.');
console.log(JSON.stringify({provider:'SerpApi',query:result.part,results:result.results.length,manufacturerDomains:result.results.filter(r=>r.sourceType==='manufacturer').map(r=>r.host)}));
