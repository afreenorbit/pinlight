import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createBolnaClient } from '../server/bolna/client.js';
import { AGENT_NAME, buildAgentConfig } from '../server/bolna/agent-config.js';

const api = createBolnaClient();
const account = await api('/user/me');
const agents = await api('/v2/agent/all');
let id = process.env.BOLNA_AGENT_ID?.trim();
const existing = agents.find(a => id ? a.id === id : a.agent_name === AGENT_NAME);
if (id && !existing) throw new Error('The configured agent does not belong to this account. Check BOLNA_AGENT_ID.');
if (existing && existing.agent_name !== AGENT_NAME) throw new Error('Refusing to overwrite an unrelated agent. Use a dedicated Tracepoint agent.');
if (existing) { id = existing.id; console.log('Reusing the existing Tracepoint agent; no duplicate created.'); }
else {
  const created = await api('/v2/agent', { method: 'POST', body: JSON.stringify(buildAgentConfig()) });
  if (!/^[a-f0-9-]{36}$/i.test(created.agent_id || '')) throw new Error('Bolna did not return a valid agent ID.');
  id = created.agent_id;
  console.log('Created the Tracepoint browser voice agent.');
}
const env = await readFile('.env', 'utf8');
await writeFile('.env', /^BOLNA_AGENT_ID=/m.test(env) ? env.replace(/^BOLNA_AGENT_ID=.*$/m, `BOLNA_AGENT_ID=${id}`) : `${env.trimEnd()}\nBOLNA_AGENT_ID=${id}\n`);
const details = await api(`/v2/agent/${id}`);
await mkdir('data', { recursive: true });
await writeFile('data/bolna-configuration.json', JSON.stringify({ agentId: id, name: details.agent_name, configuredAt: new Date().toISOString(), languages: ['en', 'hi'], maxDurationSeconds: 180, hasCredits: Number(account.wallet) > 0 }, null, 2));
console.log(JSON.stringify({ agentId: id, name: details.agent_name, state: details.agent_status, hasCredits: Number(account.wallet) > 0, languages: ['en', 'hi'] }));
