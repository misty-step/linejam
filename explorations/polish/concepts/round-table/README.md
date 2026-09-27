# Round Table (concept 3, radical, monitor)

Files: `index.html`, `style.css`, `app.js`. Screens: `lobby-host`, `writing`, `waiting`,
`reading-turn`, `poem-open`, plus `x-next-reader` (the reading lamp moves on). Add
`&full=1` to `lobby-host` to seat eight players and check capacity.

## Stance

Everyone is sitting around one table. Every screen shows that table: a ring of seats
holding the cast is the room's persistent map, and content is organized by person and
seat. Your own seat is always at the bottom, nearest your hand, so each phone sees the
table from its owner's chair. The seats never move during a game. Only the table's size
changes: whole in the lobby, while waiting and while reading, a compact arc while you
write.

Truth rule: the server shuffles who writes which line each round, so a line never
travels from one seat to another. Lines come out of the table's center and go back into
it.

## Archetype and divergence claim

Archetype: monitor. The ring answers one question at a glance, "where is everyone and
what are they doing", and every other element is subordinate to it.

Divergence: this is a change of the content model (structure layer), not a restyle.
Where Tidy Room keeps a roster list per phase, Round Table replaces the list with one
spatial object that persists through lobby, writing, waiting and reading. Status lives
on seats, reading order lives on seats, and the poem itself comes out of the table.

## IA and primary journey

```text
lobby-host          writing (arc)            waiting (whole)        reading-turn           poem-open
 ring, 8 seats  ──►  arc: 3 other seats  ──►  ring: seats lit  ──►  ring: lamp on reader ──► sheet from center
 center: code        center: round            center: ack           center: who reads       frame: seats as marks
 QR + Share          line handed OUT          line tucked IN        Follow along            Done ─► back to ring
 Start Linejam       composer = your seat     your seat lights      your seat: "4th"
```

- The table's center is the single place where things are exchanged: the room code in
  the lobby, the round while writing, the acknowledgement while waiting, who is
  reading (and the way into the poem) during the reading circle.
- One invitation area per screen: in the lobby the code at the table's center and the
  QR directly under the table form one area; in game the header code is the compact
  invite.
- The ring becomes a plain list when the text is large (see "200% text").

## Screens

**`lobby-host`.** Eight places around a round table. Filled seats show the character on
a seat plate and the first name; empty seats are quiet dashed circles. Arrivals fill
the four sides first, then the corners, so a small group looks balanced. The center
holds "Room code 9A UK", tap to copy. The full long name appears in the arrival line
under the table ("Marguerite Okonkwo-Castellanos sat down. 4 of 8 seats taken.") and
in the screen reader text of every seat.

QR placement: below the table on a white plate, 162 px of modules plus a four-module
quiet zone (22 px) on every side, in Light and Dark. Why there and not in the center:
a 160 px code with its quiet zone needs a 206 px square; inside a circle that square
needs a 290 px table, which leaves no room for seats at 320 px or even 390 px. Below
the table it keeps full size at every width and 200% text, sits in the upper-middle of
the phone where a friend's camera naturally aims when the host holds it out, and
stays clear of the host's thumb and the Start button. It sits directly against the
table so code and QR read as one invitation. Both captures (Light and Dark) decode
with `zbarimg` to `https://linejam.app/join?code=9AUK`.

**`writing`.** Round 5 of 9. The table shrinks to an arc across the top: the other three
seats (Marguerite away, Basil writing, Wren tucked in) with a small status badge
(glyph, plus text for screen readers). Your seat is hidden because your seat is the
composer. The table center shows "Round 5 of 9"; the line before yours, "the kettle
keeps secrets", is handed out of the center onto a slip below the table. The composer
says "5 words, the longest line" (round 5's peak), has a real textarea (20 px text),
five word slots (dashed when empty, violet when filled, peach overflow slots when
over), the count as text ("3 of 5 words", "Add 2 words", "Remove 1 word", "Ready to
submit") and a polite live region. Submit is enabled only at exactly five words; Enter
submits when ready.

**`waiting`.** The whole ring again, centered. Center: "Tucked into the poem." (DynaPuff,
the acknowledgement moment) and "Round 5 of 9". Your seat and Wren's are lit mint and
say "Tucked in" with a check; Basil says "Writing" with a pencil; Marguerite is dimmed
on a dashed seat with a moon and "Away". Pim sits outside the ring in the table's
corner, outlined, "Watching" with an eye; the screen reader text says Pim joined late.

**`reading-turn`.** One warm reading lamp (a peach pool) rests on Marguerite's seat.
Seats carry the reading order as text: "Reading", "2nd", "3rd", and your seat "4th".
Center: "Marguerite is reading Poem 1" and a quiet "Follow along" button. Under the
ring: "You read Poem 4 last, after Wren." No one except the reader has a loud action.

**`poem-open`.** Tapping "Follow along" grows the table's white surface into the poem
sheet. The ring collapses to the sheet's thin frame: one mark per seat on the edge,
Marguerite's mark peach. Title "Poem 1", "Read by Marguerite Okonkwo-Castellanos",
then all nine lines left-aligned at 18 to 24 px, the 1-2-3-4-5-4-3-2-1 shape intact.
Attribution is quiet: one line, "Written around the table by Juniper, Wren, Basil and
Marguerite.", and an optional "Show who wrote each line" toggle that puts names at the
right edge without touching the left edge. Done (also Escape) returns the sheet into
the table and focus to "Follow along".

**`x-next-reader`.** Marguerite finishes: her seat says "Read", the lamp travels the rim
to Basil, the center says "Basil is reading Poem 2", and Follow along now opens Poem 2.

Renamed action: listeners get **Follow along** instead of "Read poem". The current app
gives everyone a loud "Read poem" at once (gap 1). Reading aloud is the reader's job;
listeners only follow, so the listener action says what it does and stays quiet. The
reader's own action keeps the name "Read poem".

## Motion spec

One grammar, three directions, used everywhere:

- **Along the rim:** the light moves to the seat where something changed (someone sat
  down, the next reader). It always starts where it last rested and takes the shorter
  way; the direction around the rim carries no meaning, the destination seat does.
- **Outward from the center:** the table hands you something (the line before yours,
  a poem).
- **Inward to the center:** you give the table something (your line).

Nothing idles, loops or fakes progress. Typing and counting are instant.

| Moment | Trigger | Duration | Easing | Purpose | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| Arrival light fades in on last seat | lobby shows a new arrival (on load, after 250 ms) | 150 ms | `--ease-out` | mark where the light starts | static end state: seat filled, arrival line shown |
| Light travels the rim to the new seat | after fade in | 400 ms | `cubic-bezier(0.45, 0, 0.2, 1)` (`--rt-ease-travel`) | attention moves to who arrived | none |
| Seat fills (character settles in) | light arrives | 300 ms | `--ease-out` (scale 0.6 to 1, fade in) | the seat is taken | none |
| Light fades out | seat filled | 300 ms | `--ease-out` | light rests | none |
| Line before yours handed out | writing screen appears | 360 ms, 150 ms delay | `--ease-out` (from table center, scale 0.35 to 1) | the line comes from the table, not a neighbor | slip shown in place |
| Submit pending | Submit / Enter | no motion; 700 ms simulated server | n/a | nothing looks accepted early: "Submitting…", read-only input | same |
| Your line tucks in | server accepts | 320 ms (composer fades 150 ms) | `--ease-in` | your line goes into the table | composer replaced instantly |
| Table opens from arc to ring | line arrives in center | 400 ms | `--ease-out` (one number, `--rt-open`, drives radius, seat size, height and centering) | writing ends, the table is whole again | ring shown whole |
| Your seat lights | table open | 300 ms | `--ease-out` (mint fill, scale 0.88 to 1) | acceptance, on your seat | seat lit, no scale |
| Reading lamp moves | next reader starts (x-next-reader, 900 ms after load) | 450 ms | `--rt-ease-travel` | the turn passes seat to seat | lamp on new seat |
| Poem sheet opens | Follow along | 300 ms reveal plus 160 ms text fade (420 ms total) | `--ease-out` circle clip from the table disc; all nine lines fade in together in one step | the table hands you the poem | sheet shown open, focus on title |
| Poem sheet closes | Done / Escape | 300 ms (text fades first 120 ms) | `--ease-in` circle clip back to the table disc | the poem goes back to the table | sheet hidden, focus returns |

The 200% list fallback also skips all travel (there is no rim to travel along).

## Principles cited

- **Apple HIG, Motion:** motion is brief and reserved for committed changes; typing,
  counting and the slot fill are instant.
- **Apple HIG, Accessibility and Typography:** the ring becomes a list at large text
  rather than shrinking names; seats are light plates in Dark so the cast keeps its
  outlines.
- **Wordle tile reveal:** one paced moment for acceptance (in, open, light) and one for
  opening a poem, with a short anticipation (pending) before the reward.
- **Gartic Phone album:** one presenter at a time and everyone following; here the lamp
  marks the presenter and listeners follow along.
- **Exquisite corpse:** the table hides everything except the line it hands you;
  opening the poem is the table unfolding into the page.

## Answers to ranked gaps

1. Reveal focal point: one lamp on one seat, one quiet "Follow along"; no loud button for listeners; nine lines without interleaved names, Done in reach.
2. Rhythm: hand out, tuck in, table opens, seat lights, lamp moves; one grammar across the game; the last submitter still sees their seat light.
3. Writer's line: the received line is a large slip from the table; five word slots plus plain count text; round 5 says "the longest line".
4. Authority and room changes: not addressed (a host handoff would move the crown between seats; not built).
5. Chrome: one header everywhere, code or wordmark left, three quiet borderless icons right; no speaker inside the poem.
6. Lobby as gathering: seats around a table with an arrival moment; roster and Start never overlap, and at 200% the ring becomes a list.
7. Recap: not addressed.
8. Cast: characters sit on seat plates (light plates in Dark) at 44 to 52 px; everyone's own character, not Moss for all.
9. Entry: not addressed.
10. Keep and share surfaces: not addressed beyond the uninterleaved poem sheet.

## Eight seats at 320 px, long names, 200% text

- **Eight seats at 320 px:** the ring radius is `clamp(92px, 50cqw - 44px, 150px)` of
  the content width, so at 320 (288 px content) seats sit on a 100 px radius, 52 px
  plates, 81 px apart. Labels go outward: above for the top three seats, below for the
  rest, 92 px wide, one line of name plus one of status. Checked with `&full=1` at
  320x568: eight names, no overlap, no horizontal scroll.
- **Long names:** seats show the first word of the name, ellipsized at 92 px. The full
  name is always in the seat's accessible text, in the lobby arrival line, on the poem
  sheet ("Read by …") and visible in the list fallback.
- **200% text:** the ring is a container query in `em` (`@container rt (max-width:
  17em)`), so at 150% and 200% root size the table becomes a card (code,
  acknowledgement or who is reading) followed by a list of seats with full names and
  status text; empty seats drop out; while writing, the other seats wrap as a row. The
  QR keeps its pixel size and wraps above "Scan to join"; Start stays in the flow
  below, never on top of content.

## Risks and when it fails

- **Nine or more people:** capacity is 8 today. A bigger room would need a second ring
  or the list; the metaphor does not scale past about 10.
- **Rim direction:** because arrival order and reading order are unrelated, the light
  sometimes goes clockwise and sometimes counterclockwise. Reviewers may read
  meaning into it; the rule says only the destination matters.
- **Arc while writing costs height:** about 200 px at 390. With the keyboard open on a
  short phone the arc should collapse to a single row of seat chips; not built.
- **Eight players in game at 320:** two lines of label per seat get tight at the
  sides; the glyph badges carry status and full text stays in the accessible name.
- **Seat plates in Dark** are brighter than anything else on the screen; five or more
  plates may feel busy.
- **Lamp pool** sits behind the table disc, so on some seats part of it is hidden.

## Out of scope

Host handoff, end game, room closed, recap, entry and join, avatar picker, the reader's
own poem view (Share, Save), absent-reader fallback, real sound. `Room options` and the
header invite are inert. `Start Linejam` shows "Starting…" and then goes to `writing`.

## Critique verdict

Rejected as the spine: the ring is the loudest object while writing, needs a second
layout at 200% text and truncates names. Kept: the peach reading lamp, "lines come from
the room", "Scan to join". Full critique: `../../critique.md`.
