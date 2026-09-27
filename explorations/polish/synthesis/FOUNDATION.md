# Tucked In: foundation API

The shared layer every slice builds on. Owner: TuckedInLead (message `agent://TuckedInLead`
for a foundation change; never edit `foundation.*` or `screens/core.*` yourself).

Files: `foundation.css` (all shared styles, class prefix `ljs-`), `foundation.js` (global
`LJS`), `screens/core.js` + `screens/core.css` (the reference screens), `index.html` (load
order). Slices write only `screens/<slice>.js` and `screens/<slice>.css`, use a slice class
prefix (`entry-`, `lobby-`, `writing-`, `reveal-`, `keep-`), and add only slice-local CSS.

Open `index.html?screen=x-components` for every component and state, labeled. It is the
visual reference for this document.

## Slice rules

1. **Register screens** with `LJS.add({ id, label, group, render(root, ctx) })`. Ids come
   from the spec table. Groups: `entry`, `lobby`, `writing`, `waiting`, `reveal`, `poem`,
   `recap`, `keep`, `components`.
2. **Every screen starts with `LJS.page(root, …)`.** Never build your own header, notice
   slot or live region. The document scrolls; no inner scroll containers (open sheets are the
   only exception and are built in).
3. **One focal point.** At most one `variant: 'primary'` button per screen. Place it in a
   `<div class="ljs-action">` as the last child of `main`: it sits at the bottom when there is
   room and directly after the content when there is not (never fixed, so 200% text never
   hides it).
4. **Accent roles.** Violet: the one primary action and the current round (already in the
   components). Mint: accepted (`statusChip('in')`). Peach: someone's turn (lamp,
   `statusChip('now')`). Do not add colored surfaces; derive anything new from tokens with
   `color-mix`.
5. **Type.** Use the classes, not new sizes:

   | Role | Class or component | Style |
   | --- | --- | --- |
   | Wordmark | `LJS.wordmark()` / header | DynaPuff 600, 1.5rem, violet |
   | Acknowledgement | `.ljs-display` | DynaPuff 600, 1.75rem ("Tucked into the poem.", "Nicely read.") |
   | Home headline (entry only) | slice CSS | DynaPuff 600, `clamp(2.5rem, 10vw, 3.5rem)` |
   | Page title | `.ljs-title` | Nunito 700, 1.75rem / 1.15 |
   | Hero line | `.ljs-hero-line`, `.ljs-hero__title`, `.ljs-note__received` | Nunito 600, 1.625rem / 1.25 |
   | Section heading | `.ljs-h2`, `LJS.sectionHead` | Nunito 700, 1.125rem |
   | Poem, reading aloud | `poemLines(size 'lg')` | 1.5rem / 1.45 |
   | Poem, listener/archive | `poemLines(size 'md')` | 1.25rem / 1.5 |
   | Poem, cards | `poemLines(size 'sm')` | 1.125rem / 1.5 |
   | Body | default | 1rem / 1.5 |
   | Secondary | `.ljs-secondary` | 0.9375rem, text-secondary |
   | Label | `.ljs-label` | 0.875rem, 600, sentence case |
   | Line input | note textarea | 1.375rem; other inputs 1.125rem |

6. **Spacing.** Page padding is `--ljs-pad` (20 px, 16 px at 360 px and below); column
   max `--ljs-col` (440 px). `main` stacks sections with `--space-4`; inside a section use
   `--space-2` / `--space-3`; between large compositions `--space-5`. Radii: `--radius-lg`
   paper, `--radius-md` buttons and inputs, `--radius-full` chips.
7. **Copy** comes from the spec's copy deck verbatim. Many strings are already inside the
   helpers (confirmations, notices, statuses, round captions, invitation feedback).
8. **Motion** only through `LJS.motion.*` and `LJS.tuckSequence`, only after a committed
   change, always after a pending label. Never loop or idle. The helpers honor
   `prefers-reduced-motion` (end state at once). If you animate anything else, check
   `LJS.reduced()` first.
9. **Recording hook.** Every scripted-motion or interactive screen (all `x-` motion screens,
   31, 39) sets `window.__replay = () => { … }` inside `render`, which re-renders the screen
   into `root` at its starting state without reloading (close overlays, scroll to top). For
   screens that play on load, `__replay` plays the sequence again. Example in
   `screens/core.js` (31 resets to five typed words, 39 to "Your turn to read.").
10. **Navigation between states** uses `LJS.go(id)`; it only navigates when that id is
    registered and keeps the theme. Return value `false` means stay put (restore the button).
11. **Accessibility.** Characters are decorative next to a visible name (default). Every icon
    button needs a label (`LJS.iconButton` requires it). After a state change, move focus
    with `heading.focus({ preventScroll: true })` on a `tabindex="-1"` heading and announce
    with `page.say(text)`.

## Utilities

| Helper | Signature | Notes |
| --- | --- | --- |
| `LJS.R` | `LJ.room` | Sample room from `kit/content.js`. |
| `LJS.add` | `add({ id, label, group, render })` → entry | Replaces an entry with the same id. |
| `LJS.has` / `LJS.go` | `has(id)` → bool; `go(id)` → bool | See rule 10. |
| `LJS.esc` | `esc(text)` | Escape text for HTML strings. Always escape names and lines. |
| `LJS.el` | `el(html)` → Element | First element of an HTML string. |
| `LJS.wait` | `wait(ms)` → Promise | Simulated server time (700 ms tuck, 600 ms open/finish/start). |
| `LJS.reduced` | `reduced()` → bool | `prefers-reduced-motion: reduce`. |
| `LJS.words` | `words(text)` → number | Word count as the game counts. |
| `LJS.ordinal` | `ordinal(4)` → `'4th'` | |
| `LJS.first` / `LJS.person` | `first('marguerite')` → `'Marguerite'`; `person(id)` → player | Accepts ids or player objects. |
| `LJS.uid` | `uid('prefix')` | Unique ids when a component appears twice. |
| `LJS.icon` | `icon(name, size = 22)` | Names in `LJS.ICON_NAMES`: monitor, sun, moon, sound, muted, more, user, copy, check, share, close, info, alert, offline, refresh, heart, folds, back, crown. |

## Page and chrome

### `LJS.page(root, { header, body, notices, mainClass, label })` → ctx

Builds header, notice slot (in flow, under the header), `<main class="ljs-main">` and a
polite live region.

- `header`: options for `LJS.header` or `false` for none.
- `body`: HTML for `main`. `notices`: array of `LJS.NOTICE` keys or notice objects shown on load.
- Returns `{ root, el, main, say(text), notice(n, { settle = true }) }`. `ctx.notice` inserts a
  banner under the header, settles it and announces its text.

```js
LJS.add({ id: '66-lobby-new-host', label: 'Lobby, new host (Wren)', group: 'lobby', render(root) {
  const pg = LJS.page(root, { header: { left: 'wordmark', menu: 'lobbyHost' }, notices: ['handoffNewHost'],
    body: `${LJS.invitation()}<div class="ljs-action">${LJS.button({ label: 'Start game', size: 'lg', block: true })}</div>` });
} });
```

### `LJS.header({ left = 'wordmark', menu = 'more', signIn = false })` → HTML

- `left`: `'wordmark'` (home, entry, lobby, keep pages), `'code'` (in game: the room code
  chip, opens the in-game invitation panel), `'none'`.
- Always one row: the icons never wrap; the wordmark (capped at 25 px, a logotype) and the chip (capped at
  22 px) stop growing with text size and truncate before the icons would wrap.
- `menu`: `'lobbyHost'` (Close room), `'lobbyGuest'` (Leave room), `'game'` (host in game:
  End game), `'gameGuest'` (Leave room), `'more'` (outside a room: "More options"), or `null`.
- `signIn`: adds the ghost Sign in icon (home only).
- Appearance cycles System → Light → Dark and toggles `html.dark` for real; starts at Dark
  with `?theme=dark`, otherwise System. Sound toggles `aria-pressed` ("Mute sound").

### Anchored menu

Opened by the header's options button (delegated). `LJS.menuMarkup(kind, { static: true })`
renders an open menu in flow for a capture. Keyboard: arrows, Home, End, Escape (returns
focus), Tab closes. Items call `LJS.menuActions[key](opener)`; defaults: `how` → go
`03-entry-how-to-play`, `poems` → go `63-archive-populated`, `close`/`leave`/`end` → the
confirmation sheet. A slice may replace an action: `LJS.menuActions.how = (opener) => …`.

To render a state with the menu open on load (14, 18, 27):

```js
const pg = LJS.page(root, { header: { left: 'wordmark', menu: 'lobbyHost' }, body: … });
LJS.openMenu(pg.el.querySelector('[data-ljs="menu"]'));
```

`LJS.openInvite(chipButton, { state })` opens the compact in-game invitation (26; pass
`state: 'copy-refused'` or `'share-refused'` for 93 and 94). It is a panel **in flow** directly
under the header with a clear edge (`--shadow-lg` plus a 1 px ring): it pushes the page down
rather than covering it, so the received line and Tuck it in stay on the page at any text
size. The chip toggles it; Escape closes it and returns focus to the chip; outside taps do not
close it (that would shift the note under the finger). A writing stage marked `data-stage`
drops its top offset while the panel is open.
`LJS.closeOverlay({ returnFocus = true })` closes whatever is open.

### Bottom sheet

- `LJS.openSheet({ title, body, actions, close = true, className, opener, onClose })` →
  `{ el, close() }`. Modal: the page goes `inert`, Tab loops inside, Escape and the scrim
  close it, focus returns to `opener`. Focus starts on `[data-autofocus]` or the first control.
- `LJS.sheetMarkup({ …same, static: true })` → HTML of an open sheet in flow (captures).
- Any element with `data-ljs="dismiss"` inside closes the sheet.

### Confirmation sheet

- `LJS.confirm(kind, { opener, state = 'idle', onConfirm, pendingMs = 700 })` → handle.
  `kind`: `'close' | 'leave' | 'end'`; copy is in `LJS.CONFIRM`. `state: 'pending' | 'error'`
  renders those states on open (x-confirm-pending, x-confirm-error). Default action: pending
  label ("Closing room…", "Leaving room…", "Ending game…"), then `go()` to 73, 01 or 13.
  `onConfirm(handle, actionButton)` replaces the default.
- `LJS.confirmMarkup(kind, { state, static = true })` → HTML for a static capture.
- Focus starts on the safe button.

```js
LJS.confirm('close', { opener: menuButton, state: 'error' });
```

### Notices

- `LJS.notice({ tone, text, action })` → HTML. `tone`: `info`, `success`, `offline`,
  `pending`, `error`; icon shape plus words, never color alone. `action`: `{ label, attrs }`
  renders a quiet button (the update notice uses `data-ljs="reload"`).
- `LJS.NOTICE` has every deck notice: `handoffOthers`, `handoffNewHost`, `handoffOldHost`,
  `gameEnded`, `roomClosedGuest`, `roomClosedHost`, `offline`, `reconnecting`, `back`,
  `update`, `arrival` ("Wren joined.").
- Show on load via `page(…, { notices: ['offline'] })` or later with `pg.notice('back')`.

## Buttons

### `LJS.button({ label, variant, size, block, icon, disabled, pending, attrs, className })` → HTML

- `variant`: `'primary'` (the one violet action), `'secondary'` (outlined), `'quiet'`
  (underlined text, e.g. "Follow along", "Stop sharing", "Exit room"), `'danger'`
  (confirmation action only).
- `size`: `'md'` (48 px), `'lg'` (56 px, the screen's primary), `'sm'` (44 px).
- `pending: 'Starting…'` renders the pending state (keeps its color, `aria-busy`).
- `disabled: true` renders the disabled state. `attrs` is a raw attribute string (`'data-start'`).

### `LJS.pending(button, label)` → `restore()`

Swaps the label, sets `aria-disabled` and `aria-busy` (focus stays on the button). Ignore
clicks while `aria-busy="true"`.

```js
start.addEventListener('click', async () => {
  if (start.getAttribute('aria-busy') === 'true') return;
  const restore = LJS.pending(start, 'Starting…');
  await LJS.wait(600);
  if (!LJS.go('20-writing-r1-empty')) restore();
});
```

### `LJS.iconButton({ icon, label, attrs, className })` → HTML

44 px ghost icon button. `label` is required.

## The cast

### `LJS.character(who, { size = 44, prop, lamp, outlined, label, edge = true, className, avatar })` → HTML

- `who`: player id (`'juniper'`), player object, or cast id (`'orbit'`).
- Sticker edge on by default (Light: 2.4% of size, 1 to 2 px, white; Dark: 3.2%, 1 to 3 px,
  near-white). `edge: false` only for the x-components comparison.
- `prop`: `'crown'` (host), `'pencil'` (writing), `'note'` (sealed note, tucked in), `'moon'`
  (away), `'book'` (open book, reading). Props always sit next to their words.
- `lamp`: `true` (peach disc behind, room reserved around it), `'off'` (disc present but hidden,
  ready for `motion.lamp`).
- `outlined: true`: spectators (Pim). No sticker edge; the outline takes the text color, which
  is legible in both modes.
- `label`: gives the SVG `role="img"`; leave empty when a name is visible.

Sizes in use: 28 (chips, bylines), 36 to 40 (rows), 56 to 72 (gathering, pickers), 96 to 128
(heroes).

```js
LJS.character('marguerite', { size: 120, lamp: true, prop: 'book' })
```

## Rooms and players

### `LJS.gathering(players = R.players, { size = 72, you, arriving })` → HTML

Grid of characters with full names beneath (long names wrap). Host gets the crown prop and
the word "Host". `arriving: 'wren'` marks that item `[data-arriving]`; settle it yourself:
`LJS.motion.settle(pg.main.querySelector('[data-arriving]'))`, then update a quiet
"Wren joined." line or `pg.notice('arrival')`. One column at 200% text.

### `LJS.invitation({ state = 'idle', compact, inGame, full, qrSize, id })` → HTML

Paper card: "Room code", the tap-to-copy code, real QR (140 px; 132 compact) with "Scan to
join", "Share invite". `state`: `'idle' | 'copied' | 'copy-refused' | 'link-copied' |
'share-refused'` (feedback text sits at the control that produced it). `inGame` adds "Friends
who join now watch this game and write in the next one." `full: true` replaces Share invite
with "This room is full. It holds 8 players." (code copy and QR stay). The QR drops below the code when the
code column cannot keep its basis (320 px, 200% text). Live behavior is delegated: copy tries
the clipboard, share tries `navigator.share` then copies the link; refusals show their copy.

### Roster

- `LJS.rosterRow({ player, status, you, note, size = 40, statusText, extra })` → `<li>`.
  `status`: `'in'` (Tucked in, mint chip, sealed note), `'writing'` (pencil), `'away'`
  (moon), `'watching'` (outlined), `'read'`, `'now'` (Reading now, peach chip), `'next'`
  (Up next). `extra`: HTML placed before the status (e.g. a quiet button).
- `LJS.waitingRoster({ statuses, you, spectators, id })` → "This round" section with
  "N of M lines in", the rows, and spectators set apart under a dashed rule with "Joined late.
  Plays the next game." `statuses` maps player id → status.
- `LJS.statusChip(key, text)` → the status element alone.
- `LJS.sectionHead({ title, count, id, level = 2 })` → heading row with a quiet count.

```js
LJS.waitingRoster({ statuses: { juniper: 'in', wren: 'in', basil: 'in', marguerite: 'away' } })
```

## Writing

### `LJS.roundGlyph(round, { caption = true, label = true })` → HTML

Nine bars shaped 1-2-3-4-5-4-3-2-1: past rounds plum at 45%, current violet, future
border-subtle. Label "Round N of 9" plus the deck caption (`LJS.ROUND_CAPTION`).

### `LJS.note({ round = 5, received, value, draft, readonly, folded, id, limit = 500, message, messageTone = 'info' })` → HTML

The white note in two equal halves around a crease. Top: "N lines folded away" (hidden
on short viewports), "Passed to you", the received line (defaults to Juniper's assignment for
that round; round 1 shows "A fresh note. You start this poem."). Bottom: optional message
(`draft: true` → "Your draft is back."; `message` for others), "Your line", the textarea
(22 px), word slots and count text, the character limit line from 450 characters.
`messageTone: 'error'` renders the message with the alert icon in the error color and
`role="alert"` (retry and final-error states).
`readonly: true` for pending/uncertain states. `folded: true` renders the tucked end state.

### `LJS.bindNote(noteEl, { button })` → `{ input, update, words() }`

Grows the input to its content up to about six lines (`max-height: 11.25rem`, then it
scrolls inside; past three lines the note drops its equal halves via
`.is-tall` so the received line stays near the input; the tuck restores them). Live count,
slots, `aria-invalid` when over, the button enabled only at the exact count,
Enter submits when ready and never inserts a newline, pasted newlines become spaces.

### `LJS.wordSlots(n, target)`, `LJS.countText(n, target)`

"3 of 5 words", "5 of 5 words. Ready.", "6 of 5 words. Take 1 out."

### `LJS.tuckSequence({ page, stage, noteEl, button, render, pendingMs = 700, announce, onPending })` → Promise

The line-accepted sequence: "Tucking in…" (solid primary, label swap only) → wait → tuck
(320 ms, `--ease-fold`; the action stays solid while the flap starts, fades over the last
150 ms and stays hidden) → at once `motion.swap(stage, next)`: the folded note fades while
`render()` (wrapped in `.ljs-stage-next`) settles in its place, one 240 ms beat; focus moves
to `[data-ljs-ack]` (or the first heading); `page.say(announce)`.

```js
btn.addEventListener('click', () => LJS.tuckSequence({ page: pg, stage, noteEl, button: btn,
  render: () => `${LJS.waitingHero({ line: input.value })}${LJS.waitingRoster()}` }));
```

For the next round (x-round-turn, x-last-submitter): after the acknowledgement (hold at least
1200 ms for the last submitter), build the new stage with `note({ round, folded: true })` and
its action, `await LJS.motion.swap(waitingEl, newStage)` (or `fade` then `settle`), then
`await LJS.motion.unfold(noteEl, { kind: 'note', action })`: the action is hidden while the
note opens and fades in afterwards. Focus the textarea.

## Waiting and reading

### `LJS.waitingHero({ you, line, round = 5, repeat, id })` → HTML

Your character (112 px) holding the sealed note, "Tucked into the poem." (`repeat: true` →
"Your line was already tucked in."), `You wrote "…"`, "Round N+1 starts when every line is
in." (round 9: "The reading starts when every line is in.").

### `LJS.readingHero({ mode, poem = 1, reader, next, absent, follow = true, lampMoved, id })` → HTML

- `'listener'`: reader on the lamp, "Listen." + "Marguerite is reading Poem 1.", quiet
  "Follow along" (`data-ljs-follow`; `follow: false` hides it, D3). The open-book prop shows
  only once the reader has opened the poem: `opened` defaults to `follow`.
- `'reader'`: "Your turn to read.", "Poem 1, nine lines. Read it aloud to the room." Place the
  loud "Read Poem 1" yourself in `.ljs-action`.
- `'fallback'`: `absent` player with the moon on the lamp, "Basil stepped away.", "Read Poem 2
  for Basil?". Place "Step in and read".
- `'spectator'`: listener plus "You joined during this game. You'll write in the next one."
- `'after'`: "Nicely read." + "Basil reads next." with a small next-reader character. After
  the last poem (or `next: null`) the "reads next" line is omitted.
  `lampMoved: true` renders the end state; otherwise call
  `LJS.motion.lamp(readerChar, nextChar)` after it settles.

### `LJS.yourTurnRow({ you, poem })` → HTML

"You read 4th" / "Poem 4 stays folded until your turn." with your character holding the note.

### `LJS.readingOrder({ current = 0, you, readAgain, statuses, id })` → HTML

"Reading order": readers before `current` "Read", `current` "Reading now" (lamp), next "Up
next", the rest ordinals. `readAgain: true` adds a quiet "Read again"
(`data-ljs-read-again="N"`) under the "Read" status on read poems, right-aligned. `statuses` overrides per poem number.

## Poems

### `LJS.poemSheet({ poem = 1, mode = 'reader', byline, bylineBy, favorite = false, key = true, highlight, closable, bylineLamp, you, id })` → HTML

- `mode`: `'reader'` (1.5rem lines, for reading aloud), `'listener'` (closable, compact
  favorite), `'archive'`, `'public'` (1.25rem).
- Header: "Poem N" (`h1`, `tabindex="-1"` for focus), byline (default "Read by Marguerite";
  pass `byline: 'Read by Juniper for Basil'` with `bylineBy: 'juniper'` for the character, or
  `null`), Favorite toggle (`favorite: null`
  hides it), close icon when `closable` (`data-ljs-close-poem`, wire it yourself).
  `bylineLamp: true` sets the byline character at 36 px on the lamp (listener sheet while the
  poem is being read live, so the reader stays the focal point).
- Body `.ljs-sheetpoem__body` holds the nine lines (no names between lines) and the "Lines by"
  key: character chips with `aria-pressed`; tapping highlights that writer's lines and quiets
  the rest (delegated, instant). `highlight: 'wren'` renders it pressed.
- To open: render, focus the `h1`, `pg.say('Poem 1 is open.')`, then
  `LJS.motion.unfold(sheet.querySelector('.ljs-sheetpoem__body'), { kind: 'poem' })`.

### `LJS.poemCard({ poem, favorite = false, byline, bylineBy, meta, action, open, level = 2, id })` → HTML

`open: 'data-open="2"'` (attribute string) makes the title "Poem N" a button (44 px, same
type, underlined) to open the poem; wire the click yourself.

Compact paper card: "Poem N", Favorite toggle, the whole poem (1.125rem), byline (character
from `bylineBy`, default the reader), optional `meta` line (archive), optional `action` HTML
at the right of the footer (e.g. `LJS.button({ label: 'Open poem', variant: 'quiet', attrs:
'aria-label="Open Poem 2" data-open="2"' })`). No counts, no crown (D2).

### `LJS.poemLines(poem, { size = 'lg', label, highlight })`, `LJS.linesByKey(poem, { highlight, you })`, `LJS.favoriteToggle({ pressed, poem, compact })`

The pieces the sheet and card use. Favorite toggles `aria-pressed` on click; the heart fills.

### `LJS.shareBlock({ what = 'poems', state = 'idle' })` → HTML

`what: 'poems' | 'poem'`. Idle: "Share these poems" / "Share poem" plus the disclosure
line. `'preparing'`: pending "Preparing link…". `'shared'`: "Link copied. Anyone with it can
read these poems." (poem: "Link copied.") with "Stop sharing". Live behavior is delegated
(publish → pending 600 ms → shared; Stop sharing → idle).

### `LJS.emptyState({ cast = 'sprout', title, body, action, level = 1, id })` → HTML

Centered character, title (`h{level}`; use 2 under a page `h1`), body, optional action HTML.

## Motion

All return promises and resolve at once under reduced motion (end state applied).

| Helper | Verb | Motion |
| --- | --- | --- |
| `LJS.motion.settle(el, { delay })` | Settle | opacity 0 → 1, translateY 8 px → 0, 240 ms, `--ease-out` |
| `LJS.motion.tuck(noteEl, { action })` | Tuck | top half `rotateX(0 → -180deg)` at the crease, 320 ms, `--ease-fold`; `action` fades over the last 150 ms, then `visibility: hidden`; leaves `.is-folded` (the flap back is paper with a crease edge) |
| `LJS.motion.unfold(el, { kind: 'note', action })` | Unfold | folded note opens, `rotateX(-180deg → 0)`, 320 ms; `action` hidden until open, then fades in 150 ms |
| `LJS.motion.unfold(el, { kind: 'poem' })` | Unfold | sheet body `rotateX(-90deg → 0)`, opacity 1 by 45%, 420 ms, all lines as one block |
| `LJS.motion.lamp(fromChar, toChar)` | Lamp | peach disc crossfade, 300 ms, no travel |
| `LJS.motion.fade(el, { duration = 150 })` | (exit) | a composition leaves and stays `visibility: hidden` (reset `style.visibility` to reuse it) |
| `LJS.motion.swap(from, to)` | Settle in place | `from` is lifted out of flow in its box and fades while `to` (inserted after it) settles, 240 ms; `from` is then removed |

End states are committed before each animation is cancelled, so nothing flashes back.
Under reduced motion every transition is off (`transition-property: none`), so a control
un-hidden by a motion helper can take focus in the same task.
`LJS.motion.DUR` lists the durations. The note uses 3D only while folding or folded
(`.is-folding`), so resting text stays crisp.

## Shared layout classes from core

`screens/core.css` always loads. The writing slice may reuse `.core-writing` (on `main`) and
`.core-stage` / `.core-stage__action` (note plus action, with the keyboard-height compaction)
so every writing state matches 31. The reveal slice may reuse `.core-reading`, `.core-listen`,
`.core-turn`, `.core-turn__hero`, `.core-after` and `.core-page`. These names are stable.

## Delegated data attributes

Work anywhere in markup: `data-ljs="appearance" | "sound" | "menu" (+ data-menu) | "invite" |
"dismiss" | "reload" | "copy" | "share" | "fav" | "key" | "publish" | "unshare"`. Do not reuse
these names for slice behavior.

## Deviations from the spec (and why)

- Pending labels not in the copy deck: "Leaving room…", "Ending game…" (confirmations),
  "Preparing link…" (share), "Starting…" on Play again. Rule 6 requires a pending label before
  any acceptance; these follow the deck's pattern.
- Outlined spectators carry no sticker edge: the outline is drawn in the text color, already
  legible in both modes, and an edge doubled the stroke.
- The Dark lamp is peach mixed 92% with the page (not transparent), so it reads as warm light
  rather than a brown disc.
- The listener's opened poem closes with a labeled close icon ("Close Poem 1") instead of a
  new text action, to keep "Done reading" the reader's alone.
- 39 (the reader's turn) omits the reading order below the action: one focal point on the
  reader's phone. 38 and "Nicely read." keep it.
- The recap uses the wordmark header (keep page) with the host's Room options.
