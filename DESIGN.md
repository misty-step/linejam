# Linejam Design Contract

The operator selected a production redesign from the renewal atlas: Jelly
Chorus's tighter composition and signature palette, Fold Club's stronger lobby
layout and approachable copy, and Word Carnival's brevity. This contract
supersedes the earlier Ink & Anticipation baseline and the atlas recommendation.
The product is **Linejam**, not the name of an exploration territory.

## Product truth and authority

Friends play on their own phones in the same room. Nine human-authored rounds
use `1,2,3,4,5,4,3,2,1` words. Each writer sees only the preceding line. The
reading circle opens each whole poem at once. No phone handoff, generated
contributions, additional modes, or changes to assignment and privacy rules.

The design contract does not authorize provider changes, production deployment,
or publication. Current requests and the operation boundaries in
`CONTRIBUTING.md` govern that work; verification must identify its actual scope.

## Identity and tokens

`lib/design/tokens.ts` remains the single token owner; `lib/colorMode/` owns
Light, Dark and System. There is one identity, not a selectable palette catalog.

| Role             | Light direction    |
| ---------------- | ------------------ |
| Background       | Lavender `#EEE8FF` |
| Content surface  | White `#FFFFFF`    |
| Ink              | Plum `#39234E`     |
| Action           | Violet `#672CB5`   |
| Character accent | Mint `#B6F1D0`     |
| Character accent | Peach `#FFB887`    |

Dark mode uses a deep plum background, a distinct raised surface, pale ink and
light violet actions. Both modes must pass the existing semantic contrast
contract. Screen components use tokens, not local palette literals.

DynaPuff gives the Linejam wordmark and arrival headings their character.
Nunito Sans carries controls, functional headings, names and complete poems.
Poems are upright, left aligned, and never set in the display face. Fonts are
local. Display typography gets quieter once play begins.

The identifying artwork is a small cast of original, distinct geometric
characters. No folded-paper logo, dog ears, paper grain, curved roster
underline, ambient jelly motion, or oversized illustration on functional views.
Every player has an avatar, with a visible selected default and a finite range
to choose from. Avatars supplement names; they are never authentication or the
only indication of state.

## Composition

An open background holds the page heading; only the form or active task needs
a container. Do not nest decorative cards. Align practical text to the left.

```text
Entry                         Writing, keyboard open
Linejam             mode     room code             help / more
Heading                      round graphic       Round 4 of 9
                             Previous line
[Your pen name           ]   [Your line                  ]
[selected avatar / cast  ]   0 / 4 words          [Submit]
[Create room             ]   -----------------------------
                             software keyboard
```

Plan critique: a pastel mascot skin would repeat the exploration's noise.
Spend personality on the wordmark and cast, not extra labels, repeated
instructions, ornamental containers, or a second visual metaphor.

## Surface decisions

- **Home:** “A little room for words.” “A poetry game for people who don't have
  to be poets.” “Write a line. Pass it on.” Clear start/join actions and a
  compact avatar ensemble; no account gate or large folding illustration.
- **Host/join:** Jelly Chorus's single form container; heading on the background.
  “Your pen name”, “Choose your avatar”, “Create room” and “Join room”.
  Invitation codes stay prefilled. No “sketch”, optional-avatar copy, or
  customization ceremony.
- **Lobby:** Fold Club's straight, compact roster organization. Code and invite
  remain prominent. Avatar, name, host mark and meaningful away state; never
  “Here” repeated after every person. Preserve join/leave/close/start behavior.
- **Shared lobby:** same identity with code and names legible across a room.
  No curved baseline or unnecessary explanatory panels.
- **Writing:** round graphic plus one word-count presentation. Previous line,
  native textarea and Submit remain reachable with the keyboard open. No word
  chips/dots plus duplicate target instructions, ready label, character counter
  in ordinary use, typing animations, or always-visible coachmark.
- **Waiting:** one brief acknowledgement and a compact named avatar group.
  State icons distinguish accepted, writing and away without ranking people.
  Never invent acceptance before the server confirms it.
- **Spectator/assignment:** Word Carnival's directness. One status or assignment,
  the relevant people and the next action. Keep real failure/recovery guidance.
- **Reading:** Jelly Chorus/Word Carnival clarity. All nine lines at once,
  consistent left edge, legible attribution and a plain Done action. Long poems
  and large text scroll rather than shrink or clip.
- **Recap/archive/account/error/export:** one coherent identity. Preserve private
  saving, explicit reversible publication, real permissions and recovery.

## Acceptance

- Verify actual rendered gameplay, not only the atlas or component fixtures.
- 390×844 and 320px widths, compact keyboard-open visible heights, 200% text,
  both color modes, System preference and reduced motion.
- Inputs and actions must remain reachable without horizontal scrolling;
  controls are at least 44px, input text at least 16px.
- Keep the existing VisualViewport owner for overlaying mobile keyboards.
- Preserve load-bearing `lib/e2eTestIds.ts` selectors and semantic access.
  Update assertions for the deliberately changed UI, never weaken behavior.
- Retain server validation, drafts, uncertain-submission recovery, late joins,
  real-time roster updates, complete reveal and rematch.
- No decorative motion while writing or reading. Sound stays opt-in.
- Keep evidence tied to the running source; distinguish simulated viewport
  checks from physical-keyboard or assistive-technology verification.
