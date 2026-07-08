# Host Presentation Stage Lab Decision

Card: `linejam-944`

## Options Explored

The HTML lab in `index.html` contains eight structurally distinct options:

1. Broadcast Board
2. Gallery Placard
3. Split Console
4. Running Order Rail
5. Reader Spotlight
6. Join Beacon
7. Ceremony Cards
8. Control Booth

## Locked Direction

Ship a hybrid of **Broadcast Board** and **Reader Spotlight**.

Why it wins:

- The lobby needs one dominant object: a large QR code and large room code. Any
  split-heavy layout makes the join action compete with secondary roster detail.
- The reveal needs a large reader label, one current poem, and one explicit
  pacing control. A theatrical control booth is useful, but only if it stays out
  of the reader's way.
- The player list and running order should be supporting rails, not cards inside
  cards. The room reads the next action first, then context.
- The direction preserves the Kenya theme's restraint while scaling type and
  whitespace for a TV.

Implementation contract:

- Host-only "Present" control in lobby and reveal.
- One tap opens a full-viewport stage surface; one tap exits.
- Lobby stage: large QR, large formatted room code, live roster, visible
  just-joined moment.
- Reveal stage: current reader attribution, running order, and manual line
  pacing for the reader's assigned poem.
- Non-host phone flow stays unchanged.
