# Project: Linejam

## Vision

A digital version of the paper-folding poetry game—casual multiplayer fun with persistent, shareable artifacts.

**North Star:** World-class casual party game with Stripe-level design and polish. Players feel delighted, not overwhelmed. The game works, it's fun, it creates memorable moments with friends.
**Target User:** Friends at a gathering who want a quick, creative, funny activity. No signup required (guest mode). Works on phones. Minimal explanation needed.
**Current Focus:** Polish and production-readiness—Stripe-level design quality, award-winning aesthetic (Kenya Hara minimalism + premium themes), rock-solid infrastructure. Don't overcomplicate—core works, ship and refine.
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

- **Milestone:** Now: Current Sprint — Theme polish + security hardening
- **Key Issues:** #149 (animation quality), #148 (theme token leakage), #134 (logShare rate limit), #133 (HTTP security headers)
- **Theme:** Ship-ready polish — design quality and security fundamentals before wider promotion

## Quality Bar

- [ ] Guest mode works without friction on mobile — no signup, no explanation needed
- [ ] Themes render correctly on all 4 visual skins without hardcoded overrides
- [ ] Core game loop completes reliably with 2-6 players (no silent failures)
- [ ] Security headers and rate limits in place before public promotion
- [ ] Poem sharing produces correct, readable output

## Patterns to Follow

### Parallel Convex Mutations

```typescript
// GOOD — parallelize independent operations
await Promise.all(
  items.map((item) => ctx.db.patch(item._id, { field: value }))
);
```

### Auth Helper

```typescript
// convex/lib/auth.ts — always use this, never re-implement
const user = await getUser(ctx, args.guestId);
```

### Error Capture (Frontend)

```typescript
import { captureError } from '@/lib/error';
captureError(err, { userId, operation: 'submitLine' });
```

### Structured Logging (Convex)

```typescript
import { logError } from './lib/errors';
logError('API call failed', error, { roomId, round });
```

## Anti-Goals

- Heavy monetization (no subscriptions, no ads)
- Feature bloat (no gamification, leaderboards, achievements)
- Social network aspirations

## Lessons Learned

| Decision                                   | Outcome                | Lesson                                                 |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------ |
| Silent guest auth failure                  | Users saw blank screen | Always show error + retry, never silently fail         |
| logShare returning silently on bad poem ID | Hard to debug          | Use ConvexError for invalid inputs, not silent returns |

---

_Last updated: 2026-02-23_
_Updated during: /groom session (migrated from vision.md)_
