# Share/Export Poems

## Executive Summary

**Problem**: Poems exist only in-app. The "look what we made" moment dies in the room—zero organic viral growth.

**Solution**: One-click copy link + branded OG images. The poem URL IS the keepsake—it lives forever at `/poem/[id]`.

**User Value**: Every share becomes a growth vector. Branded previews on Twitter/Discord/Slack sell the experience before users even click.

**Success Criteria**: Share button prominent on poem detail page; OG images render correctly on social platforms; share count logged.

---

## User Context

**Who**: Players who just finished a game and want to share their favorite collaborative poems.

**Problems Being Solved**:

1. No way to share poems outside the app
2. No branded social preview when links are shared
3. Growth limited to word-of-mouth without visual hooks

**Measurable Benefits**:

- Each share potentially brings 1-3 new players
- Branded OG images increase click-through vs plain links
- Share count enables growth analytics

---

## Requirements

### Functional (Simplified per Jobs Review)

| ID  | Requirement                       | Priority | Notes                          |
| --- | --------------------------------- | -------- | ------------------------------ |
| F1  | Copy poem URL to clipboard        | Must     | Primary action                 |
| F2  | Dynamic OG image for `/poem/[id]` | Must     | 3 lines + "By N poets" + stamp |
| F3  | Log share count                   | Must     | Simple count, no type tracking |
| F4  | ~~Download PNG~~                  | Deferred | URL is the keepsake            |
| F5  | ~~Native share (mobile)~~         | Deferred | Copy link works everywhere     |

### Non-Functional

| ID  | Requirement         | Target                                   |
| --- | ------------------- | ---------------------------------------- |
| NF1 | OG image generation | <500ms (edge-cached)                     |
| NF2 | Image dimensions    | 1200×630px                               |
| NF3 | Touch targets       | ≥44px on mobile                          |
| NF4 | Accessibility       | ARIA labels, screen reader announcements |

---

## Architecture

### Module Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ app/poem/[id]/                                              │
│   ├── page.tsx          → generateMetadata() + ShareButton  │
│   └── opengraph-image.tsx → Edge: renders poem as PNG       │
├─────────────────────────────────────────────────────────────┤
│ lib/                                                        │
│   └── tokens.ts         → Shared color/font constants       │
├─────────────────────────────────────────────────────────────┤
│ convex/                                                     │
│   ├── poems.ts          → Add getPublicPoemPreview() query  │
│   └── analytics.ts      → New: logShare() mutation          │
└─────────────────────────────────────────────────────────────┘
```

### Interface Contracts

```typescript
// convex/poems.ts — Public query (no auth required)
getPublicPoemPreview({ poemId }): {
  lines: string[];        // First 3 lines (or fewer if poem shorter)
  poetCount: number;      // Unique authors
  poemNumber: number;     // indexInRoom + 1
}

// convex/analytics.ts — Fire-and-forget
logShare({ poemId }): void
```

### ShareButton (Deep Module)

```typescript
// Inline in poem page, not separate component
// Simple interface: just poemId prop
// Hides: clipboard API, fallback, success state, analytics

interface ShareButtonProps {
  poemId: Id<'poems'>;
  poemNumber: number;
}
```

---

## Implementation Phases

### Phase 1: MVP (~3 hours)

1. **Create shared tokens** (30m)
   - `lib/tokens.ts` with colors, fonts
   - Single source of truth for OG image + CSS vars

2. **Add `getPublicPoemPreview` query** (30m)
   - Fetch first 3 lines + poet count
   - No auth required (public poems)

3. **Build `opengraph-image.tsx`** (1h)
   - Always 3 lines, truncate at 80 chars
   - Load Libre Baskerville from Google Fonts
   - Persimmon stamp 48px, bottom-right

4. **Add `generateMetadata()` to poem page** (20m)
   - Dynamic title, description, OG tags

5. **Add "Share This" button** (30m)
   - Primary visual weight (matches "Submit Line")
   - Copy URL to clipboard on click
   - Button text changes: "Share This" → "Copied!"
   - Use existing `stampAnimate` for success celebration

### Phase 2: Analytics (~30 min)

6. **Create `logShare` mutation** (15m)
   - Simple: `{ poemId, timestamp }`
   - Fire-and-forget (don't await)

7. **Wire analytics to share button** (15m)
   - Call mutation on successful copy

### Phase 3: Polish (Future)

- Add download PNG (if users request)
- Add native share for mobile (if metrics warrant)
- Show share count on poem page ("Shared 47 times")

**Total MVP: ~3.5 hours**

---

## OG Image Design Spec

```
┌────────────────────────────────────────────────────────────────┐
│  1200 × 630px                                                  │
│                                                                │
│  Padding: 80px horizontal, 60px vertical                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │   "First line of the poem"                               │  │
│  │   "Second line continues here"                           │  │
│  │   "Third line truncates at eighty..."                    │  │
│  │                                                          │  │
│  │   ────────────                                           │  │
│  │   By 4 poets · linejam.com                    ●          │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Typography:                                                   │
│  - Lines: Libre Baskerville 40px, line-height 1.3              │
│  - Metadata: IBM Plex Sans 18px, color #57534e                 │
│  - Max 80 chars per line, truncate with "..."                  │
│                                                                │
│  Colors (from lib/tokens.ts):                                  │
│  - Background: #faf9f7                                         │
│  - Text: #1c1917                                               │
│  - Stamp: #e85d2b, 48px circle, bottom-right                   │
│  - Divider: #e85d2b, 120px × 2px                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

| Scenario                    | User Experience                   | Implementation           |
| --------------------------- | --------------------------------- | ------------------------ |
| Clipboard permission denied | Show URL in selectable text field | Fallback modal           |
| Clipboard API unsupported   | Auto-fallback to text selection   | Feature detect           |
| OG font loading fails       | Use system serif                  | try/catch, fallback font |
| Invalid poem ID             | 404 page                          | Return notFound()        |
| Analytics fails             | Silent (fire-and-forget)          | No await, catch silently |

---

## Accessibility

| Requirement          | Implementation                               |
| -------------------- | -------------------------------------------- |
| Button ARIA label    | "Copy poem link to clipboard"                |
| Success announcement | aria-live region: "Link copied to clipboard" |
| Keyboard navigation  | Tab to button, Enter to activate             |
| Touch targets        | Button size="md" (44px) on all devices       |

---

## Test Scenarios

### Happy Path

- [ ] Copy link copies correct URL to clipboard
- [ ] Button changes to "Copied!" with stamp animation
- [ ] OG image renders with 3 lines, poet count, branding
- [ ] Share logged to analytics

### Edge Cases

- [ ] Poem with 1 poet shows "By 1 poet" (singular)
- [ ] Line >80 chars truncates with "..."
- [ ] Poem with <3 lines shows what exists
- [ ] Special characters render correctly in OG

### Error Conditions

- [ ] Invalid poem ID → 404 page
- [ ] Clipboard denied → fallback to selectable text
- [ ] Font load fails → system serif fallback
- [ ] Analytics fail → no user-visible error

---

## Key Decisions

### 1. Delete Download PNG

**Decision**: Deferred to Phase 3
**Rationale** (Jobs): The URL IS the keepsake. Screenshots exist. Don't add complexity for speculative value.
**Revisit**: If users explicitly request it post-launch.

### 2. Defer Native Share

**Decision**: Deferred to Phase 3
**Rationale** (Jobs): Copy link works everywhere. Three share methods = decision paralysis.
**Revisit**: If mobile share metrics warrant (track share attempts on mobile).

### 3. Simplify Analytics

**Decision**: Count shares only, no type tracking
**Rationale** (Jobs): Know IF they share before tracking HOW. Add sophistication at 1,000+ shares.
**Schema**: `{ poemId, timestamp }` — dead simple.

### 4. Inline Button vs Component

**Decision**: Inline ShareButton in poem page
**Rationale**: Only one use case, simple enough to inline. Extract if reused elsewhere.

### 5. Button Feedback vs Toast

**Decision**: Button state change ("Share This" → "Copied!") + stampAnimate
**Rationale** (Design Systems): Matches existing RoomQr pattern, no new toast system needed, respects Kenya Hara minimalism.

---

## Files to Create/Modify

| File                                | Action | Purpose                            |
| ----------------------------------- | ------ | ---------------------------------- |
| `lib/tokens.ts`                     | Create | Shared color/font constants        |
| `convex/poems.ts`                   | Modify | Add getPublicPoemPreview query     |
| `convex/analytics.ts`               | Create | logShare mutation                  |
| `app/poem/[id]/opengraph-image.tsx` | Create | Dynamic OG image                   |
| `app/poem/[id]/page.tsx`            | Modify | Add generateMetadata + ShareButton |

---

## Success Metrics

**Week 1**: Share button click rate (% of poem views → shares)
**Month 1**: Referral traffic from social (UTM tracking on shared links)
**Month 3**: New player acquisition via shared poems

---

## Expert Review Summary

**Jobs**: "Delete download, defer native share, simplify analytics. 3.5 hours, not 12. Ship it."

**UX Advocate**: "Add clipboard fallback, screen reader announcements, 44px touch targets. Follow RoomQr pattern for success feedback."

**Design Systems**: "Create lib/tokens.ts for shared constants. Use stampAnimate for success. Stamp 48px at OG scale."
