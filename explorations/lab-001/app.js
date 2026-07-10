// Lab-001 shell. Builds the registry sidebar from the lane modules'
// LANE_SPECS (loaded above), drives the iframe by hash, owns viewport
// presets + arrow-key nav + localStorage persistence.
/* global LANE_SPECS */

const SECTIONS = [
  {
    id: 'SPINE',
    label: 'The whole mobile game',
    round: 3,
    winner: null,
    note: 'Round 3: read mechanic corrected (whole poem at once, reading circle, no line-by-line). Direction: survivors synthesize into THEMES. Verdicts: .rounds/.',
  },
  {
    id: 'SELECTOR',
    label: 'Theme selector (new page)',
    round: 2,
    winner: 'ANTHRO-6',
    note: 'LOCKED: ANTHRO-6 Specimen. Roster consolidated to the top 10 themes (5 light / 5 dark).',
  },
];

// Composer-owned verdict state (kills; lane files purge these keys).
// R1: EMIL + SOFT lanes fully killed (files removed; snapshots in .rounds).
// R2 dedupe: HALL-5 reskin of TASTE-4. R2 verdicts: TASTE-4 killed.
// R3 verdicts: selector locked to ANTHRO-6 (Specimen); TASTE-5/BRUT-5/HALL-6
// killed as section losers. Done-button copy normalized to plain "Done".
const KILLED = new Set(['ANTHRO-1', 'ANTHRO-2', 'TASTE-1', 'TASTE-2', 'TASTE-4', 'BRUT-3', 'HALL-2', 'HALL-5', 'TASTE-5', 'BRUT-5', 'HALL-6']);

const LANE_ORDER = ['baseline', 'anthro', 'emil', 'taste', 'soft', 'brut', 'hall'];
const LANE_BADGES = {
  baseline: { label: 'SHIPPED', hue: '#8a8580' },
  anthro: { label: 'ANTHRO', hue: '#c96f2e' },
  emil: { label: 'EMIL', hue: '#3f7fc1' },
  taste: { label: 'TASTE', hue: '#7a5fc4' },
  soft: { label: 'SOFT', hue: '#b8508a' },
  brut: { label: 'BRUT', hue: '#4e4e4e' },
  hall: { label: 'HALL', hue: '#3d8f5f' },
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

let selected =
  localStorage.getItem('lab001.selected') && specs[localStorage.getItem('lab001.selected')]
    ? localStorage.getItem('lab001.selected')
    : optionIds[0];

function select(id) {
  selected = id;
  localStorage.setItem('lab001.selected', id);
  frame.contentWindow.location.hash = id;
  document.querySelectorAll('#sidebar .opt').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

function buildSidebar() {
  SECTIONS.forEach((SECTION) => {
    const ids = optionIds.filter(
      (id) => (specs[id].section || 'SPINE') === SECTION.id
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
  localStorage.setItem('lab001.vp', vp);
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

document.querySelectorAll('.viewport-controls button').forEach((b) => {
  b.addEventListener('click', () => setViewport(b.dataset.vp));
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
  setViewport(localStorage.getItem('lab001.vp') || '390x844');
});

buildSidebar();
frame.addEventListener('load', () => select(selected));
setViewport(localStorage.getItem('lab001.vp') || '390x844');
