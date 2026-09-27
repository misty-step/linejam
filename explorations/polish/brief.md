# Linejam polish: intake brief

Status: design exploration on branch `phaedrus/linejam-design-polish`. Nothing here
changes the live product. Survey revision: `66d448d`.

## Brief

Linejam is a phone-first poetry party game for friends in one room. A host opens a
room, friends join by code or QR without accounts, everyone writes one line per
round (1, 2, 3, 4, 5, 4, 3, 2, 1 words) seeing only the line before theirs, and
then each person reads one whole poem aloud. The operator's verdict: good bones,
but not yet where it should be visually or experientially. The job of this loop is
to make it stunning and delightful **inside the existing identity**: better
hierarchy, choreography, cast and composition, not a new brand.

Primary jobs, by moment:

| Moment | Who | Job |
| --- | --- | --- |
| Arrive | host, guest | Get into a room fast; feel the room forming. |
| Write | every player | Receive one line, answer in exactly N words, pass it on. Calm and focused. |
| Wait | every player | Feel the group moving without being hurried or ranked. |
| Read | the current reader, listeners | Read one whole poem aloud, one reader at a time. |
| Keep | participants, later visitors | Keep, share or replay the poems; play again. |

## Locked requirements (do not trade away)

From `DESIGN.md`, `project.md`, `USER_STORIES.md`:

1. Identity: lavender background, plum ink, violet actions, white content surfaces;
   mint, peach and cast colors as deliberate accents. DynaPuff only for the
   wordmark, arrival and brief waiting acknowledgement; Nunito Sans for functional
   headings, names, controls and **left-aligned whole poems**. Tokens come from
   `lib/design/tokens.ts`; one identity in Light and Dark.
2. Rules: nine rounds of 1-2-3-4-5-4-3-2-1 words; a writer sees only the preceding
   line; all nine lines of a poem open together at reveal (no typewriter or
   line-by-line reveal); no extra clicks between submitting and seeing acceptance,
   or between opening a poem and reading all of it.
3. No generated contributions, extra modes, competitive rankings, ornamental
   prompts, ads or social expansion. No alternate presentation mode or stage state.
4. Guests without accounts; private saving and explicit, reversible publication are
   different actions; no hidden poem text reaches spectators.
5. Chrome: one cycling appearance icon (System, Light, Dark) and one shared sound
   control, both quiet; one Room options menu (How to play, Your poems, the
   role-appropriate leave/close/end action); one invitation area per screen; the
   compact in-game invitation lives in the header.
6. Honest feedback: nothing renders as accepted before the server accepts it;
   drafts, uncertain-submit recovery, live roster, late joins, host permissions,
   absent-reader fallback and rematch are preserved.
7. Access: 320 and 390 px phones, keyboard-open heights, 200% text, Light, Dark,
   System, reduced motion; targets at least 44 px; input text at least 16 px; no
   horizontal scroll; icon-only controls are labeled.
8. Cast: the eight shipped characters (Pip, Moss, Pebble, Orbit, Sprout, Sunny,
   Ziggy, Plum) are static local SVGs, supplement names, and must stay legible at
   roster size in both modes. Duplicates are allowed.
9. Out of scope for this loop: sign-in, sign-up, callback and account profile flows
   (auth-rethink owner), backend or Parlor changes.

Assumption (recorded, not locked): reading order is a social convention the UI
should lead with; the server currently accepts any authorized reveal order, so
designs may de-emphasize out-of-turn reading but must not require a backend change.

## Motion rule (operator, via Kaylee)

Motion explains a committed state change; it never decorates. Per screen, **one
focal point**. One consistent choreography across the product (the same direction
means the same thing everywhere). No idle loops, no effect soup, nothing that
masks latency. Reduced motion gets the complete static composition.

## Survey: ranked gaps

Evidence ids refer to the before gallery (`before/manifest.json`), captured from a
real four-player game plus a late joiner on the isolated stack on `linejam-ws`.

1. **The reveal has no focal point and the climax reads like a table.** Every
   player gets a loud "Read poem" at once, whatever the reading order (38, 40),
   while a status list says someone else is "Reading now". The poem opens with no
   transition, and nine author names interleave the nine lines, so the
   1-2-3-4-5-4-3-2-1 shape disappears and Done falls below the fold (42, 43, 50).
   Absent-reader fallback stacks two identical primary buttons (49).
2. **The game's rhythm is invisible.** Submit, pass and receive have no
   choreography: the last submitter jumps straight into the next round with no
   acknowledgement (96), and waiting swaps to writing instantly. The poem's shape,
   the product's most distinctive idea, is a 48 px muted glyph (20). The only
   motion is one 380 ms settle; six unused keyframes sit in `globals.css`.
3. **The writer's one line is under-served.** "Previous line" is a small gray
   label; the word target is an abstract fraction, "0 / 1 word", red when over
   (21, 31); round 5's peak and round 9's last word look like every other round
   (36); two thirds of the screen is dead when the keyboard is down.
4. **Authority and room changes are silent.** The host is replaced after a
   minute away with no notice to anyone (65, 66); guests are dropped into the
   lobby when a game is ended (72); guests stay on the recap when the room closes,
   told only to start a new room from home (74, 75).
5. **Chrome is louder than content, and differs per route.** Four header
   variants; the appearance control is a bordered circle that reads as the
   primary button on the writing screen (20); a stray speaker sits inside the poem
   card (42); the recap repeats sound (53); a three-item menu is a centered modal
   with a dimmed backdrop (14, 18); at 320 px the home header wraps (81).
6. **The lobby is an admin list, not a gathering.** Arrivals are rows with no
   arrival moment; guests see a disabled "Waiting for host" button (12); a dead
   zone separates roster and action; at 200% text the action bar covers the
   roster (84).
7. **The recap hides the poems and ranks them.** "Session complete" leads with a
   crowned "Room favorite" and a heart count (52), which is a ranking in tension
   with "no competitive rankings"; poems are reduced to first words with ellipses;
   "Revoke public link" is offered before anything was shared (43, 53).
8. **The cast is under-used and fades in Dark.** Characters are 32 to 44 px
   thumbnails; the picker is a cramped sheet (05); waiting always shows Moss,
   whoever you are (24); in Dark the plum outlines vanish, so limbs and faces
   disappear (65, 68, 70).
9. **Entry is empty, and its cold start is rough.** Host and join are a label and
   an input on a blank page (04, 09). On a slow link a fresh guest sees a blank
   frame, a spinner that says "Creating room…" before they have done anything,
   then the form in fallback system fonts, wordmark included (98).
10. **Keep and share surfaces disagree.** The poem page interleaves names, the
    public recap does not (59, 57); a visitor on a public poem is told "Sharing
    makes this poem public" and is never invited to play (61, 62); "Room not
    found" has no brand while "Page not found" does (77, 78).

Smaller findings: after a denied copy, Share invite gives no distinct feedback
(93, 94 skipped); "This line stays read-only until the room confirms whether it
was recorded" is honest but mechanical (35); the reading-order row squeezes a
"Read poem" link between name and status for spectators (47).

## References (principles, not pixels)

| Reference | Principle | Use here | Limit |
| --- | --- | --- | --- |
| Apple HIG, Motion ([link](https://developer.apple.com/design/human-interface-guidelines/motion), accessed 2026-09-19) | Motion is purposeful, brief and optional; avoid animating frequent interactions. | Budget motion to committed state changes; typing and counting stay instant. | Native components supply much of this; the web must hand-build reduced motion. |
| Apple HIG, Accessibility and Typography ([a11y](https://developer.apple.com/design/human-interface-guidelines/accessibility), [type](https://developer.apple.com/design/human-interface-guidelines/typography)) | Legibility and Dynamic Type are design inputs. | 200% text reflow, contrast of the cast in Dark. | Platform APIs differ from WCAG. |
| Wordle tile reveal ([analysis](https://uxdesign.cc/wordle-ux-sometimes-a-game-just-feels-good-8749b26834ef), accessed 2026-09-26) | A single, paced flip explains an evaluation; anticipation is part of the reward. | One choreographed moment for acceptance and for opening a poem. | Wordle staggers feedback; Linejam must open all nine lines together. |
| Gartic Phone album ([wiki](https://gartic-phone.fandom.com/wiki/Album), accessed 2026-09-26) | The closest analog; the end-of-game album is presented one chain at a time, manually or automatically, to the whole group. | A reading circle with one presenter at a time and everyone following. | Gartic has a shared screen and a presentation mode; Linejam has neither. |
| Exquisite corpse, the folded-paper parlor game ([history](https://en.wikipedia.org/wiki/Exquisite_corpse), accessed 2026-09-26) | The fold hides everything but the last line; unfolding is the payoff. | A physical metaphor for "only the line before yours" and for the reveal. | Literal paper craft becomes fussy near text. |

## Current journey and where it breaks

```text
home → host (name, avatar) → lobby (code, QR, roster) → Start
  → writing r1 → [submit] → waiting ─┐ (last submitter skips waiting: 2)
  ← writing r2 ← [round advances] ───┘ ... r9
  → reading circle (everyone: "Read poem": 1) → poem dialog → Done
  → recap (crown first: 7) → Play again | Back to lobby | Exit
silent: host handoff, end game, room closed (4)
```
