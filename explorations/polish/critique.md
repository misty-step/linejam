# Comparative critique and synthesis

Six concepts were built as real HTML on the shared kit and captured in the project VM's
headless Chromium at 390x844 (light and dark), plus an acceptance recording per concept
(slowed 4x). Captures live outside Git in
`~/.cache/visual-states/linejam/20260926-polish/concepts/<id>/`. The critique is written
against the jobs in `brief.md`, not taste. No scores, no model vote.

A finding from the survey that changes the critique: **"Reading now" moves when a poem
is opened, not when it has been read.** `RevealPhase.tsx` treats the first unrevealed
poem as the current one and the server marks a poem revealed the moment its reader opens
it. So while Marguerite reads Poem 1 aloud, everyone else already sees "Basil, Reading
now" and Basil's loud button (before/44), and when the last poem opens everyone else is
moved to the recap mid-reading (source: `allRevealed` renders the recap). Any reading
choreography that "moves the lamp when the reader finishes" needs a shared "done reading"
signal. See decision D1 at the end.

## Tidy Room (conservative) — survives as the spine

- Optimizes: one focal point per screen with no new content model. The received line
  becomes the hero ("The line before yours", 28 px), the word target becomes slots plus
  words ("3 of 5 words"), rounds 1, 5 and 9 get names ("The first word", "The longest
  line", "The last word"), the reading circle leads with who is reading and demotes your
  own poem to "You read 4th", the poem sheet drops interleaved names and keeps Done above
  the fold, guests get "Juniper will start the game" instead of a disabled button.
- Sacrifices: delight. Three short motions explain acceptance, round turn and opening,
  but nothing celebrates the pass; the cast stays at thumbnail size.
- Wins for: first-time guests, 200% text, the lowest-risk production path.
- Fails when: the bar is "stunning and delightful". Alone it reads as the same app,
  cleaner.
- Keep: the structure and the whole hierarchy pass; the unified header of three ghost
  icons; anchored Room options without a backdrop; special-round captions; "You wrote
  '...'" confirmation; the guest status line; the last-submitter hold (acceptance stays on
  screen at least 1.2 s even when the round has already advanced); no "Revoke" before a
  share exists.

## Passing Notes (evolutionary) — merges

- Optimizes: the mechanic. "Passed to you" above a crease and "3 lines folded away" teach
  the exquisite-corpse rule at the moment it matters; the tuck (the received half folding
  down over your line) is the most legible acceptance moment of the six.
- Sacrifices: calm. Tuck, pass, arrive and open cost about 1.3 s per round per player,
  nine times; the recording shows the note sliding away and a new one sliding in. The
  open poem adds dashed creases between every line and cryptic margin initials (J, W, B,
  M). "Pass it on" risks reading as "skip". 3D folds are untested on low-end phones.
- Wins for: groups who enjoy the tactile toy; explaining the rule to newcomers.
- Fails when: the ninth round, when the choreography has become a wait.
- Keep: the note as the writing object, "Passed to you", "N lines folded away", "A fresh
  note. You start this poem." for round 1, the tuck as the one acceptance motion, the
  late joiner "Watching this game" set apart from the circle.
- Drop: the horizontal pass and arrival slides, creases between poem lines, margin
  initials, the Submit rename.

## Round Table (radical) — rejected as spine, two grafts

- Optimizes: presence. Seats filling around a table make the lobby feel like a
  gathering, and a single warm lamp on the reader's seat is the clearest "whose turn"
  signal of the set. The QR placement reasoning (below the table, 162 px, verified with
  `zbarimg`) is sound.
- Sacrifices: the calm writing moment. The arc costs about 200 px above the composer and
  is the loudest object while you write (the brief says writing must be calmer than the
  lobby and reveal). Names truncate to a first word in the ring; 200% text needs a second
  layout (a list); seat plates are the brightest things in Dark; the poem frame's seat
  marks read as stray dots.
- Wins for: the lobby and the reading circle.
- Fails when: typing with the keyboard open, eight players at 320 px, 200% text.
- Keep: the peach lamp as the single "reading now" accent; "lines come from the room,
  never from a neighbor" as a copy rule; "Scan to join" next to the QR.

## Poem Shape (radical) — merges

- Optimizes: the rhythm. One motion (a bar fills when a line is accepted) is the calmest
  choreography of the six, and the tap-a-name author key ("Lines by. Tap a name to see
  theirs.") is the best attribution idea: it keeps the poem's shape and still answers
  "who wrote that?". Only the current reader gets the loud "Open Poem 4".
- Sacrifices: warmth. Four silhouettes plus a roster reads as a progress report; empty
  silhouettes in the lobby look like loading skeletons; margin bars beside the poem
  duplicate the shape the left-aligned lines already make.
- Wins for: understanding structure; after-reading conversation about who wrote what.
- Fails when: people start comparing silhouettes; it drifts into a dashboard.
- Keep: the round glyph as the progress spine at readable size; the author key with
  highlight in place; the reader-only primary action.
- Drop: waiting silhouettes, lobby silhouettes, poem margin bars.

## Cast Companion (evolutionary) — merges as the delight layer

- Optimizes: warmth without noise. The cast finally does work: a crown prop marks the
  host, props say Writing, Tucked in and Away next to the words, the reader holds an open
  book as the reading focal image, and the lobby becomes a gathering of 68 px characters.
  The **sticker edge** (a light die-cut contour) fixes the Dark legibility failure in
  before/68 and before/70 without redrawing any art, and is nearly invisible in Light.
- Sacrifices: height and some clarity. The dock costs about 105 px while typing; the
  hand-in flight travels about 450 px in 400 ms; the "eyes over a ledge" prop is
  unreadable at 44 px; shipped faces keep smiling while Away.
- Wins for: nervous or first-time players, family groups, Dark mode.
- Fails when: props are read instead of words, or the keyboard is open on a small phone.
- Keep: sticker edge on every character in both modes; crown, pencil, sealed note, moon
  and open book props (always beside their words); the gathering grid; your own
  character in waiting holding your sealed note; "Tucked in" as the roster status that
  matches the acknowledgement.
- Drop: the dock, the long hand-in flight, the eyes prop.

## Lights Down (wildcard) — rejected, three grafts

- Optimizes: the social truth of reading aloud: one lit phone, eyes up, one sentence for
  everyone else ("Listen. Marguerite is reading Poem 1.").
- Sacrifices: two locked rules (a stage state, and overriding the appearance
  preference), plus deaf, hard-of-hearing and distracted listeners, who lose the poem
  during the reading. A dark phone with no action can look frozen.
- Wins for: in-person groups where reading aloud is the whole point.
- Fails when: accessibility, remote players, noisy rooms. It breaks locked requirements,
  so it cannot ship.
- Keep: the listener sentence; the reader's page set for reading aloud (large type,
  generous leading, one action named "Done reading"); "Nicely read." as the reader's
  brief acknowledgement; "Basil reads next. You read 4th."

## Synthesis — Tucked In

The product's own best line is "Tucked into the poem." The synthesis builds on it: keep
today's rooms, give each screen one focal point, let the cast carry the warmth, and let
one fold explain every hand-off.

- **Spine:** Tidy Room. Same routes, phases and component families; the lowest migration
  cost; hierarchy and chrome fixed first.
- **Grafts:**
  - Passing Notes: the writing note ("Passed to you", "N lines folded away", "A fresh
    note. You start this poem."), and the tuck as the acceptance motion. Fixes gaps 2, 3.
  - Cast Companion: sticker edge in both modes, crown, pencil, sealed note, moon and open
    book props beside their words, the lobby gathering, your own character in waiting.
    Fixes gaps 6, 8.
  - Poem Shape: the round glyph at readable size with special-round captions, the
    tap-a-name author key, and one loud action only for the current reader. Fixes 1, 2.
  - Round Table: one peach lamp marks the current reader; lines come from the room.
    Fixes 1.
  - Lights Down: "Listen. Marguerite is reading Poem 1.", the reader's page set for
    reading aloud, "Done reading", "Nicely read.". Fixes 1.
- **Dropped:** ring layout (writing calm, second layout), silhouettes dashboard and poem
  margin bars (dashboard drift), pass and arrival slides (fatigue), dock (keyboard
  height), stage state and forced dark (locked rules), "Pass it on" (reads as skip),
  creases and initials on the poem (noise), eyes prop (illegible).

### One choreography

One vertical axis. Things you give fold **down** into the poem; things you receive come
**up** to you. Nothing idles or loops; typing, counting and roster updates are instant.

| Verb | Means | Used for |
| --- | --- | --- |
| Tuck | Your contribution is in the poem, hidden | A line is accepted (after the pending label) |
| Unfold | Something is revealed to you | The received line at the start of a round; the whole poem at reading, all nine lines at once |
| Settle | Someone or something arrived and is present | A player joins; the waiting composition after a tuck; notices |
| Lamp | Whose turn it is | The peach lamp moves to the next reader (crossfade, no travel) |

### Accent roles

Violet is the one primary action and the current round. Mint means accepted (tucked in).
Peach means a person's turn (the reading lamp, "Your turn to read"). Plum is ink.
Nothing else is colored.

## Decisions for the operator

- **D1. Reading turns need a shared "done reading" signal.** Recommended: add one small
  Convex field and mutation so "Done reading" moves the lamp for everyone and the recap
  opens when the last reader finishes; an absent reader's turn is released by the
  existing fallback. Alternative: UI only (the most recently opened poem is "reading
  now"; the recap still opens for listeners mid-reading). The synthesis is drawn for the
  recommendation.
- **D2. The recap crown.** "Room favorite" with a heart count ranks poems, which
  `project.md` rules out. Recommended: keep hearts as personal favorites (they already
  feed Your poems) and remove the crown and the count. Alternative: keep it.
- **D3. Listeners' "Follow along".** Recommended: a quiet secondary action that appears
  only after the reader has opened the poem, for deaf, hard-of-hearing and distracted
  listeners; eyes stay up by default. Alternative: listeners get the poem only after the
  reader is done (Lights Down's rule, without dimming).
- **D4. The line action's name.** Recommended: "Tuck it in" (pending "Tucking in…"), so
  action, pending label and acknowledgement ("Tucked into the poem.") say one thing.
  Alternative: keep "Submit". "Pass it on" was rejected because it can read as "skip".
