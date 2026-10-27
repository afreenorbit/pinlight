export function buildAction(text){
 const value=text.toLowerCase().replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
 if(/\b(don t|dont|do not|donot|cancel|never|not|stop)\b/.test(value))return null;
 if(/\b(practi[cs]e|viva|quiz|battle|arena|game)\b/.test(value))return 'practice';
 const command=value.replace(/\b(okay|ok|please|now)\b/g,'').replace(/\s+/g,' ').trim();
 if(/^(send|publish|post)( (this|it|the|my|post|question|draft))*$/.test(command))return 'send';
 if(/\b(community|post|draft|preview)\b/.test(value))return 'draft';
 return null;
}
export function communityDraft(result){
 const narrative=result.narrative||{idea:result.input.goal,owned:'Not specified',suggested:'Not specified'};
 const missing=(result.possibilities||[]).filter(p=>p.relation==='required').map(p=>p.name).join(', ')||'Please help me identify any remaining requirements.';
 return {
  title:`Review my build: ${narrative.idea}`.slice(0,160),
  question:[`I’m building: ${narrative.idea}`,`Parts I have: ${narrative.owned||'Not specified'}`,`AI’s suggested list: ${narrative.suggested||'Not specified'}`,`Still needed: ${missing}`,`Review summary: ${result.summary}`,`What I need help with: ${(result.questions||[]).join(' ')||'Are the parts suitable, what fails without missing parts, and which alternatives should I check?'}`].join('\n\n').slice(0,2400),
  project:{input:result.input,narrative,summary:result.summary,createdAt:result.createdAt},
 };
}
