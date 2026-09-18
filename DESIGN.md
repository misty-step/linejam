# Linejam design

Keep the game's identity and successful join/write/reveal loop. Refine through
subtraction, clearer hierarchy and better character art—not competing visual
directions.

## Identity

`lib/design/tokens.ts` owns colors, type and spacing. `lib/colorMode/` owns the
persisted Light/Dark/System preference. There is one identity in two effective
color modes.

- Lavender background, plum ink, violet actions, white content surfaces.
- Mint, peach and character colors provide deliberate accents, not eight equally
  loud controls or another mostly monochrome panel.
- DynaPuff for the wordmark, arrival and brief waiting acknowledgement; Nunito
  Sans for functional headings, names, controls and left-aligned whole poems.
- Avatars supplement names and status; they are not identity credentials or the
  only way to distinguish people.

## Interaction contract

This describes the implemented source, not a production deployment receipt.
Product rules and publication boundaries remain in `project.md` and
`docs/sharing-privacy.md`.

### Appearance: one cycling icon

One shared icon button cycles System → Light → Dark → System, showing a
monitor, sun or moon for the selected preference. No visible mode words or
appearance popover. Keep a 44px target, keyboard activation, focus ring and a
label stating current and next modes. System tracks the OS. Server/client
hydration must preserve the saved preference without mismatched icon markup.

### Sound: restrained cues, one shared preference

Cuelume live synthesis adds quiet cues on activation and confirmed results, not
speculative success or a background soundtrack. The shared `SoundControl` sits
beside appearance in `Header`, host/join and `RoomChrome`; poem and recap use
the same control and preference.

Sound is audible by default after a user gesture. Preserve an explicit stored
mute (`linejam:ceremony-muted` is `'1'`); reduced motion does not silence sound.
Muted, unavailable or blocked audio must never block play or replace visible
pending, success and error feedback.

### Entry: pen name beside the avatar

One pen-name input with the selected avatar alongside it, then Create room or
Join room. Keep a prefilled invitation code and the successful joining behavior.
The whole character cast should not permanently occupy the form.

Choose a random supported default after hydration, once per entry attempt.
Keep it stable through rerenders, typing, StrictMode and submission retries.
Tapping it opens the compact selection sheet; selection is immediate and returns
focus to the trigger. Keyboard focus stays inside until selection or dismissal.

“Available” means the supported cast, not exclusive reservation. Duplicates are
allowed; do not introduce a new join failure or a pre-join membership lookup
just to choose a character.

The eight original SVGs use distinct silhouettes, expressions and gestures,
consistent plum strokes, and mint/peach/lavender accents. Artwork is static,
local and legible at roster size in both modes. No runtime image generation or
new provider dependency is involved.

Keep honest pending and error feedback; do not render a created room or
successful join before backend acceptance. One app-level `UserProvider` owns
identity bootstrap. Mounting later room, writing, reveal or poem screens must
not re-bootstrap identity or re-fetch the guest session.

### Lobby: one invitation area, one primary action

`RoomInvite` pairs the code and a high-contrast QR with a proper quiet zone.
At large text sizes the area reflows instead of squeezing the code beside the
QR. Tapping the code copies it; Share invite uses native sharing with a
copy-link fallback. Feedback belongs at the action that succeeded or failed.

The lobby header has no duplicate code, standalone share icon or invitation
popover. There is no “Open join link” action: opening the join page on the
host's own phone does not invite another player.

Keep the roster compact and Start game visually dominant. During writing and
reading, a single compact invitation entry can live in the header because the
lobby invitation area is absent. One invitation implementation owns both uses.

Collapse secondary navigation into one Room options menu: How to play, Your
poems and the relevant leave/close/end action. Do not put the same invitation
entry in multiple places on one screen. Keep appearance and sound controls
separate and quiet; help remains reachable in one menu rather than another
top-bar icon.

### One room frame

`RoomPage` owns the shared viewport frame and `RoomChrome` across lobby, writing,
waiting and reveal. The same invitation implementation serves the inline lobby
and the compact in-game entry. There is no alternate presentation mode or stage
state. Normal whole-poem reading and absent-reader recovery remain.

### Waiting: a pleasant pause, not an administration screen

“Tucked into the poem.” acknowledges server acceptance, including while roster
data catches up. Without an acknowledgement, waiting copy stays neutral.
Keep writing, submitted, away and spectator states legible without ranking or
hurrying people; an empty roster is not proof of round completion.

Use a small character moment, a subtle background texture and accent color to
make waiting feel alive. Prefer a short settling animation on acknowledgement
over perpetual bouncing, fake progress or an endless loading spinner. Reduced
motion gets the complete static composition. Keep texture away from poem text
and input surfaces; writing and reading remain calm.

End game lives inside the host's Room options during writing or waiting.
Leave/close actions live there in the lobby. Each requires confirmation with a
clear safe exit, honest consequences and pending/error recovery. Ending returns
everyone to the lobby without revealing partial poems; closing a room is
different. No destructive action competes with the primary task at rest.

### Composition across screens

Use a consistent content width, left edge, spacing rhythm and action placement.
Group by task rather than wrap everything in another card. Let personality come
from the cast and selected moments while practical controls remain quiet.

```text
Entry                                Lobby
Linejam          [mode] [sound]      Linejam     [mode] [sound] [options]
Your pen name                        [room code       QR]
[name                ][face]         [Share invite]
[Create room]                        Players and their states
                                     [Start game]
```

The same quiet chrome continues through writing, reading and recap. There are
no extra clicks between submitting a line and seeing acceptance, or opening a
poem and reading all of it. None of this requires a Parlor backend migration.

## Acceptance for the implementation

- Exercise the actual rendered routes, not only component fixtures or sketches.
- Check 320px/390px phones, keyboard-open heights, rotation, 200% text,
  Light/Dark/System and reduced motion; preserve the existing VisualViewport owner.
- Keep inputs and actions reachable, with no horizontal scrolling; targets at
  least 44px and input text at least 16px. Icon-only never means unlabeled.
- One invitation area per screen; QR scan, native share/copy fallback, keyboard
  focus return and denied clipboard behavior all remain useful.
- Preserve drafts, uncertain-submit recovery, live roster updates, late joins,
  host permissions, full reveal, rematch and private publication boundaries.
- Remove tests for deleted presentation behavior and incidental wording/classes;
  retain checks for actual game transitions, accessibility and privacy.
- Evidence names the running revision and distinguishes viewport simulation from
  physical-keyboard or assistive-technology verification.
