# TODO: Share/Export Poems

## Context

- **Architecture**: DESIGN.md — Modular enhancement of existing poem page
- **Key Files**: `app/poem/[id]/page.tsx`, `convex/poems.ts`, `components/RoomQr.tsx`
- **Patterns**: Convex queries/mutations with mock DB tests (`tests/convex/*.test.ts`), RoomQr clipboard pattern

## Implementation Tasks

### Phase 1: Foundation

- [x] Create design tokens module (`lib/tokens.ts`)

  ```
  Files: lib/tokens.ts (new)
  Architecture: Single source of truth for colors/fonts used by OG image generator
  Pattern: Simple const export with `as const`, matches globals.css @theme values
  Pseudocode:
    export const tokens = {
      colors: { background: '#faf9f7', foreground: '#1c1917', primary: '#e85d2b', textMuted: '#57534e' },
      fonts: { display: 'Libre Baskerville', sans: 'IBM Plex Sans' }
    } as const;
  Success: Import works from opengraph-image.tsx, values match globals.css exactly
  Test: Type safety via compile-time check (no runtime test needed)
  Dependencies: None
  Time: 10min
  ```

- [x] Add `shares` table to Convex schema

  ```
  Files: convex/schema.ts (modify ~L93)
  Architecture: Append-only analytics table per DESIGN.md
  Pattern: Follow existing `favorites` table structure (L86-93)
  Pseudocode:
    shares: defineTable({
      poemId: v.id('poems'),
      createdAt: v.number(),
    })
      .index('by_poem', ['poemId'])
      .index('by_created', ['createdAt']),
  Success: `npx convex dev` accepts schema, generates types
  Test: Schema validation on deploy
  Dependencies: None
  Time: 10min
  ```

- [x] Create `logShare` mutation (`convex/shares.ts`)
  ```
  Files: convex/shares.ts (new)
  Architecture: Fire-and-forget analytics per DESIGN.md Module Design
  Pattern: Follow convex/favorites.ts toggleFavorite mutation structure
  Pseudocode:
    1. Optional: db.get(poemId) to validate poem exists
    2. db.insert('shares', { poemId, createdAt: Date.now() })
    3. Return void (no response needed)
  Success: Mutation callable from client, inserts record
  Test: tests/convex/shares.test.ts
    - Inserts share record for valid poemId
    - Silent no-op for invalid poemId (no throw)
  Dependencies: shares table in schema
  Time: 20min
  ```

### Phase 2: Public Query

- [x] Add `getPublicPoemPreview` query (`convex/poems.ts`)
  ```
  Files: convex/poems.ts (modify, add export after getMyPoems ~L171)
  Architecture: Public query (no auth) for OG image per DESIGN.md
  Pattern: Follow getPoemsForRoom structure but without getUser/auth checks
  Pseudocode:
    1. poem = db.get(poemId) → return null if missing
    2. allLines = db.query('lines').withIndex('by_poem').collect() // single query
    3. sort by indexInPoem
    4. poetCount = new Set(allLines.map(l => l.authorUserId)).size
    5. return { lines: allLines.slice(0,3).map(l => l.text), poetCount, poemNumber: poem.indexInRoom + 1 }
  Success: Query returns preview data without auth, returns null for invalid poemId
  Test: tests/convex/poems.test.ts (add describe block)
    - Returns { lines, poetCount, poemNumber } for valid poem
    - Returns null for invalid poemId
    - Returns correct poetCount (unique authors)
    - Limits to first 3 lines even if poem has more
    - Returns poemNumber = indexInRoom + 1
  Dependencies: None (reads existing tables)
  Time: 30min
  ```

### Phase 3: OG Image Generation

- [ ] Create dynamic OG image (`app/poem/[id]/opengraph-image.tsx`)
  ```
  Files: app/poem/[id]/opengraph-image.tsx (new)
  Architecture: Next.js file-convention OG image per DESIGN.md
  Pattern: Next.js ImageResponse API with edge runtime
  Pseudocode:
    1. export runtime = 'edge', contentType = 'image/png', size = { width: 1200, height: 630 }
    2. Fetch preview via preloadedQueryResult or direct fetchQuery
    3. Load fonts from Google Fonts URLs in parallel
    4. Truncate lines > 80 chars with "..."
    5. Return ImageResponse with:
       - Container: flex column, padding 60x80, background tokens.colors.background
       - Lines: Libre Baskerville 40px, 1.3 line-height
       - Divider: 120x2px persimmon bar
       - Meta: "By N poet(s) · linejam.com" in IBM Plex 18px
       - Stamp: 48px persimmon circle, absolute bottom-right
    6. Fallback: If preview null, show generic Linejam branding
  Success: /poem/[id]/opengraph-image returns valid 1200x630 PNG
  Test: Manual via curl or browser (visual verification)
    - Valid poem → shows 3 lines, poet count, stamp
    - Invalid poem → shows fallback branding
    - Lines > 80 chars truncate with "..."
    - Singular "1 poet" vs plural "N poets"
  Dependencies: lib/tokens.ts, getPublicPoemPreview query
  Time: 60min
  ```

### Phase 4: Page Restructure + ShareButton

- [ ] Split poem page into server/client components

  ```
  Files:
    - app/poem/[id]/page.tsx (modify to server component)
    - app/poem/[id]/PoemDetail.tsx (new, extract existing client code)
  Architecture: Server wrapper + client detail per DESIGN.md
  Pattern: Standard Next.js RSC pattern
  Pseudocode:
    page.tsx (server):
      import { PoemDetail } from './PoemDetail';
      export default function Page({ params }) {
        return <PoemDetail poemId={params.id} />;
      }

    PoemDetail.tsx (client):
      'use client';
      // Move entire existing page.tsx content here
      // Change export default to export function PoemDetail({ poemId })
      // Replace useParams() with poemId prop
  Success: Page loads identically, no visual change
  Test: Manual verification page still works with favorites
  Dependencies: None
  Time: 20min
  ```

- [ ] Add `generateMetadata` for poem page

  ```
  Files: app/poem/[id]/page.tsx (add to server component)
  Architecture: Dynamic metadata per DESIGN.md
  Pattern: Next.js generateMetadata function
  Pseudocode:
    export async function generateMetadata({ params }): Promise<Metadata> {
      // Use fetchQuery from convex/nextjs for server-side
      const preview = await fetchQuery(api.poems.getPublicPoemPreview, { poemId: params.id });
      if (!preview) return { title: 'Poem Not Found | Linejam' };
      const title = `Poem No. ${preview.poemNumber} | Linejam`;
      const description = preview.lines.slice(0, 2).join(' / ') + '...';
      return {
        title, description,
        openGraph: { title, description, type: 'article', siteName: 'Linejam' },
        twitter: { card: 'summary_large_image', title, description }
      };
    }
  Success: View page source shows correct og:title, og:description, twitter:card
  Test: Manual via curl or browser dev tools
  Dependencies: getPublicPoemPreview query
  Time: 30min
  ```

- [ ] Add ShareButton to poem detail page

  ```
  Files: app/poem/[id]/PoemDetail.tsx (modify, add ShareButton)
  Architecture: Inline ShareButton following RoomQr pattern per DESIGN.md
  Pattern: components/RoomQr.tsx clipboard implementation (L47-57)
  Pseudocode:
    function ShareButton({ poemId }) {
      const [copied, setCopied] = useState(false);
      const logShare = useMutation(api.shares.logShare);

      const handleShare = async () => {
        const url = `${window.location.origin}/poem/${poemId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          logShare({ poemId }).catch(() => {}); // Fire-and-forget
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          captureError(err, { operation: 'sharePoem', poemId });
        }
      };

      return (
        <>
          <Button variant="primary" onClick={handleShare} stampAnimate={copied}>
            {copied ? 'Copied!' : 'Share This'}
          </Button>
          <div aria-live="polite" className="sr-only">
            {copied && 'Link copied to clipboard'}
          </div>
        </>
      );
    }

    // Add after footer stats div in PoemDetail
    <ShareButton poemId={poemId} />
  Success: Button visible, click copies URL, shows "Copied!" with stamp animation
  Test: Manual + check Convex dashboard for share record
    - Click → URL in clipboard
    - Button shows "Copied!" for 2 seconds with stampAnimate
    - Share record inserted in Convex
    - Screen reader announces copy success
  Dependencies: logShare mutation, Button component stampAnimate
  Time: 30min
  ```

### Phase 5: Testing & Polish

- [ ] Add tests for shares module

  ```
  Files: tests/convex/shares.test.ts (new)
  Architecture: Unit tests for logShare mutation
  Pattern: tests/convex/favorites.test.ts structure
  Test Cases:
    - logShare inserts record with poemId and createdAt
    - logShare silent no-op for invalid poemId (doesn't throw)
    - Multiple shares for same poem create multiple records
  Dependencies: logShare mutation
  Time: 20min
  ```

- [ ] Add tests for getPublicPoemPreview

  ```
  Files: tests/convex/poems.test.ts (modify, add describe block ~L508)
  Architecture: Unit tests for public preview query
  Pattern: Existing poems.test.ts structure
  Test Cases:
    - Returns correct structure { lines, poetCount, poemNumber }
    - Returns null for invalid poemId
    - Returns correct poetCount (counts unique authors)
    - Limits to 3 lines max
    - poemNumber = indexInRoom + 1
    - Works without auth (no getUser mock needed)
  Dependencies: getPublicPoemPreview query
  Time: 30min
  ```

- [ ] Verify OG image on social platforms
  ```
  Files: None (manual testing)
  Test:
    - Twitter Card Validator: https://cards-dev.twitter.com/validator
    - LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
    - Discord: Paste URL in message
    - Slack: Paste URL in message
  Success: Preview shows poem lines, poet count, persimmon stamp
  Dependencies: All previous tasks
  Time: 20min
  ```

## Design Iteration

After Phase 4: Review ShareButton—if reused elsewhere, extract to `components/ShareButton.tsx`

## Automation Opportunities

- OG image visual regression testing (future): Snapshot compare generated images
- Share analytics dashboard (future): Query shares table for metrics

## Notes

- No new npm packages required
- No new environment variables required
- Convex schema change requires `npx convex dev` restart
- OG image caching handled automatically by Vercel CDN
