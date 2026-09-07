# Project: Linejam

## Product brief

A digital version of the paper-folding poetry game—casual multiplayer fun with persistent, shareable artifacts.

**North Star:** A world-class casual party game with a distinctive, joyful identity. Players feel delighted, not overwhelmed. The game works, it's fun, it creates memorable moments with friends; elegance must not become austerity.
**Target User:** Friends at a gathering who want a quick, creative, funny activity. No signup required (guest mode). Works on phones. Minimal explanation needed.
**Selected identity:** The operator chose a hybrid of the renewal exploration: Jelly Chorus composition and palette, Fold Club's lobby layout and approachable copy, Word Carnival's brevity. The nine-round 1,2,3,4,5,4,3,2,1 mechanic, human authorship, and privacy boundaries remain unchanged. `DESIGN.md` owns the selected design; this brief does not track rollout completion.
**Key Differentiators:** Lower friction than paper; persistent shareable artifacts; digital-native sharing; can evolve mechanics without physical constraints.

## Domain Glossary

| Term              | Definition                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Room              | A game session, identified by a short room code                                                                 |
| Poem              | One collaborative poem being written in a room (multiple per game)                                              |
| Line              | A single contribution to a poem; constrained word count per round                                               |
| Assignment Matrix | 9×N array assigning which player writes which poem's line per round                                             |
| Round             | One of 9 rounds (word counts: 1,2,3,4,5,4,3,2,1)                                                                |
| Reveal            | End-of-game state where complete poems are shown to all players                                                 |
| Guest             | Anonymous player identified by UUID in localStorage                                                             |
| Pen Name          | Author display name captured at write-time                                                                      |
| Avatar            | The player's chosen character from a fixed cast, stored with their room membership                              |
| Color mode        | Appearance preference for the single visual identity: Light, Dark, or System; persisted as `linejam-theme-mode` |
| Visual identity   | Linejam's one shipped identity: violet/lavender tokens, DynaPuff wordmark, Nunito Sans interface and poems      |

## Ownership and scope

- Current requests authorize work; Linear owns work status, priorities, and selected unresolved opportunities. Historical issues and exploration receipts are context, not an automatic intake queue.
- This repository owns the game contract, accepted design, technical decisions, procedures, fixtures, and published artifacts. `VISION.md` is optional intent and constraint context, not a higher authority or required workflow.
- One human-authored core mode remains the product. Production deployment, provider configuration, backup restoration, and remote gameplay remain separately authorized operations.
- **Shipped identity:** One violet/lavender identity with a chosen-avatar cast. `lib/design/tokens.ts` owns its tokens, `lib/colorMode/` owns Light/Dark/System, and `DESIGN.md` owns the contract. `explorations/renewal/` is retained exploration evidence, not a second component system.

## Quality Bar

- Guest mode works without friction on mobile and survives Clerk failure.
- The shipped identity is legible, accessible, and coherent across light/dark preferences without accidental overrides.
- The core game loop completes reliably with 2–6 players, without silent failures.
- Security headers and rate limits remain part of the product boundary.
- Saving remains private; public poem/recap access requires explicit, reversible consent.
- Functional production smoke reaches an operator and disagrees visibly with shallow health when the player loop is down.

These are acceptance expectations, not a completion checklist or a claim of
current production verification. Evidence must name the exercised revision and
surface; proposed field studies and follow-on work belong in Linear.

## Engineering Pointers

`AGENTS.md` is the compact agent router, not a second architecture manual.
Read the owning source for implementation detail:

- Game rules and assignment: `convex/lib/gameRules.ts` and
  `convex/lib/assignmentMatrix.ts`.
- Identity: `lib/auth.ts`, `lib/guestToken.ts`, and `convex/lib/auth.ts`.
- Error capture and structured logs: `lib/error.ts`, `lib/logger.ts`, and
  `convex/lib/errors.ts`.
- Visual identity and color modes: `lib/design/tokens.ts` and `lib/colorMode/`.
- Verification and authority: `docs/testing.md` and
  `docs/ops/observability-ci.md`.

## Anti-Goals

- Multiple game modes — one core loop, refined; variety comes from the players, not the mechanics (Rhyme Relay + Quick Jam were built and deleted, #275)
- Ornamental in-game nudges — e.g. per-line "sparks"; the word constraint is the only prompt the player needs (deleted #278)
- Feature bloat (no gamification, leaderboards, achievements)
- Heavy monetization (no subscriptions, no ads); possible physical keepsakes are an unselected opportunity, not a committed feature.
- Social network aspirations

## Lessons Learned

| Decision                                   | Outcome                | Lesson                                                 |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------ |
| Silent guest auth failure                  | Users saw blank screen | Always show error + retry, never silently fail         |
| logShare returning silently on bad poem ID | Hard to debug          | Use ConvexError for invalid inputs, not silent returns |

---

_Last updated: 2026-09-07_
_Updated during: production design renewal from the operator's selected hybrid direction; prior human-only authorship cutover context remains [#419](https://github.com/misty-step/linejam/issues/419)._
