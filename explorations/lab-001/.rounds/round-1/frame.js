// Lab-001 frame composer. Thin: owns the corpus, the screen-switcher chrome,
// and option mounting. Holds NO builders — lanes own those (lanes/*.js).
/* global LANE_SPECS */

window.CORPUS = {
  roomCode: 'PLUM',
  players: [
    { name: 'Maya', host: true, present: true, kind: 'human' },
    { name: 'Theo', host: false, present: true, kind: 'human' },
    { name: 'Sam', host: false, present: false, kind: 'human' },
    { name: 'Bashō', host: false, present: true, kind: 'ai' },
  ],
  wordCounts: [1, 2, 3, 4, 5, 4, 3, 2, 1],
  game: {
    round: 5,
    totalRounds: 9,
    wordsThisRound: 5,
    previousLine: 'the river keeps counting',
    draft: 'and nobody asks it',
    waitingOn: ['Theo'],
  },
  revealQueue: [
    { poem: 'Poem 01', reader: 'Maya', firstWord: 'moonlight' },
    { poem: 'Poem 02', reader: 'Theo', firstWord: 'dust' },
  ],
  poem: {
    title: 'Poem 01',
    lines: [
      { text: 'moonlight', author: 'Maya' },
      { text: 'soft rain', author: 'Bashō' },
      { text: 'over quiet stones', author: 'Theo' },
      { text: 'the river keeps counting', author: 'Sam' },
      { text: 'and nobody asks it why', author: 'Maya' },
      { text: 'the moss keeps score', author: 'Bashō' },
      { text: 'under borrowed light', author: 'Theo' },
      { text: 'then rests', author: 'Sam' },
      { text: 'hush', author: 'Maya' },
    ],
  },
};

const SCREENS = ['home', 'join', 'lobby', 'write', 'wait', 'reveal'];
const SCREEN_LABELS = {
  home: 'Home',
  join: 'Join',
  lobby: 'Lobby',
  write: 'Write',
  wait: 'Wait',
  reveal: 'Reveal',
};

let currentOpt = null;
let currentScreen = 'home';
const injected = new Set();

function parseHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return { opt: null, screen: 'home' };
  const [opt, screen] = h.split('/');
  return { opt, screen: SCREENS.includes(screen) ? screen : 'home' };
}

function render() {
  const specs = window.LANE_SPECS || {};
  const { opt, screen } = parseHash();
  const spec = specs[opt];
  const shell = document.getElementById('mount');
  if (!spec) {
    shell.innerHTML =
      '<div class="frame-empty">Pick an option from the sidebar.</div>';
    return;
  }
  currentOpt = opt;
  currentScreen = screen;

  if (spec.css && !injected.has(opt)) {
    const style = document.createElement('style');
    style.dataset.opt = opt;
    style.textContent = spec.css;
    document.head.appendChild(style);
    injected.add(opt);
  }

  shell.innerHTML = '';

  const tabs = document.createElement('nav');
  tabs.className = 'lab-tabs';
  SCREENS.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = SCREEN_LABELS[s];
    b.className = s === screen ? 'active' : '';
    b.addEventListener('click', () => {
      location.hash = `${opt}/${s}`;
    });
    tabs.appendChild(b);
  });
  shell.appendChild(tabs);

  const stageWrap = document.createElement('div');
  stageWrap.className = 'lab-stage-wrap';
  const stage = document.createElement('div');
  stage.className = `screen-root opt-${opt}`;
  stageWrap.appendChild(stage);
  shell.appendChild(stageWrap);

  const fn = spec.screens && spec.screens[screen];
  if (typeof fn === 'function') {
    try {
      // Fresh node per render so entrance animations replay.
      fn(stage, window.CORPUS);
    } catch (err) {
      stage.innerHTML = `<div class="frame-error">Builder error: ${String(err)}</div>`;
      console.error(`[lab] ${opt}/${screen}`, err);
    }
  } else {
    stage.innerHTML = `<div class="frame-error">No builder for ${screen}</div>`;
  }
}

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', render);
