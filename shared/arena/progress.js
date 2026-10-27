// Progress across Arena games, shared by the browser (guests) and the server (signed-in
// players). A match record holds one attempt per concept; everything else is derived from
// those attempts, so the same rules decide stats and personalised tests everywhere.
import { concepts, conceptById } from './concepts.js';

export const STRONG = 7, REVISE = 4, DUE_DAYS = 3, HISTORY_LIMIT = 100;
const DAY = 864e5;

// A finished room, seen by one player, becomes that player's match record.
export function matchRecord(state, kind = state.mode === 'practice' ? state.kind || 'practice' : 'battle') {
  const me = state.players.find(p => p.id === state.you), them = state.players.find(p => p.id !== state.you) || null;
  const attempts = state.results.map(r => {
    const a = r.answers[me.id];
    return a && { conceptId: r.id, accuracy: a.accuracy ?? 0, clarity: a.clarity ?? 0, points: a.points ?? 0, covered: a.covered || [], missed: r.points.map(p => p.id).filter(id => !(a.covered || []).includes(id)), ms: a.ms ?? 0 };
  }).filter(Boolean);
  const outcome = !them ? null : me.score === them.score ? 'draw' : me.score > them.score ? 'win' : 'loss';
  return { id: `${state.code}-${state.startAt}`, kind, mode: state.mode, opponent: them ? (them.bot ? `bot:${them.bot}` : them.name) : null, myScore: me.score, theirScore: them?.score ?? null, outcome, at: new Date(state.startAt || Date.now()).toISOString(), attempts };
}

// Recent answers count more: each older attempt weighs 60% of the one after it.
export function mastery(list) {
  let weight = 1, sum = 0, total = 0;
  for (const a of [...list].sort((x, y) => y.at.localeCompare(x.at))) { sum += a.accuracy * weight; total += weight; weight *= .6; }
  return total ? Math.round((sum / total) * 10) / 10 : null;
}
export const statusOf = value => value === null ? 'new' : value >= STRONG ? 'strong' : value >= REVISE ? 'improving' : 'revise';

export function computeStats(matches, now = Date.now()) {
  const attempts = matches.flatMap(m => m.attempts.map(a => ({ ...a, at: m.at, kind: m.kind })));
  const battles = matches.filter(m => m.kind === 'battle');
  const topics = concepts.map(c => {
    const mine = attempts.filter(a => a.conceptId === c.id), value = mastery(mine);
    const ordered = [...mine].sort((a, b) => a.at.localeCompare(b.at));
    return { id: c.id, topic: c.topic, mastery: value, status: statusOf(value), attempts: mine.length, last: ordered.at(-1)?.at || null, trend: ordered.length > 1 ? Math.round((ordered.at(-1).accuracy - ordered[0].accuracy) * 10) / 10 : 0 };
  });
  const missCounts = new Map();
  for (const a of attempts) for (const id of a.missed) { const key = `${a.conceptId}:${id}`; missCounts.set(key, (missCounts.get(key) || 0) + 1); }
  const missed = [...missCounts].map(([key, count]) => { const [conceptId, pointId] = key.split(':'), c = conceptById(conceptId); return c && { conceptId, topic: c.topic, point: c.points.find(p => p.id === pointId)?.text, count }; }).filter(m => m?.point).sort((a, b) => b.count - a.count).slice(0, 5);
  // Streak: consecutive days with a game, counting back from today (or yesterday, so a streak
  // is not lost before you have played today).
  const days = new Set(matches.map(m => m.at.slice(0, 10))), iso = t => new Date(t).toISOString().slice(0, 10);
  let day = days.has(iso(now)) ? now : now - DAY, streak = 0;
  while (days.has(iso(day))) { streak++; day -= DAY; }
  const tried = topics.filter(t => t.attempts);
  return {
    games: battles.length, wins: battles.filter(m => m.outcome === 'win').length, losses: battles.filter(m => m.outcome === 'loss').length, draws: battles.filter(m => m.outcome === 'draw').length,
    practices: matches.length - battles.length, answers: attempts.length, streak,
    average: tried.length ? Math.round((tried.reduce((s, t) => s + t.mastery, 0) / tried.length) * 10) / 10 : null,
    best: battles.reduce((m, b) => Math.max(m, b.myScore), 0),
    topics, missed,
  };
}

// The personalised skill check: two weakest topics you have tried, one strong topic that is due
// for revision, and one you have never tried; gaps are filled with other untried topics.
export function planSkillCheck(stats, random = Math.random, now = Date.now(), count = 4) {
  const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tried = stats.topics.filter(t => t.attempts), untried = shuffle(stats.topics.filter(t => !t.attempts));
  const weakest = [...tried].filter(t => t.mastery < STRONG).sort((a, b) => a.mastery - b.mastery).slice(0, 2);
  const due = tried.filter(t => t.mastery >= STRONG && !weakest.includes(t)).sort((a, b) => a.last.localeCompare(b.last)).find(t => now - Date.parse(t.last) > DUE_DAYS * DAY) || null;
  const picks = [...weakest.map(t => ({ id: t.id, reason: 'weak' })), ...(due ? [{ id: due.id, reason: 'due' }] : []), ...untried.slice(0, 1).map(t => ({ id: t.id, reason: 'new' }))];
  for (const t of [...untried.slice(1), ...shuffle(tried.filter(t => !picks.some(p => p.id === t.id)))]) { if (picks.length >= count) break; picks.push({ id: t.id, reason: t.attempts ? 'review' : 'new' }); }
  return picks.slice(0, count);
}
export const weakestTopic = stats => [...stats.topics].filter(t => t.attempts).sort((a, b) => a.mastery - b.mastery)[0]?.id || null;

// Spoken topic names ("pull up", "I squared C", "motor driver") to concept ids.
const aliases = { resistor: ['resistor', 'resistance', 'ohm'], 'led-resistor': ['led', 'leds', 'series resistor'], pullup: ['pull up', 'pullup', 'pull-up', 'pull down'], pwm: ['pwm', 'pulse width', 'duty cycle'], divider: ['divider', 'voltage divider'], decoupling: ['capacitor', 'decoupling', 'bypass'], i2c: ['i2c', 'i²c', 'i squared c', 'i two c', 'iic'], transistor: ['transistor', 'mosfet', 'bjt'], flyback: ['flyback', 'diode', 'back emf'], adc: ['adc', 'analog', 'analogue', 'analog to digital'], 'logic-levels': ['logic level', 'logic levels', '3.3', 'level shift'], ground: ['ground', 'common ground', 'gnd'], debounce: ['debounce', 'debouncing', 'bounce', 'button'], servo: ['servo'], ultrasonic: ['ultrasonic', 'hc-sr04', 'distance sensor', 'sonar'], 'h-bridge': ['h bridge', 'h-bridge', 'motor driver', 'l298', 'motor'] };
export function findConcept(text) {
  const said = ` ${String(text).toLowerCase().replace(/[^a-z0-9.²\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  let best = null;
  // The most specific phrase wins: more words first ("pull up" beats "resistor"), then length.
  for (const [id, words] of Object.entries(aliases)) for (const w of words) if (said.includes(` ${w} `) || said.includes(` ${w}s `)) { const score = w.split(' ').length * 100 + w.length; if (!best || score > best.score) best = { id, score }; }
  return best?.id || null;
}

// Concepts a reviewed build depends on, from its catalogue parts.
const partConcepts = { led: ['led-resistor'], resistor: ['resistor', 'divider'], motor: ['h-bridge', 'flyback'], driver: ['h-bridge', 'pwm'], supply: ['ground'], temperature: ['adc'], rover: ['h-bridge', 'ground'], indicator: ['led-resistor'], 'raspberry-pi-5': ['logic-levels'], 'arduino-uno-r3': ['pwm'] };
export function conceptsForBuild(input) {
  return [...new Set([input?.board, ...(input?.parts || [])].flatMap(id => partConcepts[id] || []))].slice(0, 4);
}
