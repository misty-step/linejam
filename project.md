# Project: Linejam

## Vision

A digital version of the paper-folding poetry game—casual multiplayer fun with persistent, shareable artifacts.

**North Star:** World-class casual party game with Stripe-level design and polish. Players feel delighted, not overwhelmed. The game works, it's fun, it creates memorable moments with friends.
**Target User:** Friends at a gathering who want a quick, creative, funny activity. No signup required (guest mode). Works on phones. Minimal explanation needed.
**Current Focus:** One core loop, polished to a world-class bar. The mechanic is settled—9 rounds, 1,2,3,4,5,4,3,2,1 words—and depth now comes from design, feel, and reliability, not from more modes. Sequenced path: public-launch readiness → deeper aesthetic polish → revenue stretch. Don't overcomplicate; ship and refine.
**Key Differentiators:** Lower friction than paper; persistent shareable artifacts; digital-native sharing; can evolve mechanics without physical constraints.

## Domain Glossary

| Term              | Definition                                                             |
| ----------------- | ---------------------------------------------------------------------- |
| Room              | A game session, identified by a short room code                        |
| Poem              | One collaborative poem being written in a room (multiple per game)     |
| Line              | A single contribution to a poem; constrained word count per round      |
| Assignment Matrix | 9×N array assigning which player writes which poem's line per round    |
| Round             | One of 9 rounds (word counts: 1,2,3,4,5,4,3,2,1)                       |
| Reveal            | End-of-game state where complete poems are shown to all players        |
| Guest             | Anonymous player identified by UUID in localStorage                    |
| AI Player         | Bot player using OpenRouter/Gemini to generate lines                   |
| Pen Name          | Author display name captured at write-time                             |
| WordSlot          | Genkoyoshi-inspired word count indicator UI component                  |
| Theme             | Visual skin (kenya/mono/vintage-paper/hyper) applied via CSS variables |

## Active Focus

- **Milestone:** Public-launch readiness — close the Quality Bar gaps (open security advisories, security headers + rate limits, mobile polish) so Linejam can be promoted publicly with no caveats.
- **Then:** deeper aesthetic polish (award-winning feel) → revenue stretch (print-on-demand booklets; see Stretch Goal).
- **Stance:** The 010–012 expansion arc (multiple modes, per-line sparks) was deliberately rolled back — Linejam is **one core mode, refined**. The reliability + infra foundation is laid (presence/self-heal, host migration, convex-test, Landmark releases). Powder is authoritative for shaped work; `backlog.d/` is a retired seed/archive.
- **Theme:** Restraint as the product — Kenya Hara minimalism applied to the mechanics as much as the visuals.

## Quality Bar

- [ ] Guest mode works without friction on mobile — no signup, no explanation needed
- [ ] Themes render correctly on all 4 visual skins without hardcoded overrides
- [ ] Core game loop completes reliably with 2-6 players (no silent failures)
- [ ] Security headers and rate limits in place before public promotion
- [ ] Poem sharing produces correct, readable output

## Patterns to Follow

Code patterns and snippets live in `AGENTS.md`, not here — one copy, not a
triplicated one:

- Parallel Convex mutations, N+1 batching, loop-safety guards: `AGENTS.md`
  → "Code Patterns".
- The auth helper (`convex/lib/auth.ts`, Clerk + guest-UUID fallback):
  `AGENTS.md` → "Architecture" → "Auth Pattern".
- Frontend error capture (`captureError`) and Convex structured logging
  (`logError`): `AGENTS.md` → "Observability".

## Stretch Goal

Print-on-demand poetry booklets via Lulu API: users curate favorite poems,
AI-generated art + boutique design treatment, physical artifact shipped to
them, small revenue cut per book.

## Anti-Goals

- Multiple game modes — one core loop, refined; variety comes from the players, not the mechanics (Rhyme Relay + Quick Jam were built and deleted, #275)
- Ornamental in-game nudges — e.g. per-line "sparks"; the word constraint is the only prompt the player needs (deleted #278)
- Feature bloat (no gamification, leaderboards, achievements)
- Heavy monetization (no subscriptions, no ads) — print-on-demand booklets are the only revenue bet
- Social network aspirations

## Lessons Learned

| Decision                                   | Outcome                | Lesson                                                 |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------ |
| Silent guest auth failure                  | Users saw blank screen | Always show error + retry, never silently fail         |
| logShare returning silently on bad poem ID | Hard to debug          | Use ConvexError for invalid inputs, not silent returns |

---

_Last updated: 2026-07-08_
_Updated during: Powder ledger closeout. `docs/vision.md` stays demoted to a_
_pointer at root `VISION.md`, the actual north star. This section no longer_
_restates AGENTS.md's code patterns._
