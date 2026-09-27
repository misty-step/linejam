# Linejam cast: new player avatars

Design exploration on branch `phaedrus/linejam-avatar-cast`. Nothing here changes the
app. `DESIGN.md` stays the live contract until the operator picks a cast.

Operator verdict on the polish review (via Kaylee, 2026-09-27): the rest of the Tucked In
direction looks great; the avatars are stubs and need a brand new cast, designed properly.

## Brief

A player picks a character next to their pen name, and that character stands beside the
name for the whole evening: in the lobby gathering, the round roster, the reading circle,
the poem byline and the recap. The job of the cast is to make a room of friends feel
present and warm without competing with the poem. The characters supplement names; they
are never identity credentials or the only way to tell people apart.

The Tucked In synthesis (`phaedrus/linejam-design-polish`, `explorations/polish/`) is the
accepted surrounding direction. It asks the cast to wear a light sticker edge in both
modes, to carry a few props beside their words (crown for host, pencil for writing,
sealed note for tucked in, moon for away, open book for reading), to appear outlined for
spectators, and to sit on a peach lamp disc when it is someone's turn to read.

## Where the cast appears (CSS px)

| Size       | Where (Tucked In direction)                                             |
| ---------- | ----------------------------------------------------------------------- |
| 24         | "Read by" bylines on the poem sheet and recap, "Lines by" chips         |
| 32         | Reading order rows (today), compact recap rows                          |
| 44         | Round roster rows with props, entry trigger, "You read 4th" card        |
| 56         | Character sheet tiles, home greeting                                    |
| 72         | Lobby gathering                                                         |
| 112 to 128 | Waiting hero (your character with your sealed note), reader on the lamp |

Backgrounds: lavender page `#eee8ff`, white surface, `#e5dbf5` selected tile; dark page
`#23172f`, dark surface `#33223f`, `#412d50` selected tile; the peach lamp in both modes.

## Locked requirements

From `DESIGN.md`, `project.md` and the accepted synthesis:

1. Static, local SVG. No runtime generation, no new provider or dependency.
2. Legible at roster size in Light and Dark. One identity in both modes.
3. Supplements names and written statuses; never color-only, never the only
   distinguisher. Duplicates are allowed; no reservation or pre-join lookup.
4. Plum ink and the lavender, mint and peach identity. Character colors are accents,
   not eight loud controls.
5. Works with the synthesis: sticker edge, the five props beside their words, outlined
   spectators, the peach reading lamp, the 72 px gathering, the waiting hero.
6. Stored ids: `roomPlayers.avatarId` is validated against `AVATAR_IDS`
   (`convex/lib/avatars.ts`). A new id set needs a widen, backfill and narrow sequence
   under `docs/convex-migrations.md`; keeping the eight ids as internal keys does not.

Assumptions (recorded, not locked): the cast stays at eight, matching the eight-player
room; characters are not people, so no skin tone, gender or likeness is implied.

## What is wrong with today's cast

Evidence: `/home/phaedrus/review/linejam/before/05-host-avatar-picker.png`, the cast sheet
in `concepts/cast-companion/`, and `components/ui/Avatar.tsx` at `66d448d`.

1. **No family.** A triangle, a square, a pebble, a planet, a radish, a star, a lightning
   bolt and a gem share nothing but an outline color. Nothing says poetry, paper or a
   room of friends.
2. **No shared face.** A wink, a squint, closed eyes, one eye and a brow, a gasp: eight
   clip-art faces from eight different sets.
3. **Floating limbs.** Arms and legs are loose strokes beside the body; at 32 px they
   read as whiskers and in Dark they vanish.
4. **Three fills for eight characters.** Color cannot help tell anyone apart, and mint
   and peach collide with the synthesis roles (mint means tucked in, peach means your
   turn): a peach character on the peach lamp loses its body.
5. **One stroke for every size.** 2.5 units on a 64 unit box is 1.25 px at 32 px and
   0.9 px at 24 px; faces clog and outlines break up.
6. **Uneven optical mass.** The bolt looks half the size of the square in a row.
7. **Fixed expressions.** Moss grins while Away; the synthesis had to lean on props.

## Method

Design-studio loop, focused on one component family: six named directions that differ in
subject, construction, container, face behavior and dark-mode strategy; a comparative
critique against the job; a recombined cast; one revision pass with before and after.
Every direction is hand-drawn SVG rendered by one engine at true CSS sizes on the real
tokens and fonts, so the boards prove size and mode legibility rather than suggest it.
No image generation: a raster proposal could not prove any of the size or mode claims,
and the shipped artifact has to be hand-authored vector anyway.

| File                                                                                  | What it is                                                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/engine.js`                                                                       | Geometry helpers, optical sizing, sticker edge, faces and moods, props, rendering |
| `src/casts/today.js`                                                                  | Today's cast, copied from `components/ui/Avatar.tsx`, as the baseline             |
| `src/casts/{same-eight,marks,small-hours,paper-folk,kitchen-table,folded-figures}.js` | The six directions                                                                |
| `src/casts/pen-pals-v1.js`, `src/casts/pen-pals.js`                                   | The recombined cast before and after the revision pass                            |
| `src/critique.js`                                                                     | Divergence claims, comparative critique, synthesis lineage, revision notes        |
| `src/pages.js`, `src/index-page.js`                                                   | Boards, real-context fragments, the index and the Pen Pals sheet                  |
| `src/try.js`                                                                          | The try-on preview; runs the same engine in the browser                           |
| `build.js`                                                                            | Static build into the review folder                                               |
| `tools/contact.js`, `tools/capture.js`                                                | Contact sheets for drawing review; CDP captures from the workspace Chromium       |
| `tools/export-art.js`                                                                 | Exports the Pen Pals cast to `components/ui/avatarArt.ts`, the app's art data     |

## Outcome

Phaedrus picked **Pen Pals** (2026-09-27), with the stored-id migration. After the pick,
small-size cues grew where grayscale pairs were weakest: the fox's tail, the frog's eye
domes and the axolotl's gills. The app draws the cast from exported data:

```sh
bun explorations/avatars/tools/export-art.js components/ui/avatarArt.ts
pnpm exec prettier --write components/ui/avatarArt.ts
```

## Build, view, capture

```sh
bun explorations/avatars/build.js ~/review/linejam/avatars
# https://mirrodin.tail5f5eb4.ts.net/review/linejam/avatars/
```

Captures run in the project workspace Chromium over an SSH tunnel (CDP forward to the VM,
review server reverse-forwarded to it), with `playwright-core` from the main checkout:

```sh
PW=<playwright-core dir> CDP=http://127.0.0.1:19347 BASE=http://127.0.0.1:18090/linejam/avatars/ \
  bun explorations/avatars/tools/capture.js <out> 'refined.html#cast,game'
```

Evidence lives outside Git in `~/.cache/visual-states/linejam/20260927-avatars/`. The
captures prove appearance only; nothing here exercises the app.
