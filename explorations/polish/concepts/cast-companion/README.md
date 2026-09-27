# Cast Companion (concept 5)

Evolutionary, archetype **operate**. Open `index.html` for the board; `?screen=<id>` for
one phone screen; add `&theme=dark` for Dark.

## Stance

Your character is with you the whole game. The cast carries state, so the words on screen
can stay quiet. Characters and props supplement names and text statuses; they never
replace them. Every name is printed and every status is written out under it.

## Archetype and divergence claim

**Operate.** Each phase screen answers "how am I doing, and what do I do next" from one
fixed place: the **dock**, a band at the bottom of every in-game screen that holds your
character, your name or current status, and your one action. Everything above the dock
changes by phase; the dock stays put.

Divergence from the other five concepts (component and behavior layers):

- **Component:** character plus prop. Five small inline-SVG props sit on top of the
  shipped character art, which is never redrawn: crown (Host), pencil (Writing), sealed
  note (Tucked in), moon (Away), peeking eyes over a ledge (Watching), and an open page
  (Reading).
- **Behavior:** one direction grammar. **Down into a character means handed in** (your
  line condenses into a note in your character's hands). **Up and out of a character
  means opened** (a poem comes up out of the reader's page; a new arrival settles up into
  the lobby).
- **Dark treatment:** the **sticker edge**, a die-cut light contour that follows each
  character's and prop's silhouette. It fixes the plum outlines that disappear on the
  Dark background (before/68, before/70). It is on in both modes for one identity. On
  lavender it is barely visible; in Dark it reads as a vinyl sticker. Its width scales
  with character size (Light 2.4% of size, 1 to 2 px; Dark 3.2%, 1 to 3 px). `x-cast-sheet`
  shows all eight characters with and without the edge.

No gradients, glass, glows or card-in-card. One white sheet on the poem screen and one
white invitation surface in the lobby.

## IA and primary journey

```text
lobby (everyone in one gathering grid, host wears the crown)
  │ Start Linejam            (production: your character leaves the grid for the dock)
  ▼
writing ── dock: [you + pencil] Juniper / Writing        [Submit]
  │ Submit → "Submitting…" (pending, nothing moves)
  │ accepted → line condenses into a note, lands in your hands (the one move)
  ▼
waiting ── others above, each with a prop and a written status
           dock: [you + note] "Tucked into the poem." / Juniper, tucked in
  │ (round advances; not built here)
  ▼
reading circle ── reader large, holding an open page: "<name> is reading Poem 1"
                  Up next: Basil (2nd), Wren (3rd)
                  dock: [you + note] You read 4th / Poem 4 stays folded until your turn.
  │ Follow along → "Opening…" → poem comes up out of the reader's page
  ▼
poem sheet ── reader small at top, nine clean left-aligned lines, "Lines by" credits,
              optional "Show who wrote each line"; Done returns to the circle
```

The dock order reads bottom-up as "me"; the stage above reads as "the room".

## Screens

| id | State | Notes |
| --- | --- | --- |
| `lobby-host` | Code 9A UK with QR, four players, Start Linejam enabled | Players are 68 px characters in a two-column gathering with names beneath. Juniper wears the crown and has "Host" written under the name. The roster sits centered between the invitation and Start, so there is no dead zone and no fixed bar. The newest arrival (Marguerite) settles in once. |
| `writing` | Round 5 of 9, received "the kettle keeps secrets", typed "and nobody asked" | The received line is the hero, set at 1.875 rem semibold and left-aligned. There are five word slots and the written count "3 of 5 words. Add 2". The count is also announced politely. The textarea is real, and Enter submits when ready. Submit is enabled only at exactly 5 words. The acceptance choreography ends in the waiting composition on the same page, and focus moves to the acknowledgement. |
| `waiting` | Your line accepted; Wren tucked in, Basil writing, Marguerite away, Pim (late) watching | The other players appear with props, and each has a text status under the name. You are in the dock, holding your sealed note, with "Tucked into the poem." as a brief DynaPuff acknowledgement. |
| `reading-turn` | Marguerite reads Poem 1; you hold Poem 4, last | Moss is at 132 px holding an open page. Listeners get one quiet secondary action, "Follow along", instead of a loud "Read poem" for everyone. Your dock says "You read 4th". |
| `poem-open` | Poem 1 open, all nine lines together | The sheet opens out of the reader's small character on load. From `reading-turn` it opens out of Moss's page. Done is in view at 390x844 without scrolling. |
| `x-cast-sheet` | Cast and props | Evidence board: the sticker edge on all eight characters, the same characters without it, and the six props, each with its word. |

**Authors on the poem.** Lines carry no visible names by default, so the
1-2-3-4-5-4-3-2-1 shape survives and the poem reads as one voice while it is read aloud.
Nine avatars beside nine lines would be the loudest thing on the sheet and would turn the
climax back into a table (gap 1). Attribution lives in a "Lines by" row: four small
characters with full names, in order of first line. "Show who wrote each line" is a
toggle (`aria-pressed`) that adds names in small secondary text at the end of each line
for the after-reading conversation. Screen readers always get "Written by <name>" after
each line.

**Renamed status.** "Submitted" becomes **"Tucked in"** everywhere in the roster, to match
the product's existing acknowledgement "Tucked into the poem." and the sealed-note prop.
The action stays **Submit**, and its pending label stays **Submitting…**, as today.

## Motion spec

All easings are kit tokens: ease-out `cubic-bezier(0.25, 1, 0.5, 1)`, ease-in
`cubic-bezier(0.25, 0.1, 0.25, 1)`. Typing, counting and slot filling are instant. There is
no idle or looping animation. Reduced motion is checked in JS (`matchMedia`); no Web
Animations are created, and the end composition renders directly.

| Moment | Trigger | Duration | Easing | Purpose | Reduced-motion replacement |
| --- | --- | --- | --- | --- | --- |
| Pending submit | Submit (click, Enter, or keyboard on the button) | 700 ms simulated server wait; no motion | none | Honest "not yet": the label reads "Submitting…", the textarea goes read-only, and the button is `aria-busy`. The pencil stays in hand. | Identical |
| Hand-in (the one move) | Server acceptance | 400 ms | ease-out | The textarea becomes one paper element that shrinks along a single path into the note held by your character, downward into the character. The text fades by 120 ms, the paper crossfades into the sealed note from 200 to 320 ms, and the pencil fades over 200 ms starting at 150 ms (ease-in). | The note replaces the pencil instantly |
| Composition swap | Note lands | 150 ms out (ease-in), then 200 ms in (ease-out); opacity only | as stated | The composer gives way to the waiting roster; the dock never moves. | Instant swap |
| Arrival | A player joins the lobby | 350 ms, translateY 8 px to 0 plus opacity | ease-out | One settle per join, upward, meaning "appeared". | Present in place |
| Pending open | Follow along | 350 ms simulated; no motion | none | The label reads "Opening…" and the button is `aria-busy`. | Identical |
| Poem open | Open acknowledged, or poem-open load | 420 ms; the whole sheet moves from the reader's page (translate plus uniform scale) and reaches full opacity by 35% | ease-out | The poem comes up out of the reader's page; all nine lines move together as one object. The outgoing circle fades in place over 150 ms (ease-in), and Done fades in over the second half. | Sheet present; focus on the poem title |
| Return | Done | 200 ms opacity | ease-out | Back to the circle; focus returns to Follow along. | Instant |

## Principles cited

- **Apple HIG, Motion:** motion is budgeted to two committed changes, hand-in and open.
  Frequent interactions (typing, counting) are instant, and reduced motion gets the full
  static composition.
- **Apple HIG, Accessibility and Typography:** legibility is treated as a design input.
  The sticker edge exists for Dark legibility of the cast, and every layout is flow-based
  so 200% text reflows under the action instead of beneath a fixed bar.
- **Wordle tile reveal:** one paced moment explains an evaluation. Here the evaluation is
  "accepted", shown by one move into your hands after an honest pending state.
- **Gartic Phone album:** one presenter at a time. The reader is the only large figure;
  everyone else is small in "Up next" or in their own dock.
- **Exquisite corpse:** the folded note is the object. Your line folds into your
  character's hands, and your poem "stays folded until your turn".

## Answers to ranked gaps

1. **Reveal focal point:** one large reader holding an open page, a quiet Follow along for
   listeners, and one open choreography. Names come off the lines so the shape shows, and
   Done is above the fold. The absent-reader fallback is not addressed.
2. **Invisible rhythm:** the hand-in choreography makes submit and acceptance visible, and
   the dock gives every phase the same anchor. The receive and next-round transitions and
   the last-submitter skip are not built.
3. **Under-served writer:** the received line is the hero. Word slots and "3 of 5 words.
   Add 2" replace the fraction, and going over is dashed and worded, never red. Round 5's
   peak and round 9's last word are not specially marked.
4. **Silent authority changes:** not addressed. The crown prop is the natural vehicle for
   a future host handoff.
5. **Loud chrome:** one quiet header with borderless 44 px icons and the code as the
   compact invite. No speaker inside the poem.
6. **Lobby as admin list:** 68 px characters in a gathering, centered with no dead zone,
   an arrival settle, and flow layout so 200% text cannot cover the roster.
7. **Recap ranks:** not addressed.
8. **Under-used cast that fades in Dark:** characters run from 32 to 132 px. You keep your
   own character (Orbit, not a fixed Moss), roster states are props, and the sticker edge
   applies in both modes.
9. **Empty entry:** not addressed.
10. **Keep and share disagree:** partially. The sheet's clean-lines-plus-credits layout is
    meant for the public poem page too. Nothing else is addressed.

## Risks and when it fails

- **Props become a second language.** It fails if people read props instead of text, or
  if a prop is misread (the eyes-over-ledge at 44 px is the weakest). The text status
  must stay, and the props must stay few.
- **Expressions fight state.** The shipped faces are fixed, so Moss grins while Away. The
  moon prop plus "Away" carries it, but a sleepy variant would be better and would need
  new art.
- **The dock costs about 105 px of height.** With the keyboard open on a 568 px phone, the
  dock competes with the composer. At 320 px wide, Submit wraps onto its own row inside
  the dock; the swap then keeps that row as space so your character does not jump.
- **Long hand-in path.** On tall phones the note travels about 450 px in 400 ms. Close to
  the ceiling for "one calm move".
- **Sticker edge weight.** It doubles the outline weight in Dark. It is right for small
  roster sizes and slightly heavy at 132 px.
- **Follow along** assumes participants may view a poem once its reader has opened it,
  as today's revealed poems allow [INFERENCE]. Out-of-turn reading by the holder is not
  offered on this screen.
- **Full display names** in the reader heading. "Marguerite Okonkwo-Castellanos is
  reading Poem 1" wraps to three lines. Truncating to a first name is unsafe with
  user-chosen names.

## Out of scope

Entry and avatar picker, recap, host handoff, end game and room closed, absent-reader
fallback, the late joiner's own view, the waiting-to-writing receive transition, sound,
a scannable QR (the QR here is a deterministic stand-in with real finder patterns),
real server timing (pending delays are simulated), and the lobby-to-dock move at Start
(described, not built).

## Critique verdict

Merges as the delight layer. Kept: sticker edge in both modes, crown, pencil, sealed
note, moon and open-book props beside their words, the lobby gathering, your own
character in waiting. Dropped: the dock (keyboard height), the long hand-in flight, the
eyes prop. Full critique: `../../critique.md`.
