// Lab-002 frame composer. Thin: owns the corpus, the REAL Linejam token sets,
// the screen-switcher chrome, option mounting, and the zero-scroll auditor.
// Holds NO screen builders of its own — lanes own those (lanes/*.js).
/* global LANE_SPECS */

// ---------------------------------------------------------------------------
// Real production theme tokens (Kenya = light default, Aloud = dark default),
// copied verbatim from lib/themes/presets/{kenya,aloud}.ts. This is the FIXED
// half of the fence: every option renders through these two token sets and
// invents no color, font, radius, shadow, or spacing of its own.
// ---------------------------------------------------------------------------
window.THEMES = {
  light: {
    id: 'kenya',
    label: 'Kenya (light)',
    tokens: {
      'color-primary': '#b43a12',
      'color-primary-hover': '#c44521',
      'color-primary-active': '#a8391a',
      'color-background': '#faf9f7',
      'color-foreground': '#1c1917',
      'color-surface': '#ffffff',
      'color-surface-hover': '#f5f5f4',
      'color-muted': '#f5f5f4',
      'color-border': '#e7e5e4',
      'color-border-subtle': '#f5f5f4',
      'color-text-primary': '#1c1917',
      'color-text-secondary': '#57534e',
      'color-text-muted': '#5f5f5f',
      'color-text-inverse': '#faf9f7',
      'color-focus-ring': '#e85d2b',
      'color-success': '#18794e',
      'color-error': '#b42318',
      'color-warning': '#8a5a00',
      'color-info': '#075985',
      'font-display': "'Libre Baskerville', serif",
      'font-sans': "'IBM Plex Sans', sans-serif",
      'font-mono': "'JetBrains Mono', monospace",
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.333rem',
      'text-xl': '1.777rem',
      'text-2xl': '2.369rem',
      'text-3xl': '3.157rem',
      'text-4xl': '4.209rem',
      'text-5xl': '5.61rem',
      'leading-tight': '1.1',
      'leading-normal': '1.5',
      'leading-relaxed': '1.75',
      'tracking-tighter': '-0.05em',
      'tracking-tight': '-0.025em',
      'tracking-normal': '0',
      'tracking-wide': '0.025em',
      'tracking-wider': '0.05em',
      'shadow-sm': '2px 2px 0px rgba(232, 93, 43, 0.15)',
      'shadow-md': '4px 4px 0px rgba(232, 93, 43, 0.1)',
      'shadow-lg': '8px 8px 0px rgba(232, 93, 43, 0.12)',
      'radius-sm': '3px',
      'radius-md': '4px',
      'radius-lg': '6px',
      'radius-full': '9999px',
      'space-1': '0.25rem',
      'space-2': '0.5rem',
      'space-3': '1rem',
      'space-4': '1.5rem',
      'space-5': '2.5rem',
      'space-6': '4rem',
      'space-7': '6rem',
      'space-8': '9rem',
      'duration-instant': '75ms',
      'duration-fast': '150ms',
      'duration-normal': '250ms',
      'duration-slow': '400ms',
      'ease-theme': 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  },
  dark: {
    id: 'aloud',
    label: 'Aloud (dark)',
    tokens: {
      'color-primary': '#d9a441',
      'color-primary-hover': '#e6b559',
      'color-primary-active': '#c2902f',
      'color-background': '#46171c',
      'color-foreground': '#f3e9db',
      'color-surface': '#571f25',
      'color-surface-hover': '#652631',
      'color-muted': '#571f25',
      'color-border': '#743440',
      'color-border-subtle': '#571f25',
      'color-text-primary': '#f3e9db',
      'color-text-secondary': '#dcc9b4',
      'color-text-muted': '#b0b0b0',
      'color-text-inverse': '#2b1508',
      'color-focus-ring': '#d9a441',
      'color-success': '#8fbf7e',
      'color-error': '#e88373',
      'color-warning': '#d9a441',
      'color-info': '#8bafc4',
      'font-display': "'Fraunces', serif",
      'font-sans': "'IBM Plex Sans', sans-serif",
      'font-mono': "'JetBrains Mono', monospace",
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-md': '1.125rem',
      'text-lg': '1.333rem',
      'text-xl': '1.777rem',
      'text-2xl': '2.369rem',
      'text-3xl': '3.157rem',
      'text-4xl': '4.209rem',
      'text-5xl': '5.61rem',
      'leading-tight': '1.2',
      'leading-normal': '1.55',
      'leading-relaxed': '1.8',
      'tracking-tighter': '-0.02em',
      'tracking-tight': '-0.01em',
      'tracking-normal': '0',
      'tracking-wide': '0.04em',
      'tracking-wider': '0.08em',
      'shadow-sm': '0px 2px 6px rgba(217, 164, 65, 0.18)',
      'shadow-md': '0px 4px 14px rgba(217, 164, 65, 0.22)',
      'shadow-lg': '0px 8px 28px rgba(217, 164, 65, 0.26)',
      'radius-sm': '6px',
      'radius-md': '8px',
      'radius-lg': '10px',
      'radius-full': '9999px',
      'space-1': '0.3rem',
      'space-2': '0.6rem',
      'space-3': '1.1rem',
      'space-4': '1.65rem',
      'space-5': '2.75rem',
      'space-6': '4.4rem',
      'space-7': '6.6rem',
      'space-8': '9.9rem',
      'duration-instant': '120ms',
      'duration-fast': '200ms',
      'duration-normal': '300ms',
      'duration-slow': '480ms',
      'ease-theme': 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  },
};

// ---------------------------------------------------------------------------
// Shared corpus. Every lane renders this exact content — the comparison is
// the structural system, never the copy or the roster.
// ---------------------------------------------------------------------------
window.CORPUS = {
  roomCode: 'PLUM',
  roomCodeFormatted: 'PL UM',
  wordCounts: [1, 2, 3, 4, 5, 4, 3, 2, 1],
  players: {
    // "Need 1 more player" — the exact state the operator named.
    low: [{ name: 'Sam', stableId: 'p-sam', host: true }],
    // Typical party per DESIGN.md ("4-6 friends"), one AI persona seated.
    mid: [
      { name: 'Sam', stableId: 'p-sam', host: true },
      { name: 'Riya', stableId: 'p-riya' },
      { name: 'Jordan', stableId: 'p-jordan' },
      { name: 'Priya', stableId: 'p-priya' },
      { name: 'Bashō', stableId: 'p-basho', isBot: true },
    ],
    // Room cap: 8 players, MAX_BOTS = 3. One player away, to prove that
    // state still reads at max density.
    max: [
      { name: 'Sam', stableId: 'p-sam', host: true },
      { name: 'Riya', stableId: 'p-riya' },
      { name: 'Jordan', stableId: 'p-jordan' },
      { name: 'Priya', stableId: 'p-priya' },
      { name: 'Marcus', stableId: 'p-marcus', isAway: true },
      { name: 'Bashō', stableId: 'p-basho', isBot: true },
      { name: 'Emily', stableId: 'p-emily', isBot: true },
      { name: 'Gremlin', stableId: 'p-gremlin', isBot: true },
    ],
  },
  // Write screen: round 3 of 9, target word count 3, the received line.
  writing: {
    round: 3,
    totalRounds: 9,
    targetWordCount: 3,
    previousLineText: 'the kettle forgets its own whistle',
    currentWords: ['and', 'the'],
  },
  // Session recap: 5 poems, one per mid-roster reader. Riya's poem is the
  // room favorite — crowned once hearts land (real SessionRecapHub.tsx: a
  // Crown+Heart panel above/within the list, shown only when leaderCount>0).
  recapPoems: [
    { reader: 'Sam', preview: 'the kettle forgets its own whistle' },
    { reader: 'Riya', preview: 'a raincoat folded like an apology', isFavorite: true },
    { reader: 'Jordan', preview: 'somewhere a dog is guarding nothing' },
    { reader: 'Priya', preview: 'the elevator hums a hymn no one wrote' },
    { reader: 'Bashō', preview: 'moonlight forgets to knock' },
  ],
  // sessionFavorites.leaderCount from the real query — 3 hearts in.
  favoriteLeaderCount: 3,
};

// ---------------------------------------------------------------------------
// Screens every option must implement. Corpus keys tell builders which
// player/poem set to use.
// ---------------------------------------------------------------------------
const SCREEN_ORDER = ['lobby-low', 'lobby-mid', 'lobby-max', 'write', 'recap-mid'];
const SCREEN_LABELS = {
  'lobby-low': 'Lobby · 1 player',
  'lobby-mid': 'Lobby · 5 players',
  'lobby-max': 'Lobby · 8 players',
  write: 'Write · chrome reuse',
  'recap-mid': 'Recap · 5 poems',
};
function screensFor(spec) {
  const keys = Object.keys(spec.screens || {});
  return SCREEN_ORDER.filter((s) => keys.includes(s)).concat(
    keys.filter((k) => !SCREEN_ORDER.includes(k))
  );
}

let currentOpt = null;
let currentScreen = 'lobby-low';
let currentMode = 'light';
const injected = new Set();

function parseHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return { opt: null, screen: null };
  const [opt, screen] = h.split('/');
  return { opt, screen: screen || null };
}

function applyTokens(el, mode) {
  const theme = window.THEMES[mode] || window.THEMES.light;
  Object.entries(theme.tokens).forEach(([key, value]) => {
    el.style.setProperty(`--${key}`, value);
  });
  el.dataset.labTheme = theme.id;
  el.dataset.labMode = mode;
}

// Walks the rendered screen and flags any element whose content overflows
// its own box without an explicit `data-scroll-exempt` reason. This is the
// zero-scroll law made mechanical: real evidence per option/screen/mode
// instead of eyeballing it.
function auditOverflow(root) {
  const overflows = [];
  root.querySelectorAll('.lab-overflow-flag').forEach((el) => {
    el.classList.remove('lab-overflow-flag');
  });
  const nodes = root.querySelectorAll('*');
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement) || node === root) return;
    const style = getComputedStyle(node);
    // Only elements acting as a scroll/clip container are candidates — an
    // ordinary block that merely happens to be tall is not "scroll."
    const isContainer =
      ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY) ||
      ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX);
    if (!isContainer) return;
    // Single-line truncation (ellipsis) is a deliberate, accepted pattern —
    // it is not the "must scroll to see this" bug the law targets.
    if (style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap') return;
    if (node.hasAttribute('data-scroll-exempt')) return;
    if (node.closest('[data-scroll-exempt]')) return;
    const overflowsY = node.scrollHeight - node.clientHeight > 1;
    const overflowsX = node.scrollWidth - node.clientWidth > 1;
    if (overflowsY || overflowsX) {
      node.classList.add('lab-overflow-flag');
      overflows.push(
        node.className
          ? String(node.className).replace(/\s*lab-overflow-flag\s*/, '').trim()
          : node.tagName.toLowerCase()
      );
    }
  });
  return overflows;
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
  applyTokens(stage, currentMode);
  stageWrap.appendChild(stage);
  shell.appendChild(stageWrap);

  const fn = spec.screens && spec.screens[screen];
  if (typeof fn === 'function') {
    try {
      // Fresh node per render so entrance animations replay.
      fn(stage, window.CORPUS);
      // Audit after layout settles.
      requestAnimationFrame(() => {
        const overflows = auditOverflow(stage);
        window.parent.postMessage(
          { type: 'lab002:audit', opt, screen, overflows },
          '*'
        );
      });
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
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'lab002:mode') return;
  currentMode = data.mode === 'dark' ? 'dark' : 'light';
  render();
});
