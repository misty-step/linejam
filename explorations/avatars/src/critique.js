// Divergence claims and the comparative critique. One source for the boards and the index.

const rules = (subject, construction, container, face, dark, color) => [
  ['Subject', subject],
  ['Construction', construction],
  ['Container', container],
  ['Face and state', face],
  ['Dark mode', dark],
  ['Color', color],
];

export const DIVERGENCE = {
  today: {
    claim:
      'The baseline, rendered through the same boards so every direction is judged against what players see now.',
    rules: rules(
      'Eight unrelated shapes: triangle, square, pebble, planet, radish, star, bolt, gem.',
      'One 2.5 unit stroke at every size; limbs are loose strokes beside the body.',
      'Free silhouette.',
      'Eight different faces; one expression each.',
      'Sticker edge added by the Tucked In synthesis.',
      'Three fills (mint, peach, lavender) shared by eight characters.'
    ),
  },
  'same-eight': {
    claim:
      'Differs from today only in craft: same names, ids and shape ideas, rebuilt on one face, one limb vocabulary, one tint each and optical sizing. The control for the other five.',
    rules: rules(
      "Today's eight: Pip, Moss, Pebble, Orbit, Sprout, Sunny, Ziggy, Plum.",
      'Filled shapes with attached arm and foot nubs; equal optical mass on one keyline.',
      'Free silhouette with a built-in sticker edge.',
      'One shared face (bean eyes, open smile, cheeks); one expression.',
      'Sticker edge drawn into the art, heavier at small sizes.',
      'Eight tints, one per character.'
    ),
  },
  marks: {
    claim:
      'Differs by subject and construction: the characters are punctuation, built from one chunky pen stroke like the DynaPuff wordmark, with eyes placed on the glyph instead of a body.',
    rules: rules(
      'Comma, ampersand, asterisk, tilde, pilcrow, parentheses, full stop, slash (how a line break is written when a poem is quoted).',
      'Monoline glyphs: one pen width, round ends, a single outline around every stroke.',
      'Free glyph; no body, no limbs.',
      'Dot eyes and a small smile; moods change the eyes.',
      'Sticker edge.',
      'Eight tints.'
    ),
  },
  'small-hours': {
    claim:
      'Differs by construction and behavior: one shared body with a feature kit (ears, antennae, shell, gills, tail), and a face that changes with the game state, so Away looks asleep instead of grinning.',
    rules: rules(
      'Late-evening creatures: owl, moth, snail, fox, frog, bunny, sheep, axolotl.',
      'One bean body and the same two feet for everyone; identity comes from what grows out of it.',
      'Free silhouette with a built-in sticker edge.',
      'Shared oval eyes, cheeks and mouth; six moods (at rest, writing, tucked in, away, reading, watching).',
      'Sticker edge drawn into the art.',
      'Eight tints; cream for the sheep.'
    ),
  },
  'paper-folk': {
    claim:
      'Differs by material and framing: folded paper heads that fill the frame at every size, with flat facets and faint creases instead of a heavy outline, and no sticker edge because light paper already reads on the dark page.',
    rules: rules(
      'Folded animal faces: fox, cat, dog, pig, penguin, bear, mouse, rabbit.',
      'Flat two-tone polygons split along a fold; thin creases; heads only.',
      'Free silhouette, portrait framing.',
      'Two dot eyes and a nose; one expression.',
      'No edge: the paper is the contrast.',
      'Eight papers.'
    ),
  },
  'kitchen-table': {
    claim:
      'Differs by container and subject: every character is an object from the table where the game is played, standing on its own colored coaster, so every avatar has the same round footprint.',
    rules: rules(
      'Kettle, jam jar, toast, teacup, candle, fern, egg, lantern.',
      'White objects with plum ink on a tinted disc.',
      'A round disc (the coaster).',
      'Bean eyes and a small smile; one expression.',
      'The coaster is the contrast; no edge.',
      'Eight coaster tints.'
    ),
  },
  'folded-figures': {
    claim:
      'Wildcard. Differs by construction and framing: each character is its own exquisite corpse, with head, body and feet from different sources joined at two folds, and a portrait crop at small sizes.',
    rules: rules(
      'Composites: moth, cat, bird and teapot heads; sweater, teacup, fish and book bodies; boots, bird feet, frog feet and skates.',
      'Three bands with dashed folds; each band its own color and hand.',
      'Free figure; head and shoulders only at 32 px and below.',
      'Dot eyes and a small smile; one expression.',
      'Sticker edge.',
      'Three tints per character.'
    ),
  },
  'pen-pals': {
    claim:
      "The recombination: the Small Hours body, face and moods, with a writer's voice, paper props and a palette that never borrows a status color.",
    rules: rules(
      'Owl, luna moth, snail, fox, frog, bunny, sheep, axolotl: Quill, Dusk, Doodle, Rhyme, Haiku, Hush, Sonnet, Ode.',
      'One bean body and the same two feet; identity comes from ears, antennae, a shell, domes, wool and gills drawn with one chunky pen.',
      'Free silhouette with the sticker edge drawn into the art.',
      'Shared oval eyes, cheeks and mouth; six moods matched to the Tucked In statuses.',
      'Drawn-in edge, heavier below 44 px; the peach lamp never holds a peach body.',
      'Eight hues spaced around the wheel, none equal to lamp peach or the Tucked in mint.'
    ),
  },
};

export const CRITIQUE = {
  today: {
    verdict: 'Replace',
    optimizes: 'Nothing the new cast cannot also do; it exists and it ships.',
    sacrifices:
      'Family, face, subject and small-size legibility: see the gaps in the brief.',
    wins: 'No one; it was a placeholder.',
    fails:
      'At 24 px bylines, in Dark without the edge, next to the Tucked In statuses (Moss grins while Away), and on the peach lamp.',
    keep: 'The count of eight, one per seat at a full table.',
  },
  'same-eight': {
    verdict: 'Rejected; its craft rules survive',
    optimizes:
      'The cheapest real improvement. Names and stored ids stay, so nothing migrates, and one face, attached limbs, one tint each and heavier small-size ink already fix the vanishing Dark outlines, the floating limbs and the uneven mass.',
    sacrifices:
      "The subject. A triangle, a square, a planet and a lightning bolt still say nothing about poems or the people at the table, and the bolt and planet remain awkward places for a face: Ziggy's eyes are pushed into a corner.",
    wins: 'A release that has to ship this week with no data work.',
    fails:
      "The bar is a brand new cast. It reads as today's placeholders, drawn carefully.",
    keep: 'One shared face, limbs attached to the body, one tint per character, a common keyline, the sticker edge drawn into the art, heavier ink below 44 px.',
  },
  marks: {
    verdict: 'Rejected; two grafts',
    optimizes:
      'Identity and wit. No other party game has a cast of punctuation, the glyphs rhyme with the DynaPuff wordmark, and punctuation is made to be read small, so the silhouettes hold at 24 px.',
    sacrifices:
      'Warmth. Without a body there is little to love or to pose: a comma holding a book is a joke once, not company for an evening. At byline size several read as interface symbols first: the asterisk as "required", the parentheses as a radio button, the slash as a pill, the pilcrow as a formatting mark.',
    wins: 'Word lovers, and the story of the brand.',
    fails:
      'The waiting hero and the reading lamp have to carry feeling, and a player has to pick one to stand for themselves.',
    keep: "A writer's voice (names and one-line characters about writing) and the single chunky pen: every antenna, stalk and whisker at least as heavy as the outline.",
  },
  'small-hours': {
    verdict: 'Spine of the synthesis',
    optimizes:
      'The job. One body, one pair of feet and one face make a real family; ears, antennae, a shell and gills make silhouettes that survive 24 px; the moods answer the Tucked In states directly, so Away sleeps instead of grinning and the reader reads aloud.',
    sacrifices:
      "Novelty. Soft creatures are a familiar genre and nothing in the cast is about writing yet. The peach fox all but disappears into the peach lamp in Dark, and the fox's ears and the owl's tufts crowd each other at 24 px.",
    wins: 'First-time guests, family tables, and every moment where the cast carries warmth: the lobby, waiting and the reading lamp.',
    fails:
      'It is left generic. It needs a Linejam voice and a palette that stays off the status colors.',
    keep: 'The shared body and feature kit, the six moods, the feet, the drawn-in edge.',
  },
  'paper-folk': {
    verdict: 'Rejected; two grafts',
    optimizes:
      'The metaphor and the smallest sizes. A folded face fills its frame, so it is the most legible direction at 24 px, and light paper reads on the dark page with no edge at all.',
    sacrifices:
      'Expression and hands. Dot eyes and no mouth cannot sleep, read aloud or beam, and a head cannot hold the note or the book the synthesis hands it. The angles fight the soft DynaPuff and Nunito identity, and the thin crease outline vanishes in Dark, so the cast looks different in each mode.',
    wins: 'The densest lists.',
    fails: 'The waiting hero, the reading lamp, anything with a prop.',
    keep: "Props made of paper with a real fold, so the sealed note and the book look like the game's own note; and the lesson that small sizes need the face to grow.",
  },
  'kitchen-table': {
    verdict: 'Rejected; one lesson',
    optimizes:
      'A uniform round footprint and color-first recognition. Tokens line up perfectly and never depend on the page behind them.',
    sacrifices:
      'Silhouette. Every avatar becomes a circle: in grayscale the cast collapses into eight near-identical discs, and at 24 px the object shrinks to a speck. A coaster on the peach lamp is a disc on a disc, and round tokens look like account photos or radio buttons.',
    wins: 'Color-first scanning of long lists.',
    fails:
      'Color is unavailable, and whenever the object has to feel like a person: a candle holding your note.',
    keep: "The lesson, not the form: a character's color must never double as a status color. No body in lamp peach, none close to the mint Tucked in pill.",
  },
  'folded-figures': {
    verdict: 'Wildcard, rejected',
    optimizes:
      'The origin story. It is the only direction whose construction is the game itself: three hands, two folds. At 128 px it delights.',
    sacrifices:
      'Legibility and family. Tall thin figures lose mass in a square, three tints per character are busy, and the portrait crop at 32 px shows only a head that two characters share (two moths, two cats, two birds, two teapots).',
    wins: 'Illustration: the recap, a poster, a share image.',
    fails:
      '44 px roster rows and 24 px bylines, which is where avatars spend most of the evening.',
    keep: 'The fold belongs to moments (an arrival, the recap), not to the avatar. Not built here.',
  },
};

export const SYNTHESIS = {
  spine:
    'Small Hours: one bean body, the same two feet, one face with six moods, silhouettes made by what grows out of the body.',
  grafts: [
    [
      'Same Eight',
      'Optical sizing, the drawn-in sticker edge, attached limbs, one tint each, a common keyline.',
      'Dark outlines, floating limbs, uneven mass.',
    ],
    [
      'Marks',
      'Names and one-line characters about writing; one chunky pen for every antenna and stalk.',
      'A familiar genre that said nothing about Linejam; thin details at 24 px.',
    ],
    [
      'Paper Folk',
      'Paper props with a real fold: the sealed note and the open book.',
      'Props that looked like clip art beside the note the game already folds.',
    ],
    [
      'Kitchen Table',
      'A palette that never reuses a status color: no lamp peach, nothing near the Tucked in mint.',
      'The reader vanishing into the lamp.',
    ],
    [
      'Folded Figures',
      'The fold is kept for moments, not the avatar.',
      'Nothing yet; a note for a future arrival or recap.',
    ],
  ],
  dropped: [
    ['Glyph bodies', 'Read as interface symbols at byline size.'],
    ['Heads only', 'Cannot hold a prop or show a mood.'],
    [
      'Round tokens',
      'Collapse to identical discs without color; clash with the lamp.',
    ],
    ['Three-part figures', 'Lose mass and family at roster size.'],
    ["Today's names and shapes", 'Phaedrus asked for a new cast.'],
  ],
};

// The revision pass: what the first recombination got wrong at real sizes, and the change.
export const REVISION = [
  [
    'Rhyme',
    'A yellow long-eared fox with pink inner ears and blush read as a famous electric mouse.',
    'A coral red fox with a cream muzzle and a tail; no blush.',
  ],
  [
    'Doodle',
    'The coral shell had to move to the fox.',
    'A golden shell, so the snail keeps a hue of its own.',
  ],
  [
    'Quill',
    "Short tufts brought the owl's outline close to the fox's at 24 px.",
    'Taller tufts; the facial disc stays at every size.',
  ],
  [
    'Dusk',
    'At 24 px the antenna tips merged with the wings.',
    'Longer antennae with tips set wider; wing spots only from 44 px.',
  ],
  [
    'Sonnet',
    'Eleven wool bumps turned into a gear below 32 px.',
    'Eight bigger bumps at small sizes; the forehead curl only from 44 px.',
  ],
];
