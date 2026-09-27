// Static build of the cast review. Usage: bun explorations/avatars/build.js <out-dir>
import { mkdirSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shell,
  duo,
  stack,
  lineup,
  ladder,
  grayscale,
  contexts,
  critiqueBlock,
  roster,
  esc,
  moodGrid,
} from './src/pages.js';
import today from './src/casts/today.js';
import sameEight from './src/casts/same-eight.js';
import marks from './src/casts/marks.js';
import smallHours from './src/casts/small-hours.js';
import paperFolk from './src/casts/paper-folk.js';
import kitchenTable from './src/casts/kitchen-table.js';
import foldedFigures from './src/casts/folded-figures.js';
import penPalsFirst from './src/casts/pen-pals-v1.js';
import penPals from './src/casts/pen-pals.js';
import { CRITIQUE, DIVERGENCE } from './src/critique.js';
import { indexPage, refinedPage } from './src/index-page.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const out = process.argv[2];
if (!out) throw new Error('usage: bun build.js <out-dir>');

const DIRECTIONS = [
  sameEight,
  marks,
  smallHours,
  paperFolk,
  kitchenTable,
  foldedFigures,
];
const ALL = [today, ...DIRECTIONS];

mkdirSync(join(out, 'directions'), { recursive: true });
mkdirSync(join(out, 'fonts'), { recursive: true });
for (const f of [
  'dynapuff-600.ttf',
  'nunitosans-400.ttf',
  'nunitosans-600.ttf',
  'nunitosans-700.ttf',
  'dynapuff-OFL.txt',
  'nunitosans-OFL.txt',
]) {
  copyFileSync(join(repo, 'public', 'fonts', f), join(out, 'fonts', f));
}
copyFileSync(join(here, 'src', 'style.css'), join(out, 'style.css'));
// The try-on preview runs the same engine and casts in the browser.
mkdirSync(join(out, 'js', 'casts'), { recursive: true });
copyFileSync(join(here, 'src', 'engine.js'), join(out, 'js', 'engine.js'));
copyFileSync(join(here, 'src', 'try.js'), join(out, 'js', 'try.js'));
for (const f of readdirSync(join(here, 'src', 'casts')))
  copyFileSync(join(here, 'src', 'casts', f), join(out, 'js', 'casts', f));

const nav = (up) =>
  `<a href="${up || './'}">Overview</a><a href="${up}refined.html">Pen Pals</a><a href="${up}directions/today.html">Today</a>`;

const section = (id, title, inner) =>
  `<section id="${id}" class="sec"><h2>${title}</h2>${inner}</section>`;

function board(cast) {
  const d = DIVERGENCE[cast.id] ?? {};
  const c = CRITIQUE[cast.id];
  const body = `
<section id="intro" class="sec">
<h1>${esc(cast.name)} <span class="tag">${esc(cast.range)}</span></h1>
<p class="lede">${esc(cast.stance)}</p>
${d.claim ? `<p>${d.claim}</p>` : ''}
${d.rules ? `<table class="spec"><tbody>${d.rules.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>` : ''}
</section>
${section(
  'cast',
  'The cast',
  duo((m) => lineup(cast, m, 96))
)}
${section('sizes', 'At the sizes the game uses', `<p class="note">Rows are CSS pixels: 24 bylines and chips, 32 compact rows, 44 roster rows, 56 the character sheet. The last blocks repeat the small sizes on a white card and on the peach reading lamp; the lobby's 72 and the heroes' 112 to 120 are in the screens below.</p>${duo((m) => ladder(cast, m))}`)}
${section('game', 'In the game', `<p class="note">Fragments of the Tucked In screens at true size. Props and statuses come from the accepted synthesis; ${cast.moods === false ? 'this direction keeps one expression, so props carry every state.' : 'this direction also changes the face with the state.'}</p>${contexts(cast)}`)}
${cast.moods === false ? '' : section('moods', 'Moods', `<p class="note">The same eyes and mouth, rearranged. Watching is the outlined spectator.</p>${stack((m) => moodGrid(cast, m))}`)}
${section('gray', 'Without color', `<p class="note">Silhouette alone has to tell the cast apart; names still do the real work.</p>${duo((m) => grayscale(cast, m))}`)}
${section('dupes', 'Duplicates are allowed', `<p class="note">Juniper and Wren picked the same character. Names and statuses keep them apart.</p>${duo((m) => roster(cast, m, true))}`)}
${c ? section('critique', 'Critique', critiqueBlock(c)) : ''}
`;
  return shell({ title: `${cast.name}: Linejam cast`, body, depth: 1, nav });
}

for (const cast of ALL)
  writeFileSync(join(out, 'directions', `${cast.id}.html`), board(cast));
writeFileSync(
  join(out, 'refined.html'),
  refinedPage({ refined: penPals, first: penPalsFirst, today, nav })
);
writeFileSync(
  join(out, 'index.html'),
  indexPage({ today, directions: DIRECTIONS, refined: penPals, nav })
);
console.log(
  `built ${ALL.length} boards, the Pen Pals sheet and the index into ${out}`
);
