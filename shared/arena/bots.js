// Solo opponents are rule-based. For each concept a bot picks one of three pre-written answers
// (strong, partial or weak) from its own odds, and takes its own time. No model call is made
// for a bot, and its grades were fixed when the answers were written.
export const bots = [
  {
    id: 'volt', name: 'Volt', tagline: 'Sharp, fast and a little smug.', level: 'Hard', avatar: 'volt',
    odds: { strong: .8, partial: .17 }, pace: [.3, .55],
    lines: { strong: ['Too easy.', 'Textbook.'], partial: ['Close enough.'], weak: ['A rare glitch.'], win: ['Another win for the robots.'], lose: ['Recalibrating… well played.'] },
  },
  {
    id: 'ohm', name: 'Ohm', tagline: 'Slow, careful, explains everything.', level: 'Medium', avatar: 'ohm',
    odds: { strong: .55, partial: .38 }, pace: [.6, .9],
    lines: { strong: ['Measured twice.', 'Steady wins.'], partial: ['I could have said more.'], weak: ['Hmm, I rushed that.'], win: ['A calm, careful win.'], lose: ['You were steadier today.'] },
  },
  {
    id: 'fuse', name: 'Fuse', tagline: 'Answers instantly. Often wrong.', level: 'Easy', avatar: 'fuse',
    odds: { strong: .15, partial: .4 }, pace: [.12, .3],
    lines: { strong: ['Boom! Called it!'], partial: ['Speed is everything!'], weak: ['Blown again!', 'Wait, was that right?'], win: ['Fast AND lucky!'], lose: ['I blew it. Literally.'] },
  },
  {
    id: 'spark', name: 'Spark', tagline: 'Chaotic. Brilliant or baffling.', level: 'Wild', avatar: 'spark',
    odds: { strong: .45, partial: .15 }, pace: [.1, .95],
    lines: { strong: ['Zap! Nailed it.'], partial: ['That was a vibe.'], weak: ['Whoops, wrong wire.', 'Bzzt!'], win: ['Chaos wins again!'], lose: ['You out-sparked me!'] },
  },
];
export const botById = id => bots.find(b => b.id === id);

// Player blobs: colour pairs for the body and its shadow.
export const avatars = [
  { id: 'mint', body: '#7be0a5', shade: '#3fb87a' },
  { id: 'lilac', body: '#d6b4ff', shade: '#a77ef0' },
  { id: 'peach', body: '#ffb38a', shade: '#f0845a' },
  { id: 'sky', body: '#8ccfff', shade: '#4fa3e8' },
  { id: 'lemon', body: '#ffe86b', shade: '#e6c22e' },
  { id: 'rose', body: '#ff9ec4', shade: '#ef6a9c' },
  { id: 'volt', body: '#ffd84a', shade: '#f2a900' },
  { id: 'ohm', body: '#7fa8ff', shade: '#4b6fd8' },
  { id: 'fuse', body: '#ff7a59', shade: '#d94a2b' },
  { id: 'spark', body: '#c879ff', shade: '#9440d8' },
];
export const playerAvatars = avatars.slice(0, 6).map(a => a.id);

export function planBotTurn(bot, limitSeconds, random = Math.random) {
  const [min, max] = bot.pace, roll = random();
  const variant = roll < bot.odds.strong ? 'strong' : roll < bot.odds.strong + bot.odds.partial ? 'partial' : 'weak';
  return { delay: Math.round(limitSeconds * 1000 * (min + random() * (max - min))), variant };
}
export const line = (bot, kind, random = Math.random) => { const list = bot.lines[kind] || []; return list[Math.floor(random() * list.length)] || ''; };
