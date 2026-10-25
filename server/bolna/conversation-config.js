export function buildConversationConfig({name,welcome,instructions,keywords}) {
  const englishVoice = { provider: 'elevenlabs', provider_config: { voice: 'Angelica', voice_id: 'IkSv4tkouLJ6kYsQA7XD', model: 'eleven_turbo_v2_5' }, stream: true, buffer_size: 250, audio_format: 'wav' };
  const hindiVoice = { provider: 'sarvam', provider_config: { voice: 'Suhani', voice_id: 'suhani', model: 'bulbul:v3', language: 'hi' }, stream: true, buffer_size: 250, audio_format: 'wav' };
  return {
    agent_config: {
      agent_name: name,
      agent_welcome_message: welcome,
      call_summary_enabled: true,
      tasks: [{ task_type: 'conversation',
        toolchain: { execution: 'sequential', pipelines: [['transcriber', 'llm', 'synthesizer']] },
        tools_config: {
          llm_agent: { agent_type: 'simple_llm_agent', agent_flow_type: 'streaming', llm_config: { provider: 'openai', model: 'gpt-4.1-mini', max_tokens: 220, temperature: 0.2 } },
          synthesizer: englishVoice,
          transcriber: { provider: 'deepgram', model: 'nova-3', language: 'en', stream: true, encoding: 'linear16', sampling_rate: 16000, endpointing: 400, keywords },
          input: { provider: 'freeswitch', format: 'linear16' },
          output: { provider: 'freeswitch', format: 'linear16' },
          multilingual_config: { enabled: true, active_language: 'en', language_switch_trigger: 'caller_requested', languages: {
            en: { synthesizer: englishVoice, system_prompt: instructions, agent_name: name },
            hi: { transcriber: { provider: 'deepgram', model: 'nova-3', language: 'hi' }, synthesizer: hindiVoice,
              system_prompt: `${instructions}\nहिंदी में संक्षेप में उत्तर दें। रेफ़रेंस लेबल, संख्याएँ और इकाइयाँ ठीक वैसे ही रखें। बिना जाँच के कोई निष्कर्ष न निकालें।`, handoff_message: 'ठीक है, अब हम हिंदी में बात करेंगे।', agent_name: name },
          } },
        },
        task_config: { call_terminate: 180, hangup_after_silence: 25, check_if_user_online: true, trigger_user_online_message_after: 12, number_of_words_for_interruption: 2 },
      }],
    },
    agent_prompts: { task_1: { system_prompt: instructions } },
  };
}
