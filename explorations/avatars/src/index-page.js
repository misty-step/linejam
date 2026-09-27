// The review index (decision first) and the Pen Pals character sheet.
import { renderAvatar, sizing, MODE, INK, contrast } from './engine.js';
import {
  shell,
  duo,
  stack,
  lineup,
  ladder,
  grayscale,
  contexts,
  roster,
  reading,
  picker,
  moodGrid,
  home,
  esc,
  MOOD_NAME,
} from './pages.js';
import { CRITIQUE, DIVERGENCE, SYNTHESIS, REVISION } from './critique.js';

const A = (cast, id, size, mode, extra = {}) =>
  renderAvatar(cast, id, { size, mode, ...extra });
const KIND = {
  quill: 'Owl',
  dusk: 'Luna moth',
  doodle: 'Snail',
  rhyme: 'Fox',
  haiku: 'Frog',
  hush: 'Bunny',
  sonnet: 'Sheep',
  ode: 'Axolotl',
};
const sec = (id, title, inner) =>
  `<section id="${id}" class="sec"><h2>${title}</h2>${inner}</section>`;
const strip = (cast, mode, size) =>
  `<div class="strip t-${mode}">${cast.chars.map((c) => A(cast, c.id, size, mode)).join('')}</div>`;

export function indexPage({ today, directions, refined, nav }) {
  const all = [refined, ...directions, today];
  const rows = all
    .map((cast) => {
      const c = CRITIQUE[cast.id];
      const href =
        cast.id === refined.id ? 'refined.html' : `directions/${cast.id}.html`;
      const verdict =
        cast.id === refined.id ? 'Recommended' : (c?.verdict ?? '');
      return `<article class="dir"><div><h3><a href="${href}">${esc(cast.name)}</a></h3><p><span class="tag${cast.id === refined.id ? ' keep' : ''}">${esc(cast.range)}</span> ${esc(verdict)}</p><p style="margin-top:6px">${esc(cast.stance)}</p></div><div class="strips">${strip(cast, 'light', 44)}${strip(cast, 'dark', 44)}${strip(cast, 'light', 24)}${strip(cast, 'dark', 24)}</div></article>`;
    })
    .join('');
  const crit = directions
    .map((cast) => {
      const c = CRITIQUE[cast.id];
      return `<article><h3><a href="directions/${cast.id}.html">${esc(cast.name)}</a> <span class="tag${c.verdict.startsWith('Spine') ? ' keep' : ''}">${esc(c.verdict)}</span></h3><dl><dt>Optimizes</dt><dd>${c.optimizes}</dd><dt>Sacrifices</dt><dd>${c.sacrifices}</dd><dt>Keep</dt><dd>${c.keep}</dd></dl></article>`;
    })
    .join('');
  const grafts = SYNTHESIS.grafts
    .map(
      ([from, what, fixes]) =>
        `<tr><th scope="row">${from}</th><td>${what}</td><td>${fixes}</td></tr>`
    )
    .join('');
  const dropped = SYNTHESIS.dropped
    .map(
      ([what, why]) => `<tr><th scope="row">${what}</th><td>${why}</td></tr>`
    )
    .join('');
  const body = `
<section id="intro" class="sec">
<h1 class="display">A new cast for Linejam</h1>
<p class="lede">Six directions for the player characters, drawn by hand as SVG and set into the Tucked In screens at the sizes the game really uses, in Light and Dark. One critique, one recombined cast, one revision pass. Nothing here is in the app yet.</p>
<div class="decide">
<h2 style="margin-top:0">Your pick</h2>
<p><b>Recommended: Pen Pals.</b> Eight late-evening creatures with a writer's streak: one body, one face and six moods, so the character sleeps when its player is away and reads aloud on the lamp. It is the Small Hours direction, revised against the critique and checked at 24 px, in grayscale and on the peach lamp.</p>
<ol>
<li><b>Pen Pals as drawn.</b> I build it into the app next, on this branch, and walk it in both modes before anything ships.</li>
<li><b>Pen Pals with changes.</b> Name the characters to swap, recolor or rename; names are the cheapest part to change.</li>
<li><b>A different direction.</b> Any board below can be refined the same way; Same Eight is the only one with no data work.</li>
</ol>
<p class="note">One build question comes with the pick: the new names need new stored ids, which means a widen, backfill and narrow migration for <code>roomPlayers.avatarId</code>. Keeping today's eight ids as hidden keys avoids the migration but leaves <code>pip</code> meaning Quill forever. I recommend the migration.</p>
</div>
${duo((m) => lineup(refined, m, 72, false))}
<p><a href="refined.html">Open the Pen Pals sheet</a>: moods, props, small-size drawing, before and after, and build notes.</p>
</section>
${sec('compare', 'Every direction at roster and byline size', `<p class="note">Each row shows 44 px (the round roster) and 24 px (bylines and the Lines by chips), in Light and Dark. Open a direction for its full board.</p><div class="compare">${rows}</div>`)}
${sec('critique', 'Critique', `<p class="note">Judged against the job: make a room of friends feel present at every size without competing with the poem. No scores.</p><div class="crit">${crit}</div>`)}
${sec('synthesis', 'How Pen Pals was put together', `<p><b>Spine.</b> ${SYNTHESIS.spine}</p><div class="scroll"><table class="spec"><thead><tr><th>From</th><th>Graft</th><th>Fixes</th></tr></thead><tbody>${grafts}</tbody></table></div><h3>Dropped</h3><div class="scroll"><table class="spec"><tbody>${dropped}</tbody></table></div>`)}
${sec('method', 'How this was made', `<p>Every direction is hand-authored SVG rendered by one engine (<code>explorations/avatars/src/engine.js</code> on <code>phaedrus/linejam-avatar-cast</code>), so optical sizing, the sticker edge, faces and props are identical across boards and the comparison is about the characters. The screens are fragments of the Tucked In synthesis built from the product tokens and the shipped DynaPuff and Nunito Sans files. No image generation was used.</p><p class="note">Limits: these are review pages, not the app. Captures came from the project workspace Chromium at desktop and phone widths; no physical phone, no screen reader, and no player has picked a character yet. Contrast ratios on the Pen Pals sheet are computed from the hex values, not measured on a screen.</p>`)}
`;
  return shell({ title: 'A new cast for Linejam', body, nav });
}

const ratio = (a, b) => `${contrast(a, b).toFixed(1)}:1`;

export function refinedPage({ refined, first, today, nav }) {
  const bios = refined.chars
    .map(
      (c) =>
        `<article>${A(refined, c.id, 72, 'light')}<div><h3>${esc(c.name)}</h3><p>${KIND[c.id]}. ${esc(c.line)}</p></div></article>`
    )
    .join('');
  const pairs = (mode) =>
    `<div class="pairs">${refined.chars
      .map(
        (c) =>
          `<div><span class="two">${A(refined, c.id, 44, mode, { px: 24 })}${A(refined, c.id, 24, mode)}</span><span class="two">${A(refined, c.id, 44, mode, { px: 32 })}${A(refined, c.id, 32, mode)}</span>${esc(c.name)}</div>`
      )
      .join(
        ''
      )}</div><p class="note" style="margin-top:10px">Left of each pair: the 44 px drawing shrunk. Right: the small drawing, with heavier ink, bigger eyes and fewer details.</p>`;
  const beforeAfter = (mode) =>
    `<div class="frames two">${[
      ['Today', today],
      ['Pen Pals', refined],
    ]
      .map(([name, cast]) =>
        roster(cast, mode).replace(
          'Round roster with props',
          `${name}: round roster`
        )
      )
      .join('')}${[
      ['Today', today],
      ['Pen Pals', refined],
    ]
      .map(([name, cast]) =>
        reading(cast, mode).replace(
          'Reading circle, the reader on the lamp',
          `${name}: reading circle`
        )
      )
      .join('')}${[
      ['Today', today],
      ['Pen Pals', refined],
    ]
      .map(([name, cast]) =>
        picker(cast, mode).replace(
          'Character sheet',
          `${name}: character sheet`
        )
      )
      .join('')}</div>`;
  const revision = REVISION.map(
    ([who, saw, change]) =>
      `<tr><th scope="row">${who}</th><td>${saw}</td><td>${change}</td></tr>`
  ).join('');
  const palette = refined.chars
    .map(
      (c) =>
        `<tr><th scope="row">${esc(c.name)}</th><td>${KIND[c.id]}</td><td><span style="display:inline-block;width:18px;height:18px;border-radius:6px;vertical-align:-4px;margin-right:8px;background:${c.color};box-shadow:inset 0 0 0 1px rgba(57,35,78,.35)"></span><code>${c.color}</code></td><td>${ratio(INK, c.color)}</td><td>${ratio(c.color, MODE.dark.page)}</td><td>${esc(c.line)}</td></tr>`
    )
    .join('');
  const sizes = [24, 32, 44, 56, 72, 96, 128]
    .map((s) => {
      const l = sizing(s, 'light');
      const d = sizing(s, 'dark');
      const px = (u) => ((u * s) / 100).toFixed(2);
      return `<tr><th scope="row">${s}</th><td>${l.v}</td><td>${px(l.ink)}</td><td>${px(l.edge)} / ${px(d.edge)}</td></tr>`;
    })
    .join('');
  const moodUse = [
    [
      'idle',
      'Lobby gathering, character sheet, entry, bylines, the recap.',
      'Crown for the host.',
    ],
    ['writing', 'Round roster while the player is writing.', 'Pencil.'],
    [
      'tucked',
      'Round roster once the line is accepted; the waiting hero.',
      'Sealed note.',
    ],
    ['away', 'Round roster while the player is away.', 'Moon.'],
    ['reading', 'The reader on the lamp.', 'Open book.'],
    [
      'watching',
      'Late joiners and spectators, outlined in the text color.',
      'None.',
    ],
  ]
    .map(
      ([m, where, prop]) =>
        `<tr><th scope="row">${MOOD_NAME[m]}</th><td>${where}</td><td>${prop}</td></tr>`
    )
    .join('');
  const d = DIVERGENCE[refined.id];
  const body = `
<section id="intro" class="sec">
<h1>Pen Pals <span class="tag keep">Recommended</span></h1>
<p class="lede">${esc(refined.stance)}</p>
<p>${d.claim}</p>
<table class="spec"><tbody>${d.rules.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>
</section>
${sec('try', 'Try one on', `<p class="note">Pick a direction, a character and a status. The preview redraws with the same engine as every board, so any direction can be tried in the Pen Pals screens.</p><div id="try-root" class="try"><noscript><p>The preview needs JavaScript; every state is also drawn below.</p></noscript></div>`)}
${sec('cast', 'The cast', `${duo((m) => lineup(refined, m, 112, false))}<div class="bio">${bios}</div>`)}
${sec('sizes', 'At the sizes the game uses', `<p class="note">24 bylines and chips, 32 compact rows, 44 roster rows, 56 the character sheet; then the small sizes on a white card and on the peach lamp. The lobby's 72 and the heroes' 112 to 120 are in the screens below.</p>${duo((m) => ladder(refined, m))}`)}
${sec('game', 'In the game', `<p class="note">Fragments of the Tucked In screens at true size, with the props and statuses the synthesis already uses.</p>${contexts(refined, [home])}`)}
${sec('moods', 'Moods', `<p class="note">The same eyes and mouth, rearranged. Every mood sits beside its written status; the face never carries the state alone.</p>${stack((m) => moodGrid(refined, m))}<div class="scroll"><table class="spec"><thead><tr><th>Mood</th><th>Where</th><th>Prop</th></tr></thead><tbody>${moodUse}</tbody></table></div>`)}
${sec('small', 'Small sizes are drawn, not shrunk', duo(pairs))}
${sec('gray', 'Without color', `<p class="note">Silhouettes carry the cast apart when color cannot.</p>${duo((m) => grayscale(refined, m))}`)}
${sec('dupes', 'Duplicates are allowed', `<p class="note">Juniper and Wren picked the same character; names and statuses keep them apart.</p>${duo((m) => roster(refined, m, true))}`)}
${sec('before', 'Before and after', `<h3>Today and Pen Pals in the same screens</h3>${['light', 'dark'].map((m) => `<p class="note" style="margin-top:12px">${m === 'light' ? 'Light' : 'Dark'}</p>${beforeAfter(m)}`).join('')}<h3>First pass and revision</h3><p class="note">The first recombination, then the revision after checking it at 24 px, in grayscale, on the lamp and for resemblance.</p>${duo((m) => `<p class="note">First pass</p>${lineup(first, m, 72, false)}<p class="note" style="margin-top:16px">Revised</p>${lineup(refined, m, 72, false)}`)}<div class="scroll"><table class="spec"><thead><tr><th>Character</th><th>What the check found</th><th>Change</th></tr></thead><tbody>${revision}</tbody></table></div>`)}
${sec(
  'spec',
  'Build notes',
  `
<h3>Palette</h3><div class="scroll"><table class="spec"><thead><tr><th>Name</th><th>Creature</th><th>Body</th><th>Ink on body</th><th>Body on Dark page</th><th>Character</th></tr></thead><tbody>${palette}</tbody></table></div>
<p class="note">Plum ink <code>#39234E</code> and the character colors stay the same in both modes; only the edge changes (<code>${MODE.light.edge}</code> in Light, <code>${MODE.dark.edge}</code> in Dark). No body uses lamp peach or the Tucked in mint. In Light the plum outline carries the silhouette (${ratio(INK, MODE.light.page)} on the page, where bodies are only ${ratio(
    refined.chars.reduce(
      (a, c) =>
        contrast(c.color, MODE.light.page) < contrast(a, MODE.light.page)
          ? c.color
          : a,
      refined.chars[0].color
    ),
    MODE.light.page
  )} at their faintest). In Dark the drawn edge does (${ratio(MODE.dark.edge, MODE.dark.page)}), because plum ink is ${ratio(INK, MODE.dark.page)} on the dark page. On the lamp the ink is ${ratio(INK, MODE.light.lamp)} in Light and ${ratio(INK, MODE.dark.lamp)} in Dark. WCAG 2 ratios, computed from these hex values.</p>
<h3>Construction</h3>
<ul>
<li>One 100 unit box. Bodies sit on a shared keyline (about 62 units wide, feet on the baseline) so the cast has equal weight in a row.</li>
<li>One face for everyone: oval eyes, a small mouth, cheeks above 32 px; a highlight in the eyes from 96 px.</li>
<li>Antennae, stalks and whiskers are never thinner than the outline.</li>
<li>The sticker edge is drawn into the art as a light stroke behind the ink, not a CSS filter.</li>
<li>The sealed note and the open book are folded paper with one shaded facet, like the game's own note. Every prop lives in the same box, anchored per character: crown on the head, pencil and note at the hand, book in front, moon in the sky corner.</li>
</ul>
<h3>Optical sizes</h3><div class="scroll"><table class="spec"><thead><tr><th>Size (px)</th><th>Drawing</th><th>Ink (px)</th><th>Edge Light / Dark (px)</th></tr></thead><tbody>${sizes}</tbody></table></div>
<h3>Ids and stored data</h3>
<p><code>roomPlayers.avatarId</code> is validated against <code>AVATAR_IDS</code>. New ids (<code>quill</code>, <code>dusk</code>, <code>doodle</code>, <code>rhyme</code>, <code>haiku</code>, <code>hush</code>, <code>sonnet</code>, <code>ode</code>) need the widen, backfill and narrow sequence in <code>docs/convex-migrations.md</code>. The alternative keeps the eight stored ids as hidden keys with a permanent name map. Recommended: the migration.</p>
<h3>Where it lands</h3>
<ul>
<li><code>lib/avatars.ts</code>: ids, names, character colors.</li>
<li><code>components/ui/Avatar.tsx</code>: the drawings, optical size by the existing size prop, mood and prop props, the drawn edge.</li>
<li><code>components/AvatarPicker.tsx</code>, <code>Lobby.tsx</code>, <code>WaitingScreen.tsx</code>, <code>RevealPhase.tsx</code>, <code>PoemDisplay.tsx</code>, <code>SessionRecapHub.tsx</code>, <code>app/page.tsx</code>: mood and prop per status where the Tucked In screens use them.</li>
<li><code>convex/lib/avatars.ts</code> and a migration, per the ids decision.</li>
<li><code>DESIGN.md</code>: replace the paragraph on the eight original SVGs with the Pen Pals rules.</li>
</ul>
<p class="note">Not decided here: motion (the synthesis owns it; the cast adds no idle animation) and whether the recap or an arrival ever uses the fold.</p>
`
)}
`;
  return shell({
    title: 'Pen Pals: Linejam cast',
    body,
    nav,
    script: 'js/try.js',
  });
}
