// Arena matches run on the server so both players get the same concepts and one clock. Each
// player moves through the rounds at their own pace; spoken answers are graded in the
// background as they arrive, so scores tick up live and results are ready soon after the end.
// Practice rooms have a single player, chosen concepts, and pause after each answer to show
// its feedback. A finished room is reported through onFinish so signed-in players' progress
// can be saved.
import { randomUUID, randomInt } from 'node:crypto';
import { concepts, conceptById } from '../../shared/arena/concepts.js';
import { keywordGrade, roundPoints, ROUND_SECONDS, ROUNDS } from '../../shared/arena/grading.js';
import { botById, planBotTurn, playerAvatars } from '../../shared/arena/bots.js';
import { matchRecord } from '../../shared/arena/progress.js';

const COUNTDOWN_MS = 3500, GRACE_MS = 2500, ROOM_TTL_MS = 2 * 3600e3, IDLE_TTL_MS = 30 * 60e3, MAX_ROOMS = 500;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const fail = (message, status) => Object.assign(new Error(message), { status });

function pickConcepts(random, count = ROUNDS) {
  const pool = [...concepts];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count).map(c => c.id);
}

export function createArena({ grade = null, coach = null, onFinish = null, random = Math.random, now = Date.now, roundSeconds = ROUND_SECONDS } = {}) {
  const rooms = new Map();
  const newCode = () => { let code; do code = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join(''); while (rooms.has(code)); return code; };
  const fresh = p => Object.assign(p, { index: 0, answers: [], startedAt: null, finishedAt: null, reviewing: false });
  const human = (name, avatar, owner) => fresh({ id: randomUUID().slice(0, 8), token: randomUUID(), owner: owner || null, name: String(name).trim().slice(0, 24) || 'Player', avatar: playerAvatars.includes(avatar) ? avatar : playerAvatars[0], bot: null, online: 0 });
  const get = code => { const room = rooms.get(String(code || '').toUpperCase()); if (!room) throw fail('That room has closed or the code is wrong.', 404); return room; };
  const seat = (room, token) => { const player = room.players.find(p => p.token === token && token); if (!player) throw fail('You are not in this room.', 403); return player; };
  const clearTimers = room => { room.timers.forEach(clearTimeout); room.timers = []; };
  const later = (room, ms, fn) => { const t = setTimeout(() => { if (rooms.get(room.code) === room) fn(); }, ms); t.unref?.(); room.timers.push(t); return t; };
  const score = p => p.answers.reduce((sum, a) => sum + (a.points || 0), 0);

  function view(room, viewer) {
    const me = viewer && room.status === 'playing' && !viewer.finishedAt && !viewer.reviewing ? viewer : null, concept = me && conceptById(room.concepts[me.index]);
    return {
      code: room.code, mode: room.mode, kind: room.kind, status: room.status, hostId: room.hostId, you: viewer?.id || null,
      total: room.concepts.length || ROUNDS, roundSeconds, startAt: room.startAt, serverNow: now(),
      players: room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, bot: p.bot, online: p.bot ? true : p.online > 0, progress: p.answers.length, finished: !!p.finishedAt, score: score(p), grading: p.answers.filter(a => a.pending).length, last: p.answers.at(-1)?.pending === false && p.bot ? p.answers.at(-1).variant : null })),
      round: concept ? { index: me.index, id: concept.id, topic: concept.topic, prompt: concept.prompt, deadline: me.startedAt + roundSeconds * 1000 } : null,
      review: viewer?.reviewing ? review(room, viewer) : null,
      results: room.status === 'finished' ? results(room) : null,
      recap: room.status === 'finished' ? room.recap : null,
    };
  }
  function results(room) {
    return room.concepts.map((id, i) => {
      const c = conceptById(id);
      return { id, topic: c.topic, prompt: c.prompt, reference: c.reference, points: c.points.map(({ id, text }) => ({ id, text })), answers: Object.fromEntries(room.players.map(p => { const a = p.answers[i]; return [p.id, a ? { text: a.text, ms: a.ms, points: a.points, accuracy: a.accuracy, clarity: a.clarity, covered: a.covered, feedback: a.feedback, graded: a.graded } : null]; })) };
    });
  }
  // Practice feedback for the answer just given: grades, key points and the model answer.
  function review(room, player) {
    const i = player.index - 1, c = conceptById(room.concepts[i]), a = player.answers[i];
    return { index: i, last: player.index >= room.concepts.length, id: c.id, topic: c.topic, prompt: c.prompt, text: a.text, pending: a.pending, accuracy: a.accuracy, clarity: a.clarity, points: a.points, feedback: a.feedback, reference: c.reference, keyPoints: c.points.map(({ id, text }) => ({ id, text, hit: !a.pending && (a.covered || []).includes(id) })) };
  }
  function broadcast(room) {
    room.updatedAt = now();
    for (const { player, send } of room.listeners) { try { send(view(room, player)); } catch {} }
  }

  function beginRound(room, player) {
    player.startedAt = now();
    if (player.bot) {
      const plan = planBotTurn(botById(player.bot), roundSeconds, random);
      later(room, plan.delay, () => {
        const concept = conceptById(room.concepts[player.index]), answer = concept.bots[plan.variant];
        submit(room, player, answer.text, { variant: plan.variant, grade: { accuracy: answer.accuracy, clarity: answer.clarity, covered: answer.covered, feedback: '', graded: 'preset' } });
      });
    } else {
      const index = player.index;
      player.timer = later(room, roundSeconds * 1000 + GRACE_MS, () => { if (player.index === index && !player.finishedAt) submit(room, player, ''); });
    }
  }
  function submit(room, player, text, preset = {}) {
    clearTimeout(player.timer);
    const concept = conceptById(room.concepts[player.index]), ms = Math.min(now() - player.startedAt, roundSeconds * 1000);
    const answer = { text: String(text).slice(0, 2400), ms, pending: true, variant: preset.variant || null };
    player.answers.push(answer);
    const known = new Set(concept.points.map(p => p.id));
    const settle = g => { Object.assign(answer, g, { covered: (g.covered || []).filter(id => known.has(id)), pending: false, points: roundPoints(g, ms, roundSeconds) }); checkDone(room); broadcast(room); };
    if (preset.grade) settle(preset.grade);
    else if (!answer.text.trim() || !grade) settle(keywordGrade(concept, answer.text));
    else grade(concept, answer.text).then(settle, () => settle(keywordGrade(concept, answer.text)));
    player.index++;
    if (room.mode === 'practice') player.reviewing = true;
    else if (player.index >= room.concepts.length) player.finishedAt = now();
    else beginRound(room, player);
    checkDone(room);
    broadcast(room);
  }
  function checkDone(room) {
    if (!['playing', 'grading'].includes(room.status) || !room.players.every(p => p.finishedAt)) return;
    if (room.players.some(p => p.answers.some(a => a.pending))) { room.status = 'grading'; return; }
    clearTimers(room);
    room.status = 'finished';
    if (onFinish) for (const p of room.players.filter(p => p.owner)) Promise.resolve().then(() => onFinish(p.owner, matchRecord(view(room, p), room.kind))).catch(() => {});
    makeRecap(room);
  }
  function makeRecap(room) {
    const nameOf = id => room.players.find(p => p.id === id)?.name || id;
    const summary = { mode: room.mode, players: room.players.map(p => ({ name: p.name, bot: !!p.bot, score: score(p) })), rounds: results(room).map(r => ({ question: r.prompt, modelAnswer: r.reference, answers: Object.fromEntries(Object.entries(r.answers).map(([id, a]) => [nameOf(id), a && { transcript: a.text.slice(0, 800), accuracy: a.accuracy, clarity: a.clarity, points: a.points }])) })) };
    room.recap = null;
    (async () => {
      let text = null;
      if (coach && room.mode !== 'practice') { try { text = await coach(summary); } catch {} }
      if (rooms.get(room.code) !== room || room.status !== 'finished') return;
      room.recap = { text: text || (room.mode === 'practice' ? practiceRecap(results(room), room.players[0]) : fallbackRecap(summary)), ai: !!text };
      broadcast(room);
    })();
  }

  function sweep() {
    const t = now();
    for (const [code, room] of rooms) if ((!room.listeners.size && t - room.updatedAt > IDLE_TTL_MS) || t - room.createdAt > ROOM_TTL_MS) { clearTimers(room); rooms.delete(code); }
  }
  const sweeper = setInterval(sweep, 60e3); sweeper.unref?.();

  return {
    rooms,
    create({ mode, name, avatar, bot, concepts: chosen = [], kind = 'practice', owner = null }) {
      if (rooms.size >= MAX_ROOMS) sweep();
      if (rooms.size >= MAX_ROOMS) throw fail('The arena is full right now. Try again in a few minutes.', 503);
      if (mode === 'solo' && !botById(bot)) throw fail('Choose an opponent.', 400);
      const plan = [...new Set(chosen)].filter(id => conceptById(id)).slice(0, 8);
      if (mode === 'practice' && !plan.length) throw fail('Choose a topic to practise.', 400);
      const host = human(name, avatar, owner), code = newCode(), players = [host];
      if (mode === 'solo') { const b = botById(bot); players.push(fresh({ id: `bot-${b.id}`, token: null, name: b.name, avatar: b.avatar, bot: b.id, online: 1 })); }
      rooms.set(code, { code, mode: ['solo', 'practice'].includes(mode) ? mode : 'duo', kind: mode === 'practice' ? (kind === 'skillcheck' ? 'skillcheck' : 'practice') : 'battle', plan, hostId: host.id, status: 'lobby', players, concepts: [], startAt: null, recap: null, timers: [], listeners: new Set(), createdAt: now(), updatedAt: now() });
      return { code, playerId: host.id, token: host.token };
    },
    join(code, { name, avatar, owner = null }) {
      const room = get(code);
      if (room.mode !== 'duo') throw fail('That is a solo room.', 409);
      if (room.status !== 'lobby') throw fail('That match has already started.', 409);
      if (room.players.length >= 2) throw fail('That room is full.', 409);
      const player = human(name, avatar, owner);
      room.players.push(player);
      broadcast(room);
      return { code: room.code, playerId: player.id, token: player.token };
    },
    async start(code, token) {
      const room = get(code), player = seat(room, token);
      if (player.id !== room.hostId) throw fail('Only the host can start the match.', 403);
      if (!['lobby', 'finished'].includes(room.status)) throw fail('The match is already running.', 409);
      if (room.players.length < 2 && room.mode !== 'practice') throw fail('Waiting for an opponent to join.', 409);
      clearTimers(room);
      room.players.forEach(fresh);
      Object.assign(room, { concepts: room.mode === 'practice' ? [...room.plan] : pickConcepts(random), status: 'countdown', startAt: now() + COUNTDOWN_MS, recap: null });
      later(room, COUNTDOWN_MS, () => { room.status = 'playing'; room.players.forEach(p => beginRound(room, p)); broadcast(room); });
      broadcast(room);
      return { ok: true };
    },
    answer(code, token, { index, text }) {
      const room = get(code), player = seat(room, token);
      if (room.status !== 'playing' || player.finishedAt || player.reviewing) throw fail('There is no question waiting for you.', 409);
      if (index !== player.index) throw fail('That question has already moved on.', 409);
      submit(room, player, text || '');
      return { ok: true, next: player.finishedAt ? null : player.index };
    },
    // Practice only: move on from the feedback, or try the same concept again.
    next(code, token) {
      const room = get(code), player = seat(room, token);
      if (!player.reviewing) throw fail('There is nothing to move on from.', 409);
      player.reviewing = false;
      if (player.index >= room.concepts.length) { player.finishedAt = now(); checkDone(room); }
      else beginRound(room, player);
      broadcast(room);
      return { ok: true };
    },
    retry(code, token) {
      const room = get(code), player = seat(room, token);
      if (!player.reviewing) throw fail('There is nothing to retry.', 409);
      if (room.concepts.length >= 12) throw fail('That is enough retries for one session. Finish and start another.', 409);
      room.concepts.splice(player.index, 0, room.concepts[player.index - 1]);
      player.reviewing = false;
      beginRound(room, player);
      broadcast(room);
      return { ok: true };
    },
    leave(code, token) {
      const room = get(code), player = seat(room, token);
      if (room.status === 'lobby' && player.id !== room.hostId) { room.players = room.players.filter(p => p !== player); broadcast(room); }
      return { ok: true };
    },
    subscribe(code, token, send) {
      const room = get(code), player = seat(room, token), entry = { player, send };
      room.listeners.add(entry); player.online++;
      send(view(room, player));
      broadcast(room);
      return () => { room.listeners.delete(entry); player.online = Math.max(0, player.online - 1); broadcast(room); };
    },
    peek(code) { const room = get(code); return { code: room.code, mode: room.mode, status: room.status, players: room.players.map(p => ({ name: p.name, avatar: p.avatar })) }; },
  };
}

export function practiceRecap(rounds, player) {
  const scored = rounds.map(r => ({ topic: r.topic, accuracy: r.answers[player.id]?.accuracy ?? 0 }));
  const best = [...scored].sort((a, b) => b.accuracy - a.accuracy)[0], worst = [...scored].sort((a, b) => a.accuracy - b.accuracy)[0];
  const total = rounds.reduce((s, r) => s + (r.answers[player.id]?.points || 0), 0);
  return best.accuracy === worst.accuracy
    ? `You scored ${total} points across ${rounds.length} answer${rounds.length === 1 ? '' : 's'}. Check the key points you missed and try again.`
    : `You scored ${total} points. Strongest: ${best.topic} (${best.accuracy}/10). Revisit ${worst.topic} (${worst.accuracy}/10) and cover the key points you missed.`;
}

export function fallbackRecap({ players, rounds }) {
  const [first, second] = [...players].sort((a, b) => b.score - a.score);
  const head = first.score === second?.score ? `It finished level at ${first.score} points.` : `${first.name} won ${first.score} to ${second?.score ?? 0}.`;
  const avg = (id, key) => { const list = rounds.map(r => r.answers[id]?.[key]).filter(Number.isFinite); return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0; };
  const [acc] = [...players].sort((a, b) => avg(b.name, 'accuracy') - avg(a.name, 'accuracy')), [clear] = [...players].sort((a, b) => avg(b.name, 'clarity') - avg(a.name, 'clarity'));
  return `${head} ${acc.name} was the more accurate explainer and ${clear.name} the clearer one. Compare your answers with the model answers below and try covering every key point next time.`;
}
