import { hideParams } from './url-state.js';
// Spoken or typed commands for the command bar. Matching is rule-based so the same words always
// do the same thing; nothing here calls a model.
import { botById, bots } from '../../shared/arena/bots.js';
import { findConcept } from '../../shared/arena/progress.js';

export const go = path => { history.pushState(null, '', hideParams(path, { fresh: true })); dispatchEvent(new PopStateEvent('popstate')); scrollTo(0, 0); };
export const openPanel = (open, data, then) => dispatchEvent(new CustomEvent('pinlight:ui', { detail: { open, data, then } }));
export const sendToPanel = action => dispatchEvent(new CustomEvent('pinlight:panel', { detail: { action } }));
export const sendToPage = (action, data) => dispatchEvent(new CustomEvent('pinlight:command', { detail: { action, ...data } }));

export const commandHelp = [
  { group: 'Get around', items: [['open arena', 'The voice battle'], ['new build', 'Start a fresh build review'], ['open learn', 'The 3D learning desk'], ['concept map', 'All 16 concepts and how they connect'], ['my desk', 'Your saved work'], ['account', 'Your profile'], ['go back', 'The previous page'], ['go home', 'The overview']] },
  { group: 'Battle', items: [['battle Volt', 'Solo against a bot (Volt, Ohm, Fuse or Spark)'], ['challenge a friend', 'Create a duo room'], ['rematch', 'Play the same opponent again']] },
  { group: 'Practise', items: [['skill check', 'A personalised test from your past games'], ['practise my weakest topic', 'Your lowest-scoring concept'], ['practise PWM', 'Any topic: I²C, pull-ups, servos, flyback diodes…'], ['practise this build', 'On Build review: the concepts your build needs'], ['next', 'Move on after feedback'], ['try again', 'Retry the same concept'], ['that’s my answer', 'Submit while answering']] },
  { group: 'Stats and sharing', items: [['profile stats', 'Your stats card'], ['download arena stats', 'Save your stats card as an image'], ['share', 'Share the open card'], ['download', 'Save the open card'], ['close', 'Close the open panel']] },
];

// Dictation adds capitals and punctuation ("Help.", "Next!"); only a decimal point survives.
const clean = text => String(text).toLowerCase().replace(/[’']/g, '').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/[^a-z0-9²/.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (said, ...phrases) => phrases.some(p => new RegExp(`(^|\\s)${p}(\\s|$)`).test(said));

// Returns { kind, ... } describing what to do, or null when nothing matches.
export function parseCommand(text) {
  const said = clean(text).replace(/^(please|okay|ok|hey pinlight|pinlight)\s+/, '').replace(/\s+(please|now)$/, '');
  if (!said) return null;
  if (/^\/?help( me)?$/.test(said) || has(said, 'what can i say', 'what can i do', '(show|list|open)( me)?( the)? commands', 'commands', 'how does this work')) return { kind: 'panel', open: 'help' };
  if (has(said, 'close', 'dismiss', 'cancel')) return { kind: 'panel-action', action: 'close' };
  if (has(said, 'download (arena |my )?stats', 'save (my )?stats')) return { kind: 'panel', open: 'stats', then: 'download' };
  if (has(said, '(profile|my|arena|show my|show) stats', 'my progress', 'show progress')) return { kind: 'panel', open: 'stats' };
  if (has(said, 'download( (the|this))?( image| card| it)?', 'save (the |this )?image')) return { kind: 'panel-action', action: 'download' };
  if (has(said, 'share( (this|the|my))?( result| image| card| stats| practice stats| it)?')) return { kind: 'panel-action', action: 'share' };
  if (has(said, 'skill check', 'test me', 'personali[sz]ed (test|practice)', 'assess me', 'take a test')) return { kind: 'go', path: '/arena?skillcheck=1' };
  if (has(said, 'practi[cs]e (this|my) build', 'practi[cs]e the build', 'practi[cs]e the concepts')) return { kind: 'page', action: 'practise-build', page: '/build' };
  if (has(said, 'practi[cs]e (my )?weak(est)?( topic| spot| area)?', 'what am i weak at')) return { kind: 'go', path: '/arena?practice=weakest' };
  if (has(said, 'practi[cs]e', 'revise', 'quiz me on', 'test me on')) { const id = findConcept(said); return id ? { kind: 'go', path: `/arena?practice=${id}` } : { kind: 'unknown', hint: 'Which topic? Try “practise PWM” or “practise pull-up resistors”.' }; }
  if (has(said, 'rematch', 'play again')) return { kind: 'page', action: 'rematch', page: '/arena' };
  if (has(said, 'try again', 'retry', 'once more', 'again')) return { kind: 'page', action: 'retry', page: '/arena' };
  if (has(said, 'next( question| one| concept)?', 'continue', 'move on', 'finish')) return { kind: 'page', action: 'next', page: '/arena' };
  const bot = bots.find(b => has(said, b.id));
  if (bot && has(said, 'battle', 'play', 'fight', 'versus', 'vs', 'against', 'challenge')) return { kind: 'go', path: `/arena?battle=${bot.id}` };
  if (has(said, 'challenge a friend', 'duo', 'play with a friend', 'create a room', 'invite a friend')) return { kind: 'go', path: '/arena?duo=1' };
  if (has(said, 'new build', 'start a new build', 'start over', 'review a build', 'build review')) return { kind: 'go', path: '/build' };
  if (has(said, '(open |go to |show )?(the )?arena', 'start a battle', 'battle')) return { kind: 'go', path: '/arena' };
  if (has(said, '(open |go to )?(the )?learn(ing desk)?', 'workbench')) return { kind: 'go', path: '/learn' };
  if (has(said, '(open |go to )?(my )?desk', 'saved work')) return { kind: 'go', path: '/desk' };
  if (has(said, 'account', 'profile', 'my profile')) return { kind: 'go', path: '/signin' };
  if (has(said, 'settings')) return { kind: 'go', path: '/settings' };
  if (has(said, 'go back', 'back', 'previous page')) return { kind: 'back' };
  if (has(said, 'go home', 'home', 'overview')) return { kind: 'go', path: '/' };
  if (has(said, 'sign out', 'log out', 'logout')) return { kind: 'signout' };
  if (has(said, 'concept map', 'concepts', 'all topics')) return { kind: 'go', path: '/concepts' };
  // Anything else that asks for help ("can you help", "I need help") shows the command list.
  if (has(said, 'help')) return { kind: 'panel', open: 'help' };
  return null;
}
export const botName = id => botById(id)?.name || id;
