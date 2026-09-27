# Tucked In: synthesis spec (review candidate)

The recombined direction from `../critique.md`. It is a proposal rendered as real HTML
on the shared kit, not a change to the product. `DESIGN.md` stays the live contract
until the operator accepts a direction. The paired before/after gallery and interactive
finalists are in `/home/phaedrus/review/linejam/`; acceptance timing in these prototypes
is simulated, not evidence of a backend result.

Stance: keep today's rooms, give every screen one focal point, let the cast carry the
warmth, and let one fold explain every hand-off. The product's own best line,
"Tucked into the poem.", names the direction.

Lineage: spine from Tidy Room; the writing note and the tuck from Passing Notes; the
sticker edge, props and gathering from Cast Companion; the poem-shape glyph, author key
and reader-only primary from Poem Shape; the reading lamp from Round Table; the listener
sentence, reader's page and "Nicely read." from Lights Down. Dropped pieces and reasons
are in the critique.

The review choice is between the conservative Tidy Room baseline, the tactile
Passing Notes alternative and this synthesis. All six exploratory concepts and
their rejection reasons remain in the critique. Decisions D1 to D4 below are
explicit assumptions for the drawings, not approved implementation requirements.

## Rules

1. **One focal point per screen.** One bold element; everything else quiet. If two
   things compete, demote one.
2. **Accent roles.** Violet: the one primary action and the current round. Mint: accepted
   (tucked in). Peach: someone's turn (the reading lamp, "Your turn to read"). Plum: ink.
   Lavender: cast fills and quiet surfaces. Nothing else is colored. Status is never
   color-only.
3. **Type roles.** DynaPuff only for the wordmark, the home headline, and brief
   acknowledgements ("Tucked into the poem.", "Nicely read."). Nunito Sans everywhere
   else; poems left-aligned. Sentence case, no all-caps labels.
4. **Surfaces.** Lavender page; white paper for things you hold (the note, the poem
   sheet, the invitation card, menus and sheets). Paper lifts with `--shadow-md`;
   overlays use `--shadow-lg`. No gradients, glass, glows, or card-in-card.
5. **The cast.** Every character wears a light die-cut **sticker edge** in both modes
   (nearly invisible on lavender; keeps plum strokes legible in Dark). Props sit beside
   the words, never instead of them: crown (host), pencil (writing), sealed note (tucked
   in), moon (away), open book (reading). Spectators keep the outlined character. Never
   redraw the shipped art.
6. **Honesty.** Nothing looks accepted before the (simulated) server accepts it: a pending
   label first, then the motion. Copy states consequences plainly.
7. **Chrome is quiet and identical everywhere.** See Chrome.
8. **Access.** 44 px targets, input text 16 px or more (the line input 22 px), visible
   focus, labeled icon buttons, `aria-live` for acknowledgements and notices, dialogs
   and sheets trap focus and return it, no horizontal scroll at 320 px, 200% text
   reflows without anything covering the primary action.

## Tokens and scale

Use `../kit/tokens.css` custom properties only; synthesis-local properties may derive
from them with `color-mix`. Suggested scale (the lead may tune, then it is fixed for
every slice):

| Role | Style |
| --- | --- |
| Display | DynaPuff 600; home headline `clamp(2.5rem, 10vw, 3.5rem)`; acknowledgement 1.75rem; wordmark 1.5rem |
| Page title | Nunito 700, 1.75rem, line-height 1.15 |
| Hero line (received line, reader sentence) | Nunito 600, 1.625rem, line-height 1.25 |
| Poem, reading aloud | Nunito 400, 1.5rem, line-height 1.45 |
| Poem, cards and recap | Nunito 400, 1.125rem to 1.25rem |
| Body | 1rem / 1.5; secondary text 0.9375rem |
| Label | 0.875rem, 600, sentence case |
| Line input | 1.375rem; other inputs 1.125rem |

Page inline padding 20 px (16 px at 320). Content column max 440 px on phones; wider
layouts only where a state says so. Radii: `--radius-lg` for paper, `--radius-md` for
buttons and inputs, full for chips.

## Chrome

- Header, 56 px, in flow at the top of every screen. Left: the wordmark (home, entry,
  lobby, keep pages) or the room code chip "9A UK" (in game; opens the compact
  invitation). Right: 44 px ghost icon buttons, no borders: appearance (cycling
  monitor, sun, moon; label states current and next), sound, and Room options (in a
  room) or More options (outside). Home keeps its Sign in entry as a ghost icon; auth
  flows themselves are out of scope.
- Room options and More options open an **anchored menu** under the button (no centered
  modal, no dimmed page). Items: How to play, Your poems, then the one role action
  (Close room, Leave room or End game) in the error color, separated by a divider.
- Confirmations are **bottom sheets** with a title, one plain consequence sentence, a safe
  button and the action button.
- Notices (host changes, game ended, room closed, offline, reconnected) are **inline
  banners** directly under the header, in flow, never overlapping it. They settle in.

## Choreography

One vertical axis. What you give folds **down** into the poem; what you receive **opens
up** to you. Nothing idles, loops, or fakes progress; typing, counting and roster status
changes are instant.

| Verb | Meaning | Motion | Duration and easing | Reduced motion |
| --- | --- | --- | --- | --- |
| Pending | Waiting for the room | Label swap only ("Tucking in…", "Opening…", "Starting…") | none | same |
| Tuck | Your line is in the poem | The upper half of the note (the received line) folds down over your line around the crease: `rotateX(0 → -180deg)`, transform-origin at the crease, `perspective` on the note; the action fades 150 ms | 320 ms, `--ease-fold: cubic-bezier(0.55, 0, 0.35, 1)` | End state at once |
| Settle | Someone or something has arrived | `opacity 0 → 1`, `translateY(8px → 0)` | 240 ms, `--ease-out` | Present at once |
| Unfold | Something is revealed to you | The hidden half opens: `rotateX(-180deg → 0)` for the next note; for a poem the sheet body opens from under its title, `rotateX(-90deg → 0)` with opacity reaching 1 by 45%; all nine lines move as one block | note 320 ms, poem 420 ms, `--ease-out` | Open at once |
| Lamp | Whose turn it is | The peach lamp disc crossfades from the last reader to the next (no travel) | 300 ms, `--ease-out` | Swap at once |

Sequences:

- **Line accepted:** Tuck it in → "Tucking in…" (pending) → tuck → the waiting composition
  settles where the note was, your character holding the sealed note. Focus moves to the
  acknowledgement. If you were the last writer, the acknowledgement holds at least
  1200 ms before the next round unfolds.
- **Next round:** the waiting composition fades (150 ms) → a new folded note settles →
  it unfolds, showing only the line passed to you. Focus goes to the line input.
- **Reading:** the reader taps Read Poem N → "Opening…" → the page unfolds. Listeners'
  lamp stays on the reader. Done reading → "Finishing…" → the reader's "Nicely read."
  settles; everyone's lamp crossfades to the next reader.
- **Arrival:** a joining player's character settles into the gathering; a quiet line
  "Wren joined." updates in place.

## Copy deck

Actions keep one name through a flow. No dashes in player copy, no engineering words.

| Where | Copy |
| --- | --- |
| Home | "A little room for words." / "A poetry game for people who don't have to be poets." / caption "Write a line. Pass it on." / "Start a game", "Join a room" |
| Host entry | Title "Start a game" / "Pick a pen name. Friends join with your room code." / label "Your pen name" / helper "Friends see this name next to your character." / avatar button label "Change character, Orbit selected" / "Create room", pending "Creating room…" |
| Character sheet | Title "Choose your character" / names under each character / selection is immediate |
| Join | Title "Join a room" / "Room code" / "Your pen name" / "Join room", pending "Joining…" / prefilled: "Joining room 9A UK" with a way to change it |
| Join errors (at the field) | unknown: "No room ZZ ZZ here. Check the code with your host." / closed: "Room 9A UK has closed. Ask your host for a new code." / full: "Room 9A UK is full. It holds 8 players." / too many tries: "Too many tries. Wait a minute, then try again." |
| Invitation | label "Room code" / code "9A UK" (tap to copy) / "Share invite" / QR label "Scan to join" / copied: "Copied" / copy refused: "Couldn't copy. Read the code out or show the QR." / link copied: "Link copied" / share refused: "Couldn't share. Show the QR or read the code out." / in game: "Friends who join now watch this game and write in the next one." |
| Lobby | "Players" with "4 of 8" / host tag "Host" / arrival "Wren joined." / host alone: "Share the code. You can start when a friend joins." / guest: "Juniper will start the game." / "Start game", pending "Starting…" |
| Room options | "How to play", "Your poems", then "Close room" (host, lobby), "Leave room" (guest, lobby) or "End game" (host, in game) |
| Confirmations | Close: "Close this room?" / "Everyone leaves this room. Saved poems stay in Your poems." / "Keep room open", "Close room", pending "Closing room…" · Leave: "Leave this room?" / "The room stays open for the others. You can rejoin with its code." / "Stay here", "Leave room" · End: "End this game?" / "Everyone returns to the lobby. Partial poems stay private." / "Keep playing", "End game" · error in the sheet: "That didn't go through. Check your connection and try again." |
| Notices | to others: "Juniper stepped away, so Wren is hosting now." / to the new host: "Juniper stepped away. You're hosting now." / to the old host: "You were away, so Wren is hosting now." / game ended: "Juniper ended the game. Partial poems stay private." / room closed (guest): "Juniper closed the room. Your poems are saved in Your poems." / host after closing: "Room 9A UK is closed." / offline: "You're offline. Your line is safe on this phone." / reconnecting: "Reconnecting…" / back: "You're back. Round 5 is still yours." / update: "Linejam was updated. Reload to keep playing." |
| Writing | progress "Round 5 of 9" + caption: r1 "One word to start", r2 "Two words", r3 "Three words", r4 "Four words", r5 "Five words, the longest line", r6 "Four words", r7 "Three words", r8 "Two words", r9 "One word to finish" / note top: "4 lines folded away" (r2: "1 line folded away"; r1: "A fresh note. You start this poem.") / received label "Passed to you" / "Your line" / count "3 of 5 words", "5 of 5 words. Ready.", "6 of 5 words. Take 1 out." / action "Tuck it in", pending "Tucking in…" / draft: "Your draft is back." / limit: "470 of 500 characters" / retry: "We couldn't reach the room. Your line is safe." with "Try again" (offline: "Waiting for connection…") / final: "We still can't confirm your line. Reload the room to check whether it went in." with "Reload room" |
| Waiting | "Tucked into the poem." (repeat accept: "Your line was already tucked in.") / echo: You wrote "and nobody asked the moon" / "Round 6 starts when every line is in." (r9: "The reading starts when every line is in.") / "This round" with "2 of 4 lines in" / statuses "Tucked in", "Writing", "Away", "Watching" / late joiner: "You're in for the next game." + "Watch the poems take shape. You'll write from the next game." / spectator row: "Joined late. Plays the next game." / no data yet: "Gathering this round." |
| Reading, listener | "Listen." / "Marguerite is reading Poem 1." / "Follow along" (quiet; only after the reader has opened) / "You read 4th" + "Poem 4 stays folded until your turn." / "Reading order" with "Read", "Reading now", "Up next" / "Read again" on read poems |
| Reading, reader | "Your turn to read." / "Poem 1, nine lines. Read it aloud to the room." / "Read Poem 1", pending "Opening…" / page: "Poem 1", "Read by Marguerite" / key "Lines by" + "Tap a name to see their lines." / "Done reading", pending "Finishing…" / after: "Nicely read." + "Basil reads next." |
| Reading, fallback | "Basil stepped away." / "Read Poem 2 for Basil?" / "Step in and read" / page byline "Read by Juniper for Basil" |
| Reading, spectator | "You joined during this game. You'll write in the next one." |
| Recap | title "All four poems, read aloud." / meta "4 poems · 4 poets · Room 9A UK" / each poem whole with "Read by …" and a Favorite toggle (no counts, no crown) / "Play again" (primary), "Back to lobby" / "Share these poems" + "Anyone with the link can read them." / shared: "Link copied. Anyone with it can read these poems." + "Stop sharing" / "Your poems", "Exit room" / room closed: "Start a new room" |
| Keep and share | poem page back link "Your poems" / "Favorite", "Save image", "Share poem" + "Anyone with the link can read this poem.", "Print" / shared: "Link copied." + "Stop sharing" / public poem: "Written at a Linejam table by Juniper, Wren, Basil and Marguerite." + "Write one with your friends" with "Start a game", "Join a room" / public recap: "Four poems from a Linejam table" / archive title "Your poems", "4 poems · 1 favorite · 9 lines written", "These poems live in this browser." / empty: "Your first poem starts with friends." + "Every poem you help write lands here." |
| Not found | room: "This room isn't here." / "The code may be wrong, or the room has closed." / page: "This page wandered off." / "Go home", "Join a room" / crash: "Something went wrong." / "Try again" |

## Components (foundation contract)

The lead owns `foundation.css` and `foundation.js` and documents the API in
`FOUNDATION.md`. Slices call these helpers and add only slice-local CSS. Minimum set:
header and chrome, icon button, buttons (primary, secondary, quiet, danger; pending and
disabled), character (size, prop, lamp, outlined, sticker edge), roster row, gathering
grid, invitation card (idle, copied, copy refused, link copied, share refused), anchored
menu, bottom sheet, confirmation sheet, notice banner, round glyph (a horizontal
1-2-3-4-5-4-3-2-1 silhouette: past rounds plum at 45%, current violet, future
`--color-border-subtle`), note (fresh, received, draft, pending, over count, read-only),
word slots and count text, waiting hero, reading hero (listener, reader, fallback,
spectator), reading order list, poem sheet (reader page, listener, archive, public;
"Lines by" key with tap-to-highlight), poem card (recap, archive), empty state, the
motion helpers (`tuck`, `settle`, `unfold`, `lamp`) that honor reduced motion, and a
screen registry every slice file pushes into.

## States

Screen ids reuse the before gallery ids so every before capture pairs with its after.
"You" names whose phone it is. `x-` ids are states the before survey could not force or
that exist only in the synthesis. All content comes from `../kit/content.js` unless a
slice needs a local fixture.

| Owner | Ids |
| --- | --- |
| core (lead) | `13-lobby-host-ready` (Juniper, 4 players), `31-writing-r5-under-count` (interactive: type to 5 words, Tuck it in, tuck, waiting), `24-waiting-ack-roster`, `38-reveal-reading-circle-host-reader` (listener Juniper; Marguerite reading Poem 1), `39-reveal-reading-now-reader` (Marguerite; interactive Read Poem 1 to the page), `42-poem-reading-reader` (Marguerite's page; Done reading to "Nicely read."), `52-recap-session-complete-host`, `x-components` (every component and state on one scroll) |
| entry | `01-entry-home`, `02-entry-home-more-menu`, `03-entry-how-to-play`, `04-host-entry-empty`, `05-host-avatar-picker`, `06-host-entry-filled`, `07-host-creating`, `09-join-empty`, `10-join-error-unknown-code`, `11-join-prefilled-code`, `76-join-error-closed-room`, `x-join-error-full-room`, `x-host-create-error`, `98-host-loading` (branded shell while the guest session starts; no "Creating room…" before any action), `73-after-close-room-host` (home with notice), `77-room-not-found`, `78-route-not-found`, `x-error-boundary`, `x-update-notice` |
| lobby | `08-lobby-host-alone`, `12-lobby-guest` (Wren), `14-lobby-room-options-host`, `15-lobby-close-room-confirm`, `16-lobby-code-copy-feedback`, `17-lobby-share-invite-fallback`, `18-lobby-room-options-guest`, `19-lobby-leave-confirm-guest`, `26-ingame-invite-panel`, `27-ingame-room-options-host`, `28-ingame-end-game-confirm`, `65-lobby-after-host-handoff-exhost` (Juniper returns; Wren hosts), `66-lobby-new-host` (Wren), `72-lobby-after-end-game-guest`, `93-invite-copy-denied`, `94-invite-share-error`, `x-confirm-pending`, `x-confirm-error`, `x-lobby-full` (8 players), `x-lobby-arrival` (plays one arrival settle on load), `x-lobby-start-error` |
| writing | `20-writing-r1-empty`, `21-writing-r1-over-count`, `22-writing-r1-ready`, `29-writing-r2-previous-line`, `30-writing-r3-draft-restored`, `34-writing-r5-reconnected`, `35-writing-submit-offline-pending`, `36-writing-r9-final-word`, `97-writing-near-char-limit`, `x-writing-retry`, `x-writing-final-error`, `x-writing-reconnecting`, `23-waiting-ack-early` (acknowledged, roster not loaded yet), `25-waiting-three-of-four`, `32-late-joiner-spectator` (Pim), `33-waiting-player-away`, `37-waiting-r9`, `x-waiting-already-recorded`, `x-round-turn` (plays waiting to next round unfold on load), `x-last-submitter` (plays tuck, 1200 ms hold, unfold) |
| reveal | `40-reveal-waiting-turn` (Wren, reads 3rd), `41-reveal-spectator` (Pim), `44-reveal-while-other-reads` (Poem 1 opened, Marguerite still reading), `45-poem-favorited`, `46-reveal-after-own-read` (Marguerite after Done reading), `47-reveal-spectator-read-available`, `48-poem-reading-readonly` (Pim follows along), `49-reveal-absent-reader-fallback` (Juniper; Basil away), `50-poem-reading-fallback-reader`, `51-reveal-last-poem-host` (Juniper's turn, Poem 4), `x-follow-along` (listener opens the poem after the reader has), `x-lamp-move` (plays the lamp crossfade to Basil on load) |
| keep | `54-recap-guest` (Wren), `55-recap-spectator` (Pim), `56-recap-shared-feedback`, `74-after-close-room-guest`, `57-public-recap-page` (visitor), `59-poem-detail-participant`, `60-poem-detail-shared`, `61-public-poem-page` (visitor), `63-archive-populated`, `64-archive-empty`, `x-share-preparing`, `x-recap-arrival` (plays the recap settling in after the last Done reading) |

Captured as variants of the screens above (no separate screen): Dark (`?theme=dark`),
320 px, 200% text (`?text=200`), keyboard height (390x460), desktop 1280x800, scrolled
positions. Out of scope: sign in, sign up, callback and profile (auth-rethink owner),
sound.

## Decisions this draft assumes

Drawn for the recommendations in `../critique.md`; each is the operator's call.

- **D1** Done reading is shared: the lamp and "Reading now" move when the reader
  finishes, and the recap arrives after the last reader finishes. Needs one small Convex
  field and mutation. States `44`, `46`, `x-lamp-move` and `x-recap-arrival` depend on it.
- **D2** No crown or heart count on the recap; hearts stay personal favorites.
- **D3** Listeners get a quiet "Follow along" only after the reader has opened the poem.
- **D4** The line action reads "Tuck it in" (pending "Tucking in…"), matching the
  acknowledgement. Alternative: keep "Submit".

## Implementation mapping (for after a direction is accepted)

| Synthesis piece | Product owner files |
| --- | --- |
| Header, menus, confirmations, notices | `components/RoomChrome.tsx`, `components/Header.tsx`, `components/ColorModeControl.tsx`, `components/SoundControl.tsx`, `components/ConnectionStatus.tsx` |
| Invitation card | `components/RoomInvite.tsx`, `hooks/useShareLink.ts` |
| Gathering, guest status line, arrival | `components/Lobby.tsx` |
| Note, tuck, round glyph, slots | `components/WritingScreen.tsx`, `components/ui/RoundProgress.tsx` (shares the silhouette with `components/archive/PoemSilhouette.tsx`) |
| Waiting hero and roster props | `components/WaitingScreen.tsx`, `components/ui/Avatar.tsx` (sticker edge and props wrap the shipped art) |
| Reading hero, lamp, order, fallback | `components/RevealPhase.tsx` (+ D1 backend: `convex/game.ts`) |
| Poem sheet, Lines by key | `components/PoemDisplay.tsx`, `app/poem/[id]/PoemDetail.tsx` |
| Recap | `components/SessionRecapHub.tsx`, `app/recap/[code]/RecapPage.tsx` |
| Entry, join, errors | `app/page.tsx`, `app/host/page.tsx`, `app/join/JoinPage.tsx`, `components/AvatarPicker.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/room/[code]/RoomPage.tsx` |
| Archive | `app/me/poems/page.tsx`, `components/archive/*` |
| Cold start | webfont preload in `app/layout.tsx`; host/join shell instead of the "Creating room…" spinner |

## Validation plan

Every state above captured at 390x844 in Light, plus the Dark, 320 px, 200% text,
keyboard-height and desktop variants listed in the pairing table; motion recorded at
quarter speed for tuck, unfold, settle and lamp; reduced motion checked with
`prefers-reduced-motion: reduce` on every interactive screen; no horizontal scroll at
320 px; QR decoded with `zbarimg`. Prototype captures prove appearance only, never
product behavior.
