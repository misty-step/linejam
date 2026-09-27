// "Try one on": pick a direction, a character and a status; the preview redraws with the
// same engine that renders every board.
import { renderAvatar } from './engine.js';
import penPals from './casts/pen-pals.js';
import smallHours from './casts/small-hours.js';
import marks from './casts/marks.js';
import sameEight from './casts/same-eight.js';
import paperFolk from './casts/paper-folk.js';
import kitchenTable from './casts/kitchen-table.js';
import foldedFigures from './casts/folded-figures.js';
import today from './casts/today.js';

const CASTS = [
  penPals,
  smallHours,
  marks,
  sameEight,
  paperFolk,
  kitchenTable,
  foldedFigures,
  today,
];
const STATUS = [
  { id: 'idle', label: 'At rest', mood: 'idle', text: 'In the lobby' },
  { id: 'host', label: 'Host', mood: 'idle', prop: 'crown', text: 'Host' },
  {
    id: 'writing',
    label: 'Writing',
    mood: 'writing',
    prop: 'pencil',
    text: 'Writing',
  },
  {
    id: 'tucked',
    label: 'Tucked in',
    mood: 'tucked',
    prop: 'note',
    text: 'Tucked in',
    pill: true,
    ack: 'Tucked into the poem.',
  },
  { id: 'away', label: 'Away', mood: 'away', prop: 'moon', text: 'Away' },
  {
    id: 'reading',
    label: 'Reading',
    mood: 'reading',
    prop: 'book',
    text: 'Reading now',
    pill: 'turn',
    lamp: true,
    ack: 'Your turn to read.',
  },
  {
    id: 'watching',
    label: 'Watching',
    mood: 'watching',
    outlined: true,
    text: 'Watching',
  },
];
const root = document.getElementById('try-root');
const state = { cast: 0, char: 0, status: 3, mode: 'light' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const button = (group, i, pressed, inner, label) =>
  `<button type="button" class="pick" data-group="${group}" data-i="${i}" aria-pressed="${pressed}"${label ? ` aria-label="${esc(label)}"` : ''}>${inner}</button>`;

function render() {
  const cast = CASTS[state.cast];
  const ch = cast.chars[state.char % cast.chars.length];
  const st = STATUS[state.status];
  const m = state.mode;
  const av = (size, extra = {}) =>
    renderAvatar(cast, ch.id, {
      size,
      mode: m,
      mood: st.mood,
      prop: st.prop,
      outlined: st.outlined,
      hollow: 'var(--bg)',
      ...extra,
    });
  const hero = st.lamp
    ? `<span class="lamp" style="width:150px;height:150px">${av(112)}</span>`
    : av(120);
  const status = st.pill
    ? `<span class="pill${st.pill === 'turn' ? ' turn' : ''}">${st.text}</span>`
    : `<span class="status">${st.text}</span>`;
  root.innerHTML = `
<div class="try-controls">
  <fieldset><legend>Direction</legend><div class="picks">${CASTS.map((c, i) => button('cast', i, i === state.cast, esc(c.name))).join('')}</div></fieldset>
  <fieldset><legend>Your character</legend><div class="picks chars">${cast.chars
    .map((c, i) =>
      button(
        'char',
        i,
        i === state.char % cast.chars.length,
        `${renderAvatar(cast, c.id, { size: 32, mode: 'light' })}<span>${esc(c.name)}</span>`
      )
    )
    .join('')}</div></fieldset>
  <fieldset><legend>Status</legend><div class="picks">${STATUS.map((s, i) => button('status', i, i === state.status, s.label)).join('')}</div></fieldset>
  <fieldset><legend>Appearance</legend><div class="picks">${['light', 'dark'].map((mode) => button('mode', mode, mode === m, mode === 'light' ? 'Light' : 'Dark')).join('')}</div></fieldset>
</div>
<div class="try-preview frag t-${m}" aria-live="polite">
  <p class="cap">${esc(cast.name)}: ${esc(ch.name)}, ${esc(st.label.toLowerCase())}</p>
  <div class="hero${st.outlined ? ' outlined' : ''}">${hero}${st.ack ? `<p class="ack">${st.ack}</p>` : ''}</div>
  <ul class="roster"><li><span class="av${st.outlined ? ' outlined' : ''}">${av(44)}</span><span class="who">Juniper <span class="you">(you)</span></span>${status}</li></ul>
  <div class="sheet" style="margin-top:12px"><div class="byline">${renderAvatar(cast, ch.id, { size: 24, mode: m })}Read by Juniper</div><div class="chips"><span class="chip">${renderAvatar(cast, ch.id, { size: 24, mode: m })}Juniper (you)</span></div></div>
  <div class="try-sizes">${[24, 32, 44, 56, 72].map((s) => `<span>${renderAvatar(cast, ch.id, { size: s, mode: m })}<small>${s}</small></span>`).join('')}</div>
</div>`;
}

root.addEventListener('click', (e) => {
  const b = e.target.closest('button.pick');
  if (!b) return;
  const { group, i } = b.dataset;
  if (group === 'mode') state.mode = i;
  else state[group] = Number(i);
  if (group === 'cast')
    state.char = Math.min(state.char, CASTS[state.cast].chars.length - 1);
  render();
  root
    .querySelector(`button.pick[data-group="${group}"][data-i="${i}"]`)
    ?.focus();
});
render();
