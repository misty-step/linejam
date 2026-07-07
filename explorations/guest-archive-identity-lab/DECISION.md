# Guest Archive Identity Lab — Decision

**Card:** linejam-942
**Lab:** `index.html` in this directory (10 structurally distinct options, light/dark toggle)

## Winner: Option 3 — Hairline Info Strip

Extends the archive page's own existing convention: the mono, hairline-bordered
hint bar already shown to signed-in users ("Tap any poem to reveal the full
verse"). For a guest, the same strip carries an additional line: _"Saved to
this browser only. Sign up to keep it forever, on any device."_

## Why this one

- **Matches an existing pattern instead of inventing a new one.** The archive
  page already has this exact visual grammar (mono text, hairline top/bottom
  border, muted color) for exactly this purpose — a small persistent
  footnote under the header. No new chrome, no new interaction model.
- **Never a dead end.** It is not a modal, not a redirect, not gated behind a
  click — it is always present, in place, whether the guest has 0 poems or 20.
  That is the literal acceptance bar ("never dead-ends on a bare auth wall").
- **Reads as information, not a wall.** Options that scored worse on this
  axis specifically: the top banner (competes with the H1 for attention every
  visit), the first-visit modal (structurally a wall with extra steps — the
  same anti-pattern the card exists to remove), and the sticky bottom bar
  (fixed chrome that reads like the game's own gating).
- **Cheap to build and maintain.** One extra conditional line inside a
  component that already exists in the page; no new dismiss/reappear state
  machine (footer strip, corner toast, and the modal all need one).

## Runners-up considered and rejected

| #   | Option                      | Rejected because                                                                                   |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Top Manuscript Banner       | Competes with the page title every visit; heavier than the message needs                           |
| 2   | Stat-Row Chip               | Reads as a status label, not an explanation — too terse to satisfy "explains what signing in adds" |
| 4   | Ghost Card in Gallery       | Charming but pushes real poems down; needs a separate empty-state treatment                        |
| 5   | Sidebar Rail / Bottom Sheet | Two layouts (rail + sheet) for a one-line message — overbuilt                                      |
| 6   | Sticky Bottom Bar           | Fixed chrome reads like another gate, undermining the "no more walls" goal                         |
| 7   | Footer Strip                | Easy to never scroll to; a guest checking 2 recent poems may never see it                          |
| 8   | First-Visit Modal           | Structurally a wall with extra steps                                                               |
| 9   | Accordion Teaser            | Opt-in disclosure — guests who never click never learn what signing in adds                        |
| 10  | Persistent Corner Toast     | Disconnected from the content it explains; needs its own state machine                             |

## Implementation

Shipped as `components/archive/ArchiveInfoStrip.tsx`, replacing the inline
"tap to reveal" block in `app/me/poems/page.tsx`. Renders the existing hint
line when `hasPoems`, and an additional guest line whenever `!isAuthenticated`
— independently, so it appears for guests with zero poems too.
