# 2. Passing Notes

Evolutionary · archetype **operate** · id `passing-notes`

Open `index.html` for the board, or `index.html?screen=<id>` (add `&theme=dark`) for one
screen. `writing` accepts `&fail=1` to show the "did not reach the room" path.

## Stance

The poem is a folded note that travels from hand to hand. The note is the only object on
the screen, and its fold and its pass tell you what happened. You get a note with one line
showing above a crease. You write under the crease. The note tucks over your line and leaves
your hand. Later it comes back and opens all the way.

## Archetype and divergence claim

**Operate.** Each screen has one thing to act on: the note in your hand. Writing, waiting
and the next round are one continuous desk around one object, instead of three separate
screens that swap instantly. The divergence is in the **object and behavior layers**:

- One component, the note (paper halves, a crease, a flap), carries writing, acceptance,
  waiting, the round turn and the reveal. Rosters are the same object at small size.
- One direction rule, never broken: **notes arrive from the left edge and leave to the
  right edge.** Left means "from before" and right means "onward", the way a line reads, the
  way a poem moves from line 1 to line 9, and the way a note goes on to the next writer.
  Vertical motion only ever means fold (hidden) or unfold (revealed).

Compared with Tidy Room (same screens, better hierarchy), the structure stays phase-based,
but the transitions between phases become the product. Compared with Round Table and Poem
Shape, nothing persistent is added: when the note is gone, the desk is empty.

## IA and primary journey

```text
Lobby  code + QR invitation, players as blank notes
  [Start Linejam] → "Dealing…" (pending) → blank notes leave → right
        ↓
Writing (round n)  note arrives ← left, flap opens: only the received line shows
  type into the lower half; 5 slots fill; count text
  [Pass it on] → "Passing…" (pending) → flap tucks down over your line → note leaves → right
        ↓ (same page, no click)
Desk (waiting)  "Tucked into the poem."  players as small notes: Tucked in / Writing / Away
                late joiner outside the circle: Watching
        ↓ round advances
Writing (round n+1)  next note arrives ← left and opens   (x-round-turn)
        … round 9 …
Reading circle  one note in play (the reader's), yours waits in your hand ("Yours is 4th")
  [Follow along] → the whole note unfolds (one move) → all nine lines
  [Done] → folds back → reading circle
```

## Screens

| id | State | Notes |
| --- | --- | --- |
| `lobby-host` | Code 9A UK with a real, scannable QR for `linejam.app/join?code=9AUK`, Share invite, four blank notes including the long name, Start enabled. | Invitation first, flat on the lavender (no card), so the only paper is the notes. Start sits right under the roster. **Start** plays the deal: "Dealing…" pending, notes leave right, your first note ("A fresh note / You start this poem.") arrives left and opens. |
| `writing` | Round 5 of 9. "Passed to you: the kettle keeps secrets" above the crease, "3 lines folded away" at the top, "and nobody asked" typed, 3 of 5 slots filled. | Real textarea; live count text and slots; **Pass it on** enabled only at exactly 5 words (Enter also passes when valid). Plays pending, tuck, pass, then the desk on the same page, focus on the acknowledgement. |
| `waiting` | The empty desk: you and Wren tucked in, Basil writing, Marguerite away, Pim watching (joined late, outside the circle). | DynaPuff acknowledgement is the one bold element. Status is always text plus icon; the paper supplements it (tucked = tinted folded flap, away = outline, note set down). |
| `reading-turn` | "Marguerite Okonkwo-Castellanos is reading Poem 1" is the note in play. Then Basil (2), Wren (3). Your note waits in your hand: "Yours is 4th". | No one gets a loud "Read poem" out of turn. **Follow along** opens Poem 1 with the unfold. |
| `poem-open` | Poem 1 open, all nine lines on one sheet, left-aligned; a dashed crease between each line (one fold, one hand); quiet margin initials on the right and a foot key with names. | **Done** folds the sheet back and returns to the reading circle. |
| `x-round-turn` | Round 6 of 9: a new folded note arrives from the left, opens, and shows only "the radio laughed like snow" with 4 empty slots. | Plays on load; reload replays it. |

Rename, stated once: **Submit becomes "Pass it on"** (pending "Passing…"), and roster status
**Submitted becomes "Tucked in"**, both only for line submission. The concept's promise is
that the button names the thing that happens to the note. The risk is covered below.

Chrome on every screen: room code (copies on tap) or the wordmark on the left; the appearance
cycle (System, Light, Dark; it works), sound toggle and Room options on the right, all
borderless 44 px icons. Room options opens a small anchored menu (not a centered modal) with
How to play, Your poems and End game / Close room. The menu items only close the menu in
this prototype.

## Motion spec

All motion uses the Web Animations API from one table (`MOTION` in `app.js`). Typing, slot
filling and counting are instant.

| Moment | Trigger | Duration | Easing | Purpose | Reduced-motion replacement |
| --- | --- | --- | --- | --- | --- |
| Pending | Pass it on / Start Linejam | 500 ms (simulated server) | none, text swaps to "Passing…" / "Dealing…", input read-only | Nothing looks accepted before the room accepts it | Same (not motion) |
| Tuck | Room accepts the line | 320 ms | `cubic-bezier(0.55, 0, 0.35, 1)` | The received half folds down over your line: your line is now hidden in the poem | Skipped; desk shows at once |
| Action clears | Same moment as tuck | 150 ms | linear | The button leaves with the note; one focal point | Skipped |
| Pass (departure) | Tuck ends | 300 ms | `cubic-bezier(0.5, 0, 0.75, 0)` (accelerate out) | The folded note leaves by the **right** edge: passed onward | Skipped |
| Desk settles | Pass ends | 200 ms opacity | `cubic-bezier(0.25, 1, 0.5, 1)` (`--ease-out`) | "Tucked into the poem." and the roster appear where the note was; no direction, because nothing travels | Static desk |
| Deal (lobby) | Game start accepted | 300 ms each note, simultaneous; invite fades 150 ms | pass easing | Blank notes leave **right**, dealt out to players | Skipped; first note shows at once |
| Arrival | New round (or after the deal) | 250 ms delay, then 320 ms | `cubic-bezier(0.25, 1, 0.5, 1)` (decelerate in) | A folded note enters from the **left**: passed to you | Note is already in place, open |
| Open | Arrival ends | 300 ms | `cubic-bezier(0.55, 0, 0.35, 1)` | The flap swings up and reveals only the received line (exact reverse of the tuck) | Already open |
| Action settles | Open ends | 200 ms opacity | `--ease-out` | Pass it on becomes available once the note is readable | Visible at once |
| Leave reading circle | Follow along | 150 ms opacity | linear | Clears the list so the poem is the only object | Skipped |
| Unfold | After the clear | 420 ms, whole body in one move, opacity reaches 1 at 45% (189 ms) | `cubic-bezier(0.2, 0.8, 0.2, 1)` | The body of the sheet swings down from the crease under the title; all nine lines travel together and are legible when it lands | Poem is simply open |
| Refold | Done | 260 ms | `cubic-bezier(0.5, 0, 0.75, 0)` | Sheet folds back up; then the reading circle settles (200 ms) | Reading circle at once |

Worst case from tap to settled desk: 500 + 320 + 300 + 200 = 1320 ms, of which acceptance is
visible from 500 ms. No idle, looping, progress or stagger animation anywhere.

## Principles cited

- **Exquisite corpse** (folded-paper parlor game): the fold hides everything but the last
  line, and unfolding is the payoff. It drives the note, the crease, "3 lines folded away",
  the tuck, the creases between lines of the open poem, and the unfold. Its limit ("literal
  paper craft becomes fussy near text") is why the paper is flat: no texture, tape, torn
  edges or rotation near text or inputs.
- **Wordle tile reveal**: one paced flip explains an evaluation. The tuck is the single
  acceptance flip, and the unfold is the single reveal. Unlike Wordle, nothing is staggered.
- **Apple HIG, Motion**: purposeful, brief and optional. Each move explains a committed
  change (accepted, passed, received, opened); typing is never animated; reduced motion gets
  the complete end state.
- **Apple HIG, Accessibility and Typography**: 200% text reflows (the note halves grow,
  actions stay in flow and never overlap); characters sit on a light plate so they stay
  legible in Dark.
- **Gartic Phone album**: one presenter at a time and everyone following. The reading circle
  has exactly one note in play, and listeners can follow along without competing buttons.

## Answers to ranked gaps

1. **Reveal focal point:** one note in play; yours waits in your hand ("Yours is 4th"); the poem opens in one move with initials in the margin, so the 1-2-3-4-5-4-3-2-1 shape shows and Done is above the fold at 390x844. Absent-reader fallback not addressed.
2. **Rhythm invisible:** tuck, pass, arrive, open make submit, pass and receive visible with one direction rule; the desk acknowledges every accepted line, including the last submitter's.
3. **Writer's line:** the received line is the heaviest text on the note, placed right on the crease; the word target is slots on the paper plus "3 of 5 words" / "Ready." / "Take 1 out." text; the note sits at the optical centre instead of leaving dead space below.
4. **Authority and room changes:** not addressed.
5. **Chrome:** one header shape everywhere, borderless 44 px icons, no speaker inside content, Room options is an anchored menu, not a centered modal.
6. **Lobby as gathering:** players are blank notes waiting to be dealt, Start sits directly under them, and Start plays the deal. A per-arrival moment (a note sliding in from the left) follows the same rule but is not built here.
7. **Recap:** not addressed (out of the common screen set).
8. **Cast in Dark:** every character sits on a light plate (`--pn-plate`), so plum strokes stay legible in both modes; roster art is 36 px, not a thumbnail; waiting shows each player's own character.
9. **Entry:** not addressed.
10. **Keep and share consistency:** partly: the same sheet with margin initials could serve the poem page and public recap; not built.

## Risks and when it fails

- **"Pass it on" can read as "skip"** to players used to "I pass" in games. If testing shows
  hesitation, keep the note motion and return the button to "Submit".
- **3D fold on low-end phones:** `rotateX` with perspective may stutter; the fallback is the
  reduced-motion path (instant end states), which is complete on its own.
- **Equal halves:** the fold needs both halves to be the same height, so short received lines
  leave air above them; at 200% text the note grows tall and scrolls (nothing overlaps).
- **Metaphor fatigue:** 9 rounds x (tuck + pass + arrive + open) is about 1.2 s of motion per
  round per player. It stays under the HIG "brief" bar only because each move is a real state
  change; adding any decorative move would break it.
- **Listener follow-along:** Follow along assumes the reader has already opened the poem
  (the server then allows anyone to view it). Before that, the in-play note should show no
  open action at all.
- **Paper in Dark** is a plum surface, not white: the metaphor rests on shape and crease, not
  color.

## Out of scope

Entry and join, recap, host handoff, end game and room-closed notices, absent-reader
fallback, save and share actions on the poem, real Room options destinations, sound cues,
and a live arrival moment for each new player in the lobby.

## Critique verdict

Merges. Kept: the writing note ("Passed to you", "N lines folded away"), the tuck as the
one acceptance motion. Dropped: pass and arrival slides (about 1.3 s per round, nine
times), creases and initials on the poem, the "Pass it on" rename. Full critique:
`../../critique.md`.
