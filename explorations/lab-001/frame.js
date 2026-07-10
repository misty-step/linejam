// Lab-001 frame composer. Thin: owns the corpus, the screen-switcher chrome,
// and option mounting. Holds NO builders — lanes own those (lanes/*.js).
/* global LANE_SPECS */

// Round 2 corpus: 5 players / 5 poems (operator rule: screens must look good
// at a real party size), plus a mid-ceremony `reading` state for the
// first-class read-aloud screen.
window.CORPUS = {
  roomCode: 'PLUM',
  players: [
    { name: 'Maya', host: true, present: true, kind: 'human' },
    { name: 'Theo', host: false, present: true, kind: 'human' },
    { name: 'Sam', host: false, present: false, kind: 'human' },
    { name: 'Ravi', host: false, present: true, kind: 'human' },
    { name: 'Bashō', host: false, present: true, kind: 'ai' },
  ],
  wordCounts: [1, 2, 3, 4, 5, 4, 3, 2, 1],
  game: {
    round: 5,
    totalRounds: 9,
    wordsThisRound: 5,
    previousLine: 'the river keeps counting',
    draft: 'and nobody asks it',
    waitingOn: ['Theo', 'Ravi'],
  },
  // The reveal is a reading circle: each player ends the game holding ONE
  // poem. Readers go around; each taps read, sees the whole poem at once,
  // and reads it aloud. status: read | now | next | waiting.
  revealQueue: [
    { poem: 'Poem 01', reader: 'Theo', firstWord: 'dust', status: 'read' },
    { poem: 'Poem 02', reader: 'Ravi', firstWord: 'salt', status: 'read' },
    { poem: 'Poem 03', reader: 'Maya', firstWord: 'moonlight', status: 'now' },
    { poem: 'Poem 04', reader: 'Sam', firstWord: 'ember', status: 'next' },
    { poem: 'Poem 05', reader: 'Theo', firstWord: 'wren', forAi: 'Bashō', status: 'waiting' },
  ],
  // You are Maya. It is your turn: your assigned poem, whole, read aloud.
  reading: {
    assigned: 'Poem 03',
    reader: 'Maya',
    position: 3,
    total: 5,
    upNext: 'Sam',
  },
  // Theme roster for the SELECTOR section: current production themes plus
  // the surviving lab systems as candidate themes.
  // Top-10 roster (operator: consolidate to ten uber-distinct themes;
  // composer pick, round 3). Cut: Mono (superseded by Broadside's print
  // voice), Vintage Paper (covered by Fold/Catalog paper tones),
  // Pass the Map, First Edition. 5 light / 5 dark.
  themes: [
    { id: 'kenya', name: 'Kenya', vibe: 'warm white, vermillion seal', paper: '#faf8f5', ink: '#1c1b1a', accent: '#e85d2b', shipped: true },
    { id: 'fold', name: 'The Fold', vibe: 'folded manuscript, rung gauge', paper: '#f4efe6', ink: '#232019', accent: '#b3552e' },
    { id: 'overprint', name: 'Overprint', vibe: 'two-ink risograph poster', paper: '#f6f2e8', ink: '#1d3557', accent: '#e63946' },
    { id: 'broadside', name: 'Broadside', vibe: 'letterpress plates, red and black', paper: '#f2efe9', ink: '#141414', accent: '#d21f1f' },
    { id: 'catalog', name: 'Poem Catalog', vibe: 'edition cards, leaf green', paper: '#fbfaf3', ink: '#1d2b1f', accent: '#3d8f5f' },
    { id: 'aloud', name: 'Aloud', vibe: 'wine-red stage, gold program type', paper: '#5d1f24', ink: '#f3e9db', accent: '#d9a441' },
    { id: 'seats', name: 'Seats', vibe: 'dark parlor, seat tokens, gold', paper: '#17140f', ink: '#efe6d6', accent: '#c9a24b' },
    { id: 'console', name: 'Console', vibe: 'terminal HUD, phosphor green', paper: '#0b0b0b', ink: '#e8e8e8', accent: '#38e54d' },
    { id: 'board', name: 'Board', vibe: 'split-flap departures board', paper: '#121417', ink: '#f5f2ea', accent: '#f2b632' },
    { id: 'hyper', name: 'Hyper', vibe: 'cyberpunk neon dark', paper: '#0d0b14', ink: '#e8e5ee', accent: '#00e5a0', shipped: true },
  ],
  poem: {
    title: 'Poem 03',
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

const SCREEN_ORDER = ['home', 'join', 'lobby', 'write', 'wait', 'reveal', 'read', 'selector'];
const SCREEN_LABELS = {
  home: 'Home',
  join: 'Join',
  lobby: 'Lobby',
  write: 'Write',
  wait: 'Wait',
  reveal: 'Reveal',
  read: 'Read',
  selector: 'Themes',
};
// Tabs are derived per option, so single-screen options (theme selector)
// show only their own tab.
function screensFor(spec) {
  const keys = Object.keys(spec.screens || {});
  return SCREEN_ORDER.filter((s) => keys.includes(s)).concat(
    keys.filter((k) => !SCREEN_ORDER.includes(k))
  );
}

let currentOpt = null;
let currentScreen = 'home';
const injected = new Set();

function parseHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return { opt: null, screen: null };
  const [opt, screen] = h.split('/');
  return { opt, screen: screen || null };
}

function render() {
  const specs = window.LANE_SPECS || {};
  const parsed = parseHash();
  const opt = parsed.opt;
  const spec = specs[opt];
  const shell = document.getElementById('mount');
  if (!spec) {
    shell.innerHTML =
      '<div class="frame-empty">Pick an option from the sidebar.</div>';
    return;
  }
  const available = screensFor(spec);
  const screen = available.includes(parsed.screen)
    ? parsed.screen
    : available[0];
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
  available.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = SCREEN_LABELS[s] || s;
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
