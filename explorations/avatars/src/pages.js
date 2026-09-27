// Static pages for the cast review: every direction rendered in the same real contexts.
import { renderAvatar, MOODS } from './engine.js';

export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const A = (cast, id, size, mode, extra = {}) =>
  renderAvatar(cast, id, { size, mode, ...extra });
const MODES = ['light', 'dark'];
const MODE_NAME = { light: 'Light', dark: 'Dark' };

export function duo(render, cls = '') {
  return `<div class="duo ${cls}">${MODES.map((m) => `<div class="panel t-${m}"><p class="mode">${MODE_NAME[m]}</p>${render(m)}</div>`).join('')}</div>`;
}
const frag = (cap, body, mode) =>
  `<div class="frag t-${mode}"><p class="cap">${cap}</p>${body}</div>`;

// The sample room from the polish gallery.
const PEOPLE = [
  { name: 'Juniper', you: true, host: true, i: 0 },
  { name: 'Wren', i: 1 },
  { name: 'Basil', i: 2 },
  { name: 'Marguerite Okonkwo-Castellanos', short: 'Marguerite', i: 3 },
  { name: 'Pim', i: 4, late: true },
];
const pick = (cast, i) => cast.chars[i % cast.chars.length];

export function lineup(cast, mode, size = 96, lines = true) {
  return `<div class="lineup">${cast.chars
    .map(
      (c) =>
        `<figure>${A(cast, c.id, size, mode, { label: `${c.name}` })}<figcaption>${esc(c.name)}${lines && c.line ? `<span>${esc(c.line)}</span>` : ''}</figcaption></figure>`
    )
    .join('')}</div>`;
}

export function ladder(cast, mode, sizes = [24, 32, 44, 56]) {
  const rung = (s, cls = '') =>
    `<div class="rung ${cls}"><b>${s}</b>${cast.chars.map((c) => A(cast, c.id, s, mode, { hollow: 'var(--av-hollow)' })).join('')}</div>`;
  return `<div class="ladder">${sizes.map((s) => rung(s)).join('')}<div class="on-surface">${[24, 32, 44].map((s) => rung(s)).join('')}</div><div class="on-lamp">${rung(44)}</div></div>`;
}

export function grayscale(cast, mode) {
  return `<div class="ladder gray">${[24, 32, 44].map((s) => `<div class="rung"><b>${s}</b>${cast.chars.map((c) => A(cast, c.id, s, mode)).join('')}</div>`).join('')}</div>`;
}

export function entry(cast, mode) {
  const c = pick(cast, 0);
  return frag(
    'Entry, next to the pen name',
    `<p class="label">Your pen name</p><div class="entry-row"><div class="input">Juniper</div><span class="trigger">${A(cast, c.id, 46, mode)}</span></div><p class="help">Friends see this name next to your character.</p>`,
    mode
  );
}

export function picker(cast, mode) {
  const tiles = cast.chars
    .map(
      (c, i) =>
        `<div class="tile${i === 0 ? ' sel' : ''}">${A(cast, c.id, 56, mode, { hollow: 'var(--surface)' })}<span>${esc(c.name)}</span></div>`
    )
    .join('');
  return frag(
    'Character sheet',
    `<div class="sheet"><p class="sheet-title">Choose your character</p><div class="picker">${tiles}</div></div>`,
    mode
  );
}

export function gathering(cast, mode) {
  const cells = PEOPLE.slice(0, 4)
    .map((p) => {
      const c = pick(cast, p.i);
      return `<div>${A(cast, c.id, 72, mode, p.host ? { prop: 'crown' } : {})}<span class="who">${esc(p.name)}${p.you ? ' <span class="you">(you)</span>' : ''}</span>${p.host ? '<span class="role">Host</span>' : ''}</div>`;
    })
    .join('');
  return frag(
    'Lobby gathering',
    `<div class="row-head"><b>Players</b><span>4 of 8</span></div><div class="gather">${cells}</div>`,
    mode
  );
}

const STATES = [
  { i: 0, status: 'Tucked in', pill: true, prop: 'note', mood: 'tucked' },
  { i: 1, status: 'Tucked in', pill: true, prop: 'note', mood: 'tucked' },
  { i: 2, status: 'Writing', prop: 'pencil', mood: 'writing' },
  { i: 3, status: 'Away', prop: 'moon', mood: 'away' },
  {
    i: 4,
    status: 'Watching',
    outlined: true,
    mood: 'watching',
    sub: 'Joined late. Plays the next game.',
  },
];

export function roster(cast, mode, dupes = false) {
  const rows = STATES.map((s) => {
    const p = PEOPLE[s.i];
    const c = pick(cast, dupes && s.i === 1 ? 0 : p.i);
    const av = A(cast, c.id, 44, mode, {
      prop: s.prop,
      mood: s.mood,
      outlined: s.outlined,
      hollow: 'var(--bg)',
    });
    return `<li><span class="av${s.outlined ? ' outlined' : ''}">${av}</span><span class="who">${esc(p.name)}${p.you ? ' <span class="you">(you)</span>' : ''}${s.sub ? `<small>${s.sub}</small>` : ''}</span>${s.pill ? `<span class="pill">${s.status}</span>` : `<span class="status">${s.status}</span>`}</li>`;
  }).join('');
  return frag(
    dupes ? 'Two players, same character' : 'Round roster with props',
    `<div class="row-head"><b>This round</b><span>2 of 4 lines in</span></div><ul class="roster">${rows}</ul>`,
    mode
  );
}

export function waiting(cast, mode) {
  const c = pick(cast, 0);
  return frag(
    'Waiting, your character holds your note',
    `<div class="hero">${A(cast, c.id, 120, mode, { prop: 'note', mood: 'tucked' })}<p class="ack">Tucked into the poem.</p><p class="sub">You wrote \u201cand nobody asked the moon\u201d</p></div>`,
    mode
  );
}

export function reading(cast, mode) {
  const r = pick(cast, 3);
  const order = [
    { i: 3, poem: 1, status: 'Reading now', turn: true },
    { i: 2, poem: 2, status: 'Up next' },
    { i: 1, poem: 3, status: '3rd' },
    { i: 0, poem: 4, status: '4th' },
  ]
    .map((o) => {
      const p = PEOPLE[o.i];
      const c = pick(cast, p.i);
      const av = o.turn
        ? `<span class="lamp" style="width:52px;height:52px">${A(cast, c.id, 40, mode)}</span>`
        : A(cast, c.id, 40, mode);
      return `<li><span class="av">${av}</span><span class="who">${esc(p.name)}${p.you ? ' <span class="you">(you)</span>' : ''}<small>Poem ${o.poem}</small></span>${o.turn ? `<span class="pill turn">${o.status}</span>` : `<span class="status">${o.status}</span>`}</li>`;
    })
    .join('');
  return frag(
    'Reading circle, the reader on the lamp',
    `<div class="hero"><span class="lamp" style="width:150px;height:150px">${A(cast, r.id, 112, mode, { prop: 'book', mood: 'reading' })}</span><p class="listen">Listen.<br>Marguerite is reading Poem 1.</p></div><div class="row-head" style="margin-top:16px"><b>Reading order</b></div><ul class="roster">${order}</ul>`,
    mode
  );
}

export function poem(cast, mode) {
  const r = pick(cast, 3);
  const chips = PEOPLE.slice(0, 4)
    .map(
      (p) =>
        `<span class="chip">${A(cast, pick(cast, p.i).id, 24, mode)}${esc(p.short ?? p.name)}${p.you ? ' (you)' : ''}</span>`
    )
    .join('');
  return frag(
    'Poem sheet, byline and lines by',
    `<div class="sheet"><p class="sheet-title">Poem 1</p><div class="byline">${A(cast, r.id, 24, mode)}Read by Marguerite</div><p class="poem">Lanterns<br>hum softly<br>moths applaud politely<br>the kettle keeps secrets</p><p class="label">Lines by</p><div class="chips">${chips}</div></div>`,
    mode
  );
}

export function home(cast, mode) {
  const four = [0, 1, 2, 3]
    .map((i) => A(cast, pick(cast, i).id, 56, mode))
    .join('');
  return frag(
    'Home',
    `<div class="hero"><p class="ack" style="font-size:2rem">A little room for words.</p><div class="home-cast">${four}</div></div>`,
    mode
  );
}

export function contexts(cast, extra = []) {
  const set = [
    entry,
    picker,
    gathering,
    roster,
    waiting,
    reading,
    poem,
    ...extra,
  ];
  return MODES.map(
    (m) =>
      `<h3>${MODE_NAME[m]}</h3><div class="frames">${set.map((fn) => fn(cast, m)).join('')}</div>`
  ).join('');
}

export function moodGrid(cast, mode, size = 56) {
  const rows = MOODS.map(
    (mood) =>
      `<b>${MOOD_NAME[mood]}</b>${cast.chars.map((c) => `<span class="${mood === 'watching' ? 'outlined' : ''}">${A(cast, c.id, size, mode, { mood, outlined: mood === 'watching', hollow: 'var(--bg)' })}</span>`).join('')}`
  ).join('');
  return `<div class="scroll"><div class="moods">${rows}</div></div>`;
}
/** Both modes stacked at full width, for grids too wide to sit side by side. */
export function stack(render) {
  return MODES.map(
    (m) =>
      `<div class="panel t-${m}" style="margin:16px 0"><p class="mode">${MODE_NAME[m]}</p>${render(m)}</div>`
  ).join('');
}
export const MOOD_NAME = {
  idle: 'At rest',
  writing: 'Writing',
  tucked: 'Tucked in',
  away: 'Away',
  reading: 'Reading',
  watching: 'Watching',
};

export function critiqueBlock(c) {
  if (!c) return '';
  return `<div class="crit"><article><h3>Verdict <span class="tag${c.verdict.startsWith('Spine') || c.verdict.startsWith('Survives') ? ' keep' : ''}">${esc(c.verdict)}</span></h3><dl>
    <dt>Optimizes</dt><dd>${c.optimizes}</dd>
    <dt>Sacrifices</dt><dd>${c.sacrifices}</dd>
    <dt>Wins for</dt><dd>${c.wins}</dd>
    <dt>Fails when</dt><dd>${c.fails}</dd>
    <dt>Keep</dt><dd>${c.keep}</dd></dl></article></div>`;
}

export function shell({ title, body, depth = 0, nav, script = '' }) {
  const up = depth ? '../' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${up}style.css">
</head>
<body>
<div class="page">
<header class="top"><a class="wordmark" href="${up || './'}">Linejam cast</a><nav class="crumbs" aria-label="Pages">${nav(up)}</nav></header>
<main>
${body}
</main>
</div>
${script ? `<script type="module" src="${up}${script}"></script>` : ''}
</body>
</html>
`;
}
