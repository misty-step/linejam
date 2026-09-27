# Concept 6: Lights Down (wildcard)

## Stance

Reading is an event in a real room. When a poem is read aloud, the listeners'
phones go dark and quiet, and only the reader's phone is a page. Everyone looks
up at the person reading; nobody reads ahead on a screen.

## Archetype and divergence claim

Archetype: **monitor**. During reading, a listener's phone tells them one thing
(whose turn it is, and their own place in the order) and asks for nothing.

Divergence: the other concepts change how the reading circle *looks*. This one
changes what each phone *is* during reading: the reader's phone becomes a lit
page, every other phone becomes a dim card with one lit character. Lobby,
writing and waiting are deliberately plain and tidy so the comparison isolates
the reading idea.

### Rules this concept breaks on purpose

1. **"No alternate presentation mode or stage state"** (brief locked item 3;
   DESIGN.md "One room frame"). Reading has two stage states: *lights down* for
   listeners (`reading-turn`) and *the page* for the reader (`poem-open`).
2. **The appearance preference.** Listeners go dark regardless of System, Light
   or Dark, and the reader's page is white in both modes; the appearance and
   sound controls are hidden while a poem is being read. This overrides the one
   cycling appearance control that the brief locks (items 1 and 5).

Two smaller deviations, named so they are not mistaken for accidents: the
reader's action is renamed **Done reading** (from Done), because on this design
it also brings everyone else's lights back, so it names that moment; and the
reader's page uses plum ink (`--avatar-ink`) for its button instead of violet,
because the page must look the same in both modes and Dark's violet is too pale
on white.

### What could be grafted into a rule-abiding synthesis

- **The listener card, without the dimming.** In the normal theme: one sentence,
  "Listen. Marguerite is reading Poem 1.", the reader's character as the one
  focal image, "You read 4th" below, and no Read poem button for anyone but the
  reader. That alone fixes gap 1's "everyone gets a loud Read poem" without a
  stage state.
- **The reader's page composition.** Nine lines set large for reading aloud,
  left-aligned, no names between lines, a one-line byline, per-line credits
  behind a disclosure, and one action in thumb reach. This works inside the
  normal white poem surface.
- **Lamps.** Every character sits on a small light disc (`--ld-lamp`: surface in
  Light, foreground in Dark). The shipped plum outlines stay legible in Dark
  (gap 8) with no change to the artwork.

## IA and primary journey

```text
lobby ─Start Linejam─▶ writing r1..r9 ─Submit─▶ (pending) ─▶ waiting ─▶ next round
                                                              │
reading circle, per poem ◀────────────────────────────────────┘
  reader's phone:    Your turn to read ─Read poem─▶ (Opening…) ─▶ PAGE (white, 9 lines)
                                                                  └Done reading─▶ (Finishing…) ─▶ Nicely read.
  listeners' phones: LIGHTS DOWN (dark, reader's character lit, "You read 4th")
                                                                  └on Done ─▶ lights return, poem to read along
  chrome while reading: Room options only
```

## Screens

| Id | State |
| --- | --- |
| `lobby-host` | Wordmark, invitation card (code, QR stand-in, Share invite), four players with lamps, one violet Start Linejam. Start shows "Starting…" then goes to `writing`. |
| `writing` | Round 5 of 9, 5 words. "The line before yours" set large; textarea prefilled "and nobody asked"; live "3 of 5 words / Add 2 words"; Submit enabled only at exactly 5. Submit: "Submitting…" (700 ms simulated server) then the composer releases and the waiting composition arrives on the same page. |
| `waiting` | "Tucked into the poem." (DynaPuff acknowledgement) with *your* character (Orbit), your accepted line, then This round: Juniper and Wren Submitted, Basil Writing, Marguerite Away, Pim Watching (plays next game). Icon plus text for every status. |
| `reading-turn` | Listener (Juniper) while Marguerite reads Poem 1. Full-bleed night in both modes. Moss on a lit disc is the only bright thing; "Listen. Marguerite is reading Poem 1."; "You read 4th". Only Room options remains. Lights dim on load. |
| `poem-open` | The reader's phone (Marguerite) the moment her open is accepted: the page brightens and all nine lines settle together. Done reading works and plays the lights-return. |
| `x-reader-turn` | The reader's phone before opening: "Your turn to read." with the working **Read poem** action, which plays the poem-open choreography into the same page as `poem-open`. |
| `x-listener-after` | Listener after Done reading: lights return, header controls come back, Poem 1 arrives whole with byline and "Who wrote each line", then "Basil reads Poem 2 next. You read 4th." |

Why the open action lives in `x-reader-turn`: the common set asks `poem-open` to
*show* Poem 1 open, and the listener screen has no action by design, so the
reader's before-state is the extra screen. Opening from there lands on exactly
the `poem-open` composition, and `poem-open` replays the same brighten on load.

## Motion spec

One axis: luminance. Dimming always means someone else has the floor;
brightening always means the page is yours; arrival always rises 8 px. Pending
states never move; only their label changes. Nothing loops or idles.

| Moment | Trigger | Duration | Easing | Purpose | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| Lights down | Server reports the reader opened a poem (on load of `reading-turn`) | 450 ms background and text color; header controls fade out in the same 450 ms, then leave the tab order | `--ease-in` cubic-bezier(0.25, 0.1, 0.25, 1) | Tells the listener to look up; the lit character stays constant as the one focal point | Night state renders immediately |
| Page brightens | Server accepts Read poem (after "Opening…", 550 ms simulated) | 300 ms background to white | `--ease-out` cubic-bezier(0.25, 1, 0.5, 1) | The reader's phone becomes the page | White page renders immediately |
| Poem settles | Same moment as the brighten | 300 ms, opacity 0 to 1 and translateY 8 px to 0, whole poem as one block | `--ease-out` | All nine lines arrive together, readable at once | No animation; poem present |
| Lights return (reader) | Server accepts Done reading (after "Finishing…", 550 ms) | 450 ms white to theme; "Nicely read." arrives 300 ms | `--ease-out` | Hands the floor back | Immediate end state |
| Lights return (listener) | Server reports Done reading (on load of `x-listener-after`) | 450 ms night to theme; controls fade back; poem arrives 300 ms after a 150 ms delay (settled by 450 ms) | `--ease-out` | The room comes back and the poem is yours to reread | Immediate end state, no delay |
| Line released | Server accepts Submit (after "Submitting…", 700 ms) | 200 ms opacity 1 to 0 | `--ease-in` | The line leaves your hands | Swap is immediate |
| Acknowledgement arrives | Right after release | 300 ms, opacity and rise 8 px | `--ease-out` | "Tucked into the poem." settles as the accepted state | Present immediately |

Simulated server latency is never shortened by reduced motion; only the
choreography is.

## Principles cited

- **Apple HIG, Motion**: motion is purposeful, brief and optional. Typing and
  counting are instant; only committed changes move, and every move is 450 ms or
  less.
- **Apple HIG, Accessibility and Typography**: the page is set at 20 to 28 px
  with 1.55 leading for reading aloud; everything reflows at 200% text.
- **Wordle tile reveal**: one paced moment explains a state change. Here it is
  the brighten; unlike Wordle, nothing is staggered.
- **Gartic Phone album**: one presenter at a time with everyone following. Gartic
  has a shared screen; Lights Down makes the *reader* the shared screen.
- **Exquisite corpse**: the unfold is the payoff. Listeners get it by ear first,
  then on paper when the lights come back.

## Answers to ranked gaps

1. Reveal focal point: only the reader has an action; listeners get one sentence and one lit character; the page has no interleaved names and Done reading stays in view at 390 and 320. Absent-reader fallback not addressed.
2. Rhythm: submit has pending, release and arrive; reading has dim, brighten and return. Last-submitter skip and the shape glyph not addressed.
3. Writer's line: "The line before yours" is the largest text on the screen and the count reads "3 of 5 words / Add 2 words"; round-specific emphasis not addressed.
4. Authority and room changes: not addressed.
5. Chrome: one header everywhere (wordmark or code left; borderless appearance, sound, Room options right); during reading only Room options remains.
6. Lobby: tidied (one invitation card, compact roster, one violet action, reflows at 200% with no overlap); arrival moment not addressed.
7. Recap: not addressed (the after-reading poem is shown whole with no ranking).
8. Cast: lamps keep outlines legible in Dark; waiting shows your own character; the reader's character is the focal image while listening.
9. Entry: not addressed.
10. Keep and share: the reader's page and the listener's copy handle attribution the same way (byline plus per-line disclosure); the rest not addressed.

## Risks and when it fails

- **Deaf, hard-of-hearing or distracted listeners** lose the poem during the
  reading. This is the biggest cost; a real build would need a quiet
  "Read along" escape on the dark screen, which reintroduces a second focus.
- **Overriding appearance** can hurt: a Dark-mode reader gets a white page in a
  dim room (glare), and anyone who chose Light for legibility gets night.
- **Remote or noisy rooms**: if people are not physically together, a dark phone
  is just a dead phone.
- **Looks frozen**: a dark screen with no action can read as a crash; the lit
  character and the sentence carry that, but only if the listener notices them.
- **Phone sleep timers** may lock a listener phone during a long reading, and the
  return moment then plays to nobody.
- It adds exactly the stage state the product removed; production cost includes
  every screen reader, keyboard and 200% path for two new modes.

## Out of scope

Absent-reader fallback ("Step in and read"), host handoff and end-game notices,
recap and publication, entry and join, rematch, late-join lobby, keyboard-open
heights on real devices. The QR is a visual stand-in with real finder geometry
and is not scannable. Room options items open nothing in this prototype (the
menu itself works: Enter, arrows, Escape, focus return). Copy code and Share
invite call the real clipboard and share APIs and report failure honestly.

## Critique verdict

Rejected: breaks two locked rules and loses deaf, hard-of-hearing and distracted
listeners. Kept: the listener sentence, the reader's page set for reading aloud, "Done
reading", "Nicely read.". Full critique: `../../critique.md`.
