// Shareable images, drawn on a canvas in the browser: a stats card and a session result card.
import { avatars } from '../../shared/arena/bots.js';

const INK = '#0d3b2e', MINT = '#8ff0b3', BUTTER = '#fff27a', CREAM = '#fffbea', TOMATO = '#ff6b4a', GOOD = '#2fcf7a', LILAC = '#d9b8ff';
const W = 1080, H = 1350;

async function canvas() {
  try { await Promise.all([document.fonts.load('60px "Bowlby One"'), document.fonts.load('700 30px "Bricolage Grotesque"')]); } catch {}
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = MINT; g.fillRect(0, 0, W, H);
  g.fillStyle = BUTTER; g.beginPath(); g.ellipse(W / 2, H + 120, W * .75, 420, 0, 0, Math.PI * 2); g.fill();
  return [c, g];
}
const display = size => `${size}px "Bowlby One", sans-serif`, body = (size, weight = 700) => `${weight} ${size}px "Bricolage Grotesque", sans-serif`;
function box(g, x, y, w, h, r, fill, shadow = 10) {
  g.fillStyle = INK; round(g, x + shadow, y + shadow, w, h, r); g.fill();
  g.fillStyle = fill; round(g, x, y, w, h, r); g.fill();
  g.lineWidth = 6; g.strokeStyle = INK; round(g, x, y, w, h, r); g.stroke();
}
function round(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function blob(g, x, y, size, avatar, happy = true) {
  const a = avatars.find(v => v.id === avatar) || avatars[0];
  g.fillStyle = a.body; g.strokeStyle = INK; g.lineWidth = 6;
  g.beginPath(); g.ellipse(x, y, size, size * .94, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = a.shade; g.beginPath(); g.ellipse(x + size * .25, y + size * .35, size * .55, size * .4, 0, 0, Math.PI * 2); g.globalAlpha = .45; g.fill(); g.globalAlpha = 1;
  g.fillStyle = INK; g.lineWidth = 6; g.lineCap = 'round';
  if (happy) { for (const dx of [-.3, .3]) { g.beginPath(); g.arc(x + dx * size, y - size * .1, size * .12, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
  else for (const dx of [-.3, .3]) { g.beginPath(); g.ellipse(x + dx * size, y - size * .1, size * .08, size * .12, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(x, y + size * .15, size * .25, .15 * Math.PI, .85 * Math.PI); g.stroke();
}
function sticker(g, text, x, y) {
  g.font = display(30); const w = g.measureText(text).width + 56;
  g.save(); g.translate(x, y); g.rotate(-.04); box(g, -w / 2, -34, w, 68, 34, '#ffb6d3', 6); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2); g.restore();
}
function bars(g, topics, x, y, width) {
  topics.forEach((t, i) => {
    const top = y + i * 74, value = t.mastery ?? 0;
    g.fillStyle = INK; g.font = body(30, 800); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(t.topic, x, top + 26);
    g.textAlign = 'right'; g.fillText(`${value}/10`, x + width, top + 26);
    g.fillStyle = '#fff'; round(g, x, top + 38, width, 24, 12); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    g.fillStyle = value >= 7 ? GOOD : value >= 4 ? '#f2b705' : TOMATO; round(g, x + 3, top + 41, Math.max(18, (width - 6) * value / 10), 18, 9); g.fill();
  });
}
const footer = g => { g.fillStyle = INK; g.font = display(34); g.textAlign = 'center'; g.fillText('pinlight.', W / 2, H - 70); g.font = body(26, 600); g.fillText('Explain electronics out loud · Pinlight Arena', W / 2, H - 32); };

export async function statsCard({ stats, name, avatar }) {
  const [c, g] = await canvas();
  sticker(g, 'MY ARENA STATS', W / 2, 90);
  blob(g, W / 2, 230, 80, avatar);
  g.fillStyle = INK; g.textAlign = 'center'; g.font = display(64); g.fillText(name || 'Player', W / 2, 380);
  const tiles = [['Games', stats.games], ['Wins', stats.wins], ['Practice', stats.practices], ['Streak', `${stats.streak}d`]];
  tiles.forEach(([label, value], i) => { const x = 70 + i * 240; box(g, x, 430, 210, 150, 26, i % 2 ? CREAM : '#fff', 8); g.fillStyle = INK; g.textAlign = 'center'; g.font = display(56); g.fillText(String(value), x + 105, 515); g.font = body(26, 700); g.fillText(label, x + 105, 555); });
  box(g, 70, 630, 940, 560, 34, CREAM);
  g.fillStyle = INK; g.textAlign = 'left'; g.font = display(36); g.fillText('Topics', 110, 690);
  const tried = stats.topics.filter(t => t.attempts).sort((a, b) => b.mastery - a.mastery).slice(0, 6);
  if (tried.length) bars(g, tried, 110, 720, 860); else { g.font = body(30, 600); g.fillText('Play a battle or practice to see your topics.', 110, 760); }
  footer(g);
  return c;
}

export async function resultCard({ title, name, avatar, score, rows, verdict }) {
  const [c, g] = await canvas();
  sticker(g, title, W / 2, 90);
  blob(g, W / 2, 240, 90, avatar);
  g.fillStyle = INK; g.textAlign = 'center'; g.font = display(60); g.fillText(name || 'Player', W / 2, 400);
  g.font = display(110); g.fillStyle = TOMATO; g.fillText(String(score), W / 2, 530); g.fillStyle = INK; g.font = body(30, 700); g.fillText('points', W / 2, 570);
  box(g, 70, 620, 940, 470, 34, CREAM);
  bars(g, rows.slice(0, 5), 110, 670, 860);
  if (verdict) { g.font = body(30, 800); g.fillStyle = INK; g.textAlign = 'center'; g.fillText(verdict, W / 2, 1150); }
  footer(g);
  return c;
}

export const toBlob = c => new Promise(resolve => c.toBlob(resolve, 'image/png'));
export async function download(c, name) {
  const url = URL.createObjectURL(await toBlob(c)), a = Object.assign(document.createElement('a'), { href: url, download: `${name}.png` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// The phone share sheet when available, otherwise the image goes on the clipboard.
export async function share(c, name, text) {
  const file = new File([await toBlob(c)], `${name}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]); return 'copied'; }
  await download(c, name); return 'downloaded';
}
