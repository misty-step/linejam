# 1. Tidy Room

Board: `index.html` (no query string). One screen: `index.html?screen=<id>`, add
`&theme=dark` for Dark.

## Stance

Same rooms, less noise. This is today's product with the lowest migration cost:
the same IA, the same five phase screens and the same component families (invite
block, roster row, composer, reading-order row, poem sheet). Only four things
change: hierarchy, chrome, copy, and three short motion moments. Every screen
gets one focal point and every other element steps back.

## Archetype and divergence claim

Archetype: **operate**. Each phase screen is a tool for the one thing a player
does now (invite, write, wait, listen, read).

Divergence claim: the only concept that keeps today's structure intact. Where the
other five change the content model (note object, ring of seats, silhouette
spine, cast props, dark listeners), Tidy Room tests how far subtraction and
hierarchy alone can close the ranked gaps. It is the baseline the bolder concepts
must beat: if they are not clearly better than this, they are not worth their
cost.

## IA and primary journey

The IA is unchanged. Header is identical on every screen.

```text
┌ header: [Linejam | 9A UK]              [appearance] [sound] [···] ┐
lobby     invite block (code, QR, Share invite) → roster → [Start game]
  │ Start: "Starting…" (pending) → crossfade 200 ms
writing   round glyph → THE LINE BEFORE YOURS (hero) → composer + slots → [Submit]
  │ Submit at exactly N words: "Sending…" (pending) → settle 320 ms
waiting   round glyph → Orbit + "Tucked into the poem." → your line → roster with text statuses
  │ room finishes: crossfade 200 ms (same page, header stays)
writing   next round … ×9
reading   "Marguerite is reading Poem 1" (focal) → "You read 4th" (quiet) → reading order
  │ Follow along: "Opening…" (pending) → rise 280 ms
poem      sheet: nine lines together, Written by key, optional per-line names → [Done] → Keep, Share
  │ Done: instant return to the reading circle, focus back on Follow along
```

The in-game code in the header is the compact invitation: it opens the same
invitation block (code, QR, Share invite) as an anchored popover. Room options
(How to play, Your poems, and the role action: Close room, Leave room or End
game) is an anchored list, not a centered modal, with no dimmed backdrop. Escape
or an outside tap closes either popover; focus returns to the trigger.

## Screens

| Id | State | Focal point | Notes |
| --- | --- | --- | --- |
| `lobby-host` | Host lobby, four players, Start enabled | Start game (the one violet fill) | Invite block: code large (tap copies, feedback in place), QR with a four-module quiet zone on white in both modes, Share invite as an outlined secondary. Compact roster: character, name, Host tag inline; the long name wraps. A one-line note explains late joiners. Start game sits in a sticky, in-flow foot: it rests at the bottom and the last roster row always scrolls clear of it, including at 200% text. |
| `x-lobby-guest` | The same lobby for a guest | Roster | Guest variant: no disabled button. The foot holds a status line with the host's character, "Juniper will start the game". Room options offers Leave room instead of Close room. |
| `writing` | Round 5 of 9, "the kettle keeps secrets", typed "and nobody asked" | The received line | Overline "The line before yours", the line in Nunito Sans 600 at 28 px. Composer below with its own overline "Your line". Five underline slots under the input fill as words are typed; the text beneath reads "3 of 5 words" (over: "6 of 5 words. One too many." in the error color, slots turn error too). Submit enables only at exactly five. Round row: nine-bar 1-2-3-4-5-4-3-2-1 glyph, past bars mid-tone, current bar violet, plus "Round 5 of 9" and, on the special rounds, "The first word", "The longest line", "The last word". The group sits in the upper third (spacers 1 : 1.6) so the empty space below is where the keyboard lands. |
| `waiting` | Round 5 accepted; Wren in, Basil writing, Marguerite away, Pim watching | "Tucked into the poem." with your character | Orbit (Juniper's character), not a fixed Moss. "You wrote “and nobody asked the moon”" confirms exactly what was accepted. Tidy roster: "This round, 2 of 4 lines in", each row a character, name and a text status with an icon: Tucked in, Writing, Away, Watching. Pim's row says "Joined late, plays next game"; spectators keep the outlined character. |
| `x-round-turn` | Waiting, then Basil and Marguerite finish, then round 6 opens | as above, then the new received line | Plays automatically on load; reload replays. Status texts update instantly; the round turn is a 200 ms crossfade of the content under a still header, and the glyph's violet bar moves one step. |
| `reading-turn` | Marguerite reads Poem 1; you hold Poem 4, last | "Marguerite Okonkwo-Castellanos is reading Poem 1" with her character at 80 px | "Listen, or follow the poem on your phone." and an outlined Follow along (the working open action). Your turn is a quiet bordered row, "You read 4th, Poem 4, after Wren", with no button. Reading order below: Reading now (violet text), Up next, and (not reachable in this state, since Poem 1 is first) a check with "Read" once a poem is done; the current row carries `aria-current`. |
| `poem-open` | Poem 1 open | The sheet | Plays the rise on load; Done returns to the reading circle, where Follow along replays it. White sheet (surface in Dark), reader row, nine left-aligned lines at 22 px with no names between them, so the 1 to 5 to 1 shape reads at a glance. Foot: "Written by" key (character and full name per poet) and a "Show who wrote each line" toggle (`aria-pressed`) that puts a small name under each line on request. Done is fully visible at 390x844 with room to spare; Keep poem and Share poem are quiet text buttons beneath. No "Revoke public link" before anything was shared. |

Dark: every character in a roster, the reader row or the waiting moment sits on
a small pale seat (`--avatar-lavender` mixed 80% with `--color-surface`) so plum
limbs and faces stay visible (gap 8). Light is unchanged. Outlined spectator
and not-yet-read characters use the text color instead.

## Motion spec

Exactly three moments, one easing (`var(--ease-out)`, cubic-bezier(0.25, 1, 0.5,
1)). Direction has one meaning: **upward means a committed state arrived**
(small for your own action, larger for the poem). Crossfade has no direction and
means "the room moved on". Typing, slot filling, status changes, toggles and
closing a poem are instant.

| Moment | Trigger | Duration | Easing | Purpose | Reduced-motion replacement |
| --- | --- | --- | --- | --- | --- |
| Pending (not a motion) | Tap Submit, Start game or Follow along | 700 / 600 / 420 ms simulated server time | none | Honest wait: the label becomes "Sending…", "Starting…" or "Opening…", the input goes read-only, nothing looks accepted yet | Identical |
| Acceptance settle | Server accepts your line | 320 ms | var(--ease-out) | The composer is replaced by the waiting composition, which settles `translateY(8px)` to 0 with opacity 0 to 1. The header does not move. Focus moves to "Tucked into the poem."; the live region announces it | Waiting composition appears at once, complete |
| Round turn crossfade | Server opens the next round (also lobby to round 1) | 200 ms | var(--ease-out) | Old and new views share one grid cell; old opacity 1 to 0, new 0 to 1. The glyph bar steps. Live region reads the new round and received line | Instant swap to the new round |
| Poem open rise | Poem text arrives after Follow along (or on load of `poem-open`) | 280 ms | var(--ease-out) | The sheet and its actions rise 16 px with opacity 0 to 1, all nine lines together, one element. Focus moves to the poem title | Sheet shown at once, complete |

Measured in the VM browser (rAF samples): settle 8 px to 0 and opacity 0 to 1
done by about 330 ms after acceptance; rise 16 px to 0 done by about 300 ms after
the poem arrives; crossfade 0.31/0.69 at 50 ms, finished at 200 ms. With
`prefers-reduced-motion: reduce` computed `animation-name` is `none` on all three
and the end states render at once.

Last-submitter note (gap 2): in production the acceptance composition should hold
for at least 1.2 s even if the round already advanced, then crossfade, so the
last writer also sees "Tucked into the poem.".

## Principles cited

- **Apple HIG, Motion**: motion is brief and reserved for committed state
  changes; frequent interactions (typing, counting) stay instant; every motion has
  a static reduced-motion equivalent.
- **Apple HIG, Accessibility and Typography**: text sizes in rem so 200% text
  reflows (invite QR drops below the code, roster statuses wrap under names,
  Submit wraps under the count); the Dark cast seat addresses legibility.
- **Wordle tile reveal**: one paced moment explains an evaluation. Here the
  evaluation is the server's acceptance, so the pending label comes first and the
  settle only plays after it. Unlike Wordle, nothing is staggered.
- **Exquisite corpse**: the only thing on the writing screen that is large is the
  one visible line; the poem opens as one unfolded page.
- **Gartic Phone album**: one presenter at a time. The reading screen leads with
  who is reading now; your own turn is information, not a competing button.

## Answers to ranked gaps

1. Reveal focal point: one headline, "Marguerite is reading Poem 1"; your poem is a quiet "You read 4th" row, no loud "Read poem" for everyone; the poem rises open whole, names are out of the lines, Done is above the fold. Absent-reader fallback: not addressed (would be a single "Step in for Marguerite" primary in the focal block).
2. Rhythm: pending label, then a 320 ms settle into "Tucked into the poem.", then a 200 ms crossfade into the next round; the round glyph is a readable 22 px row with the current bar violet and special-round captions.
3. Writer's line: the received line is the hero at 28 px with a clear overline; slots and "3 of 5 words" replace "0 / 1 word"; rounds 1, 5 and 9 are named; the group sits in the upper third.
4. Authority and room changes: not addressed (Tidy Room would use a quiet inline notice under the header, same position as the invite feedback).
5. Chrome: one header on every screen, three 44 px ghost icons, no bordered circle; the menu is an anchored list without backdrop; no sound control inside content.
6. Lobby: guests get a status line instead of a disabled button; the roster follows the invite with no dead zone; the sticky in-flow foot never covers the last row at 200%. No arrival moment (by design; motion budget is three moments).
7. Recap: not addressed. Poem sheet drops "Revoke public link" at rest and shows no hearts or ranking.
8. Cast: your own character in waiting; Dark seats keep plum strokes visible. Sizes stay at roster scale (36 to 40 px), with 80 to 88 px for the one focal character.
9. Entry and cold start: not addressed.
10. Keep and share: the poem sheet uses the same non-interleaved layout the public recap uses; Keep and Share are consistent quiet actions. Visitor invite and "Room not found" branding: not addressed.

## Risks and when it fails

- It may be too polite. If the operator wants delight, not just clarity, Tidy
  Room will read as "the same app, cleaner"; the game's rhythm is explained, not
  celebrated.
- The received line at 28 px plus the composer is still a small group on a tall
  screen; with the keyboard down the lower third stays empty by design.
- Follow along invites listeners to read on their phones while someone reads
  aloud; if that pulls eyes down during the reading, it should be removed and the
  poem offered only after the reader is done.
- The Dark cast seat is a new visual element (a disc) that production would need
  in every avatar surface; if it is applied inconsistently, Dark gets a mixed cast.
- Sticky foot on the lobby: on very short screens with large text it occupies a
  noticeable band, even though it never hides content permanently.
- Opt-in per-line names put a name under each line, which is today's interleaving;
  it is off by default and only on request.

## Out of scope

- Entry (host/join), recap, host handoff, end game and room-closed notices,
  absent-reader fallback, confirmation dialogs for Close room, Leave room, End game.
- Keep poem and Share poem, How to play, Your poems and the role actions are
  visual only (menu items close the menu). Share invite uses native share or
  copies the link, with in-place feedback when either is refused.
- Sound cues (the control toggles its pressed state only).
- The QR encodes `https://linejam.app/join?code=9AUK` (generated with `qrencode`,
  embedded as module rows in `app.js`).

## Critique verdict

Survives as the spine of the synthesis (Tucked In). Kept: structure, hierarchy pass,
unified header, anchored menu, special-round captions, guest status line, last-submitter
hold. Reason: it closes gaps 1, 3 and 5 at the lowest cost, but alone it lacks the
delight the brief asks for. Full critique: `../../critique.md`.
