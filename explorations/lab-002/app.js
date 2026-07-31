// Lab-002 shell. Builds the registry sidebar from the lane modules'
// LANE_SPECS (loaded above), drives the iframe by hash, owns viewport
// presets, light/dark mode toggle, arrow-key nav, localStorage persistence,
// and reads the frame's zero-scroll audit result into the readout chip.
/* global LANE_SPECS */

const SECTIONS = [
  {
    id: 'FRAME',
    label: 'Room frame: chrome + roster + action zone',
    round: 1,
    winner: null,
    note:
      'Fixed: real Linejam tokens (Kenya light / Aloud dark), DESIGN.md laws, brand voice. ' +
      'Varying: how room identity, invite, roster, and the primary CTA compose so every ' +
      'capability fits one viewport with zero incidental scroll. Every option renders ' +
      'Lobby at 1/5/8 players, Write (chrome reuse), and the Session Recap (5 poems) — ' +
      'the second worst offender (no persistent action zone today).',
  },
];

// Composer-owned verdict state (kills; lane files purge these keys).
const KILLED = new Set([]);

const LANE_ORDER = [
  'baseline',
  'dammy',
  'taste',
  'min',
  'brut',
  'swiss',
  'redesign',
];
const LANE_BADGES = {
  baseline: { label: 'SHIPPED', hue: '#8a8580' },
  dammy: { label: 'DAMMYJAY', hue: '#3f7fc1' },
  taste: { label: 'TASTE', hue: '#7a5fc4' },
  min: { label: 'MINIMAL', hue: '#4e4e4e' },
  brut: { label: 'BRUTALIST', hue: '#c96f2e' },
  swiss: { label: 'SWISS', hue: '#b8508a' },
  redesign: { label: 'REDESIGN', hue: '#3d8f5f' },
};

const specs = window.LANE_SPECS || {};
const optionIds = Object.keys(specs)
  .filter((id) => !KILLED.has(id))
  .sort((a, b) => {
    const la = LANE_ORDER.indexOf(specs[a].lane);
    const lb = LANE_ORDER.indexOf(specs[b].lane);
    return la !== lb ? la - lb : a.localeCompare(b, undefined, { numeric: true });
  });

const frame = document.getElementById('frame');
const sidebar = document.getElementById('sidebar');
const holder = document.getElementById('frame-holder');
const readout = document.getElementById('vp-readout');
const auditReadout = document.getElementById('audit-readout');

let selected =
  localStorage.getItem('lab002.selected') && specs[localStorage.getItem('lab002.selected')]
    ? localStorage.getItem('lab002.selected')
    : optionIds[0];
let mode = localStorage.getItem('lab002.mode') || 'light';

function select(id) {
  selected = id;
  localStorage.setItem('lab002.selected', id);
  frame.contentWindow.location.hash = id;
  document.querySelectorAll('#sidebar .opt').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

function buildSidebar() {
  SECTIONS.forEach((SECTION) => {
    const ids = optionIds.filter(
      (id) => (specs[id].section || 'FRAME') === SECTION.id
    );
    if (!ids.length) return;
    const section = document.createElement('section');
    const head = document.createElement('div');
    head.className = 'section-head';
    const baseCount = ids.filter((id) => specs[id].lane === 'baseline').length;
    head.innerHTML = `
      <h2>${SECTION.label}</h2>
      <p class="round">round ${SECTION.round}${SECTION.winner ? ` · winner: ${SECTION.winner}` : ' · no winner yet'}</p>
      <p class="note">${SECTION.note}</p>
      <p class="count">${ids.length - baseCount} candidates${baseCount ? ' + baseline' : ''}</p>`;
    section.appendChild(head);

    ids.forEach((id) => {
      const spec = specs[id];
      const badge = LANE_BADGES[spec.lane] || { label: spec.lane, hue: '#888' };
      const el = document.createElement('button');
      el.className = 'opt';
      el.dataset.id = id;
      el.innerHTML = `
        <span class="opt-id">${id}</span>
        <span class="opt-title">${spec.title}</span>
        <span class="badge" style="--hue:${badge.hue}">${badge.label}</span>
        <span class="move">${spec.move || ''}</span>`;
      el.addEventListener('click', () => select(id));
      section.appendChild(el);
    });
    sidebar.appendChild(section);
  });
}

// Viewport presets: sizes larger than the stage scale down via transform.
function setViewport(vp) {
  localStorage.setItem('lab002.vp', vp);
  document.querySelectorAll('.viewport-controls button').forEach((b) => {
    b.classList.toggle('active', b.dataset.vp === vp);
  });
  const stage = document.getElementById('stage');
  const avail = { w: stage.clientWidth - 32, h: stage.clientHeight - 32 };
  if (vp === 'fit') {
    holder.style.width = '100%';
    holder.style.height = '100%';
    holder.style.transform = 'none';
    readout.textContent = 'fit';
    return;
  }
  const [w, h] = vp.split('x').map(Number);
  const scale = Math.min(1, avail.w / w, avail.h / h);
  holder.style.width = `${w}px`;
  holder.style.height = `${h}px`;
  holder.style.transform = `scale(${scale})`;
  readout.textContent = `${w}×${h}${scale < 1 ? ` @ ${Math.round(scale * 100)}%` : ''}`;
}

function setMode(nextMode) {
  mode = nextMode;
  localStorage.setItem('lab002.mode', mode);
  document.querySelectorAll('.theme-controls button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  frame.contentWindow.postMessage({ type: 'lab002:mode', mode }, '*');
}

document.querySelectorAll('.viewport-controls button').forEach((b) => {
  b.addEventListener('click', () => setViewport(b.dataset.vp));
});
document.querySelectorAll('.theme-controls button').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const i = optionIds.indexOf(selected);
  const next =
    e.key === 'ArrowDown'
      ? optionIds[Math.min(optionIds.length - 1, i + 1)]
      : optionIds[Math.max(0, i - 1)];
  select(next);
  document
    .querySelector(`#sidebar .opt[data-id="${next}"]`)
    ?.scrollIntoView({ block: 'nearest' });
});

window.addEventListener('resize', () => {
  setViewport(localStorage.getItem('lab002.vp') || '390x844');
});

// Zero-scroll audit result posted up from the frame after every render.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'lab002:audit') return;
  if (!data.overflows || data.overflows.length === 0) {
    auditReadout.className = 'pass';
    auditReadout.textContent = `✓ zero incidental scroll — ${data.screen}`;
    return;
  }
  auditReadout.className = 'fail';
  auditReadout.textContent = `✗ ${data.overflows.length} unmarked overflow(s) on ${data.screen}: ${data.overflows.join(', ')}`;
});

buildSidebar();
frame.addEventListener('load', () => {
  select(selected);
  setMode(mode);
});
setViewport(localStorage.getItem('lab002.vp') || '390x844');
