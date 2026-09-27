# Concept 4: Poem Shape

Radical, archetype **explore**. Files: `index.html`, `style.css`, `app.js`, this README.
Board: `index.html` (no query). One screen: `index.html?screen=<id>`, add `&theme=dark`.

## Stance

The 1-2-3-4-5-4-3-2-1 shape is the game's map. Every screen shows where the group is
in the shape, so the rhythm of the game is visible without words. The silhouette is
nine horizontal bars, left-aligned like lines of a poem, lengths proportional to the
word count. It is pictorial, not a chart: no axes, no numbers on bars, no legends,
no gridlines. One motion carries the whole game: **a bar fills when a line is
accepted.**

## Archetype and divergence claim

Explore: the silhouette is the content model and the navigation spine, not a
decoration on a phase screen. The poem-shaped glyph that is 48 px and muted today
becomes the thing each screen is organized around:

| Screen | What the silhouette means there |
| --- | --- |
| Lobby | One empty silhouette per player: the poems this group is about to write. The roster *is* the set of poems. |
| Writing | A slim rail. Bars 1 to 3 are folded (filled, text hidden), bar 4 sits beside the line you received, bar 5 is your composer. |
| Waiting | Four small silhouettes, one per poem, filled to where the group is. Round 5 fills as each line is accepted. |
| Reading circle | Four complete silhouettes in reading order; the one being read is lit. |
| Poem | A thin silhouette margin beside the nine lines, bar length equals word count. |

Divergence from the other concepts: structure is organized by poem and by time (the
shape), not by phase (Tidy Room), object (Passing Notes), seat (Round Table) or
person (Cast Companion). Typography leans on tabular counts; palette is violet bars
on the existing lavender and white.

## IA and primary journey

```text
Lobby ─ invitation (code, Share invite, QR)
      ─ "Four players, four poems": four empty silhouettes, each with a player
      ─ Start game
        │
Writing (round N) ─ rail: bars 1..N-1 filled, bar N outlined as now, rest empty
                  ─ received line beside bar N-1, composer beside bar N
                  ─ N word slots + "3 of 5 words" + Submit (enabled at exactly N)
        │ Submit → "Tucking in…" (pending) → server accepts → bar N fills (300 ms)
        ▼
Waiting ─ "Tucked into the poem."  ─ four silhouettes (round N filling per acceptance)
        ─ roster with text status (Tucked in, Writing, Away, Watching)
        │ every line in → next round (writing again, rail one bar further)
        ▼
Reading circle ─ four full silhouettes in reading order, current one lit
               ─ listener: "Marguerite is reading" + Read along (quiet)
               ─ reader:   "Your turn to read" + Open Poem 4 (the one loud button)
        │ Open → "Opening…" (pending) → poem
        ▼
Poem ─ margin silhouette fills, all nine lines appear together
     ─ "Lines by" key: tap a name to light that person's lines
     ─ Back to the circle (listener) or Done reading (reader)
```

## Screens

| Id | State | Notes |
| --- | --- | --- |
| `lobby-host` | Host lobby, code 9A UK with a real scannable QR for the join URL, four players including the long name, Start game enabled. | Invitation first. Four empty silhouettes, each labeled with the player's character and full name; Juniper is "You, hosting". Tap the code for copy feedback. |
| `writing` | Round 5 of 9, received "the kettle keeps secrets", typed "and nobody asked" (3 of 5). | Real textarea. Five word slots fill instantly as you type; count text "3 of 5 words", "5 of 5 words" with a check, "6 of 5 words. Remove 1." in error color. Polite live region mirrors the app ("Add 2 words", "Ready to submit"). Enter never inserts a newline. Submit enabled only at exactly five. Submit plays pending, then the rail's bar 5 fills, then the waiting composition on the same page; 2.6 s later Basil's line is accepted and that poem's bar 5 fills the same way. |
| `waiting` | After your round-5 line was accepted. | Four silhouettes with rounds 1 to 4 filled; round 5 filled for the poems held by Juniper and Wren, outlined for Basil's and Marguerite's. The holder's character sits under each shape; no text leaks. Roster: Juniper (you) Tucked in, Wren Tucked in, Basil Writing, Marguerite Away, Pim Watching. Plays next game. |
| `reading-turn` | Marguerite reads Poem 1; you hold Poem 4, last. | Poem 1 lit (white surface, violet ring, full violet silhouette) with "Marguerite is reading" and a quiet Read along. Others dim: Basil "Up next", Wren "Reads third", Juniper (you) "You read fourth". Read along plays the poem-open choreography. |
| `poem-open` | Poem 1 open as a listener, static end state. | Nine left-aligned Nunito Sans lines, each beside a margin bar of its word count. Authors as a quiet key of four name chips; pressing one (aria-pressed) quiets the other lines. Each line also carries a visually hidden ", by Name" for screen readers. |
| `x-your-turn` | Signature: Poems 1 to 3 read, your turn. | Only the reader gets the loud button: "Open Poem 4". Pending "Opening…", then the choreography, then Done reading. Answers gap 1 directly. |

Chrome everywhere: wordmark (lobby) or the compact code invitation (in game) left;
appearance, sound and Room options right as quiet 44 px icon buttons with labels.

## Motion spec

One choreography: a bar fills left to right when a line is accepted. Nothing else
moves. Typing, counting, status text, chip highlighting and screen changes are instant.

| Moment | Trigger | Duration | Easing | Purpose | Reduced-motion replacement |
| --- | --- | --- | --- | --- | --- |
| Word slot fills | Typing a word | 0 ms (instant) | none | Count stays honest and immediate (HIG: don't animate frequent interactions) | Same |
| Submit pending | Submit pressed | 900 ms simulated wait; label swap is instant | none | Nothing looks accepted before the server says so | Same |
| Your line accepted | Server acceptance | 300 ms `transform: scaleX(0→1)` from the left on rail bar 5 | `--ease-out` cubic-bezier(0.25, 1, 0.5, 1) | The one focal change: your line is in the poem | Bar shown filled at once |
| Hand-off to waiting | 450 ms after the fill ends | 0 ms cut, focus moves to "Tucked into the poem." | none | Let the fill land, then show the group | Same |
| Another line accepted | Roster update (Basil, 2.6 s later in the demo) | 300 ms, same fill on that poem's bar 5 | `--ease-out` | Group progress without ranking or hurry | Bar shown filled at once |
| Poem open pending | Open Poem 4 / Read along | 600 ms simulated wait; label "Opening…" | none | Honest reveal | Same |
| Poem opens | Poem arrives | Margin bars all fill together, 320 ms `scaleX(0→1)`; the whole poem text fades in together, 200 ms opacity | `--ease-out` | The shape fills to the poem; all nine lines readable at once, total under 450 ms | Complete poem and full margin at once |
| Author key | Chip pressed | 0 ms | none | Explore who wrote what without interleaving names | Same |

Bars never animate at rest, never loop, never pulse. The "now" bar is a static violet
outline.

## Principles cited

- **Apple HIG, Motion**: motion is purposeful, brief and optional; typing and counting stay instant, only committed state changes move.
- **Apple HIG, Accessibility and Typography**: 200% text reflows with the rail intact; avatars sit on a light disc so plum strokes survive Dark; statuses are text first.
- **Wordle tile reveal**: a single, paced fill explains an evaluation (your line was accepted). Unlike Wordle, the poem-open fill is not staggered: all nine bars and lines arrive together.
- **Gartic Phone album**: one presenter at a time; the reading circle lights one poem and gives the loud action only to its reader.
- **Exquisite corpse**: in writing, bars 1 to 3 are the fold. You see that lines exist and how long they are, never what they say; only the line before yours is open.

## Answers to ranked gaps

1. Reveal focal point: one lit poem, one loud button only for the current reader; poem keeps its shape via the margin with authors in a key, not interleaved; Done or Back fits above the fold at 390x844.
2. Rhythm invisible: the silhouette is on every screen and one fill choreography marks every accepted line, including the last submitter's.
3. Writer's line under-served: the received line sits beside its bar, the composer is bar 5 with five slots, round 5 reads "Five words. The widest line." and its bar is visibly the longest.
4. Authority and room changes: not addressed.
5. Chrome: one header pattern, quiet 44 px icons without borders, code or wordmark on the left only.
6. Lobby as admin list: the roster becomes four empty poems waiting to be written; Start game sits at the bottom in flow so 200% text never covers the roster. No arrival moment added.
7. Recap: not addressed (the author key and whole-poem shape would carry into it).
8. Cast: characters on a disc in both modes stay legible in Dark; waiting shows each player's own character, not Moss for everyone.
9. Entry: not addressed.
10. Keep and share: not addressed beyond one poem layout that a public poem page could reuse.

## Risks and when it fails

- **Dashboard drift.** Four silhouettes plus a roster can read as a progress report. It fails if anyone starts counting bars or comparing poems; the design keeps shapes numberless and statuses in words, never percentages.
- **Skeleton-loader confusion.** Empty outlined silhouettes in the lobby can look like content still loading. The heading "Four players, four poems" carries the meaning; without it the shapes are ambiguous.
- **Repetition.** Every poem has the same shape, so four identical silhouettes say little by themselves. The shape is informative only through fill state; at eight players the waiting row needs two lines.
- **Tiny marks.** A one-word bar is 9 px wide; at roster size it reads as a dot. It is pictorial, never the only carrier of meaning.
- **Rail spacing.** In writing, the rail stretches around the received line and the composer; if the keyboard hides bars 6 to 9 the rail loses its lower half (acceptable: the text says the round).
- **Color reliance.** Filled versus outlined bars differ by color and by outline; every state also has text, but low-vision users get little from the shapes themselves.

## Out of scope

Entry, host/join and avatar picker; recap, Your poems, sharing and publication; host
handoff, end game and room-closed notices; absent-reader fallback; Room options,
invite and appearance panels (buttons are present but inert); sound; rematch; next
round arrival (would be the same fill on the group's last round-N bar, then writing).
Timings are simulated in the page, not from a server. The QR encodes the sample join
URL and was precomputed once into `app.js`.

## Critique verdict

Merges. Kept: the round glyph as the progress spine, the tap-a-name author key, one loud
action only for the current reader. Dropped: waiting and lobby silhouettes (dashboard
and skeleton-loader readings), poem margin bars. Full critique: `../../critique.md`.
