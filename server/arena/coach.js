import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

// Arena model calls: grading each spoken answer, and the end-of-match comparison.
// Groq is the provider for now. To move to Claude later, swap ARENA_MODEL for an
// `anthropic/<model>` id and set ANTHROPIC_API_KEY.
const ARENA_MODEL = env => `groq/${env.GROQ_REVIEW_MODEL || 'openai/gpt-oss-20b'}`;
const configured = env => !!env.GROQ_API_KEY;

const gradeSchema = z.object({
  accuracy: z.number().int().min(0).max(10),
  clarity: z.number().int().min(0).max(10),
  covered: z.array(z.string()).max(8),
  feedback: z.string().max(300),
});

// Grades one transcript against the concept's fixed key points. The model only decides which
// listed points were covered and how clearly; it cannot add new criteria.
export function createGrader(env = process.env) {
  if (!configured(env)) return null;
  const agent = new Agent({
    id: 'arena-grader', name: 'Arena grader', model: ARENA_MODEL(env),
    instructions: 'You grade a student’s spoken explanation of an electronics concept. The transcript came from dictation, so ignore filler words, repetition and small transcription errors. covered: the ids of the supplied key points the answer correctly states, in any wording. accuracy 0–10: correctness and coverage of the key points; any wrong claim lowers it; an empty or off-topic answer is 0. clarity 0–10: how clearly and logically it is explained, independent of correctness. feedback: one encouraging sentence naming the most important thing to add or fix. Use only the supplied key points and model answer as the standard.',
  });
  return async (concept, transcript) => {
    const response = await agent.generate(JSON.stringify({ question: concept.prompt, keyPoints: concept.points.map(({ id, text }) => ({ id, text })), modelAnswer: concept.reference, transcript }), { structuredOutput: { schema: gradeSchema, jsonPromptInjection: true }, maxSteps: 1, modelSettings: { temperature: 0, maxOutputTokens: 1600 }, abortSignal: AbortSignal.timeout(25000) });
    const grade = gradeSchema.parse(response.object), ids = new Set(concept.points.map(p => p.id));
    return { ...grade, covered: [...new Set(grade.covered.filter(id => ids.has(id)))], graded: 'ai' };
  };
}

export function createCoach(env = process.env) {
  if (!configured(env)) return null;
  const agent = new Agent({
    id: 'arena-coach', name: 'Arena coach', model: ARENA_MODEL(env),
    instructions: 'You are a friendly electronics coach summarising a voice battle where players explained concepts out loud. Use only the supplied rounds, grades, transcripts and model answers. Say who won, who was more accurate overall and who explained more clearly, citing one concrete moment for each. Then give each human player one specific thing to practise. Bots are rule-based opponents; do not coach them. Plain text, at most 120 words, no lists, no markdown.',
  });
  return async summary => {
    const response = await agent.generate(JSON.stringify(summary), { maxSteps: 1, modelSettings: { temperature: .4, maxOutputTokens: 1800 }, abortSignal: AbortSignal.timeout(25000) });
    const text = response.text?.trim();
    return text ? text.slice(0, 1200) : null;
  };
}
