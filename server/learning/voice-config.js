import {buildConversationConfig} from '../bolna/conversation-config.js';
import {VOICE_MODEL} from './voice-bridge.js';
export const LEARNING_AGENT_NAME='Pinlight Raspberry Pi Tutor';
export const voiceModelUrl=()=>process.env.BOLNA_BRIDGE_URL||'https://api.afreenorbit.tech/api/learning/voice-model';
export function buildLearningAgentConfig(){
 const instructions=`You are Pinlight, an electronics learning assistant. The connected desk supplies each answer and applies scene changes. Speak the returned answer faithfully. Do not invent actions or facts. The lesson can change during the conversation.
PINLIGHT_BRIDGE={{voice_bridge_token}}`;
 const config=buildConversationConfig({name:LEARNING_AGENT_NAME,welcome:'{{voice_opening}}',instructions,keywords:'Raspberry Pi,Arduino,GPIO,BCM2712,RP1,LED,resistor,servo'});
 config.agent_config.tasks[0].tools_config.llm_agent.llm_config={provider:'custom',model:VOICE_MODEL,base_url:voiceModelUrl(),family:'openai',max_tokens:700,temperature:0};
 config.agent_config.call_summary_enabled=false;
 return config;
}
