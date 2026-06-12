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

- **Milestone:** Party-game depth — make the room experience magical, not just functional
- **Key Items:** `backlog.d/` is authoritative. Current arc: 010 (game modes platform: Rhyme Relay + Quick Jam), 011 (realtime resilience: ghostwriter rescue, rematch for all), 012 (round clock + sparks), 013 (reveal ceremony staging), 014 (mobile thumb test), 015 (doc truth)
- **Theme:** Engineered fun — tension, theater, and resilience on top of the proven core loop

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

## Stretch Goal

Print-on-demand poetry booklets via Lulu API: users curate favorite poems,
AI-generated art + boutique design treatment, physical artifact shipped to
them, small revenue cut per book.

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

_Last updated: 2026-06-12_
_Updated during: /groom session (absorbed vision.md, which is now removed)_
