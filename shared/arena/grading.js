// Scores for a spoken explanation. Accuracy and clarity are 0–10; a model grader fills them in
// when available, and this keyword check is the fallback (and the bots' answers were graded
// in advance). Points: accuracy carries most weight, clarity some, and a little for speed.
export const ROUND_SECONDS = 60, ROUNDS = 4;

const norm = text => ` ${String(text).toLowerCase().replace(/[’']/g, '’').replace(/\s+/g, ' ')} `;
export function keywordGrade(concept, text) {
  const said = norm(text), words = String(text).trim().split(/\s+/).filter(Boolean).length;
  if (!words) return { accuracy: 0, clarity: 0, covered: [], feedback: 'No answer was given.', graded: 'rules' };
  const covered = concept.points.filter(p => p.keywords.some(k => said.includes(k.toLowerCase()))).map(p => p.id);
  const accuracy = Math.round((covered.length / concept.points.length) * 10);
  const clarity = words < 6 ? 2 : words < 15 ? 5 : words <= 160 ? 7 : 5;
  const missed = concept.points.filter(p => !covered.includes(p.id));
  return { accuracy, clarity, covered, feedback: missed.length ? `Also mention: ${missed[0].text.toLowerCase()}.` : 'You covered every key point.', graded: 'rules' };
}

export function roundPoints({ accuracy, clarity }, ms, limitSeconds = ROUND_SECONDS) {
  const speed = accuracy >= 5 ? Math.round(10 * Math.max(0, 1 - ms / (limitSeconds * 1000))) : 0;
  // Clarity only counts as far as the answer is right: a clear but wrong answer earns little.
  return accuracy * 10 + Math.round(clarity * 4 * Math.min(1, accuracy / 5)) + speed;
}

// Dictating "… that's my answer" or "submit" ends the round hands-free.
const DONE = /[\s,;:-]*\b(submit( my answer)?|that'?s my answer|that is my answer|final answer|next question|done answering)[.!]?\s*$/i;
export const spokenSubmit = text => DONE.test(text) ? text.replace(DONE, '').trim() : null;
