/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchQuery = vi.fn();
vi.mock('convex/nextjs', () => ({
  fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
}));

// See tests/app/api/poem-card-route.test.ts for why ImageResponse (a
// third-party render engine) is mocked rather than exercised for real.
let lastImageResponseCall: {
  element: unknown;
  options: Record<string, unknown>;
} | null = null;
vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(element: unknown, options: Record<string, unknown>) {
      lastImageResponseCall = { element, options };
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }) as unknown as InstanceType<typeof Response>;
    }
  },
}));

/**
 * linejam-943 refactored this route to call the shared
 * lib/poemCard/PoemCard.tsx renderer instead of inlining its own JSX. This
 * pins the pre-refactor output (metadata copy, size) so the extraction
 * stayed byte-identical for the shipped social-preview surface.
 */
describe('GET /poem/[id]/opengraph-image (post-extraction regression)', () => {
  let Image: typeof import('@/app/poem/[id]/opengraph-image').default;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchQuery.mockReset();
    lastImageResponseCall = null;
    const mod = await import('@/app/poem/[id]/opengraph-image');
    Image = mod.default;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the 1200x630 preview size unchanged', async () => {
    mockFetchQuery.mockResolvedValue({
      lines: ['Rain', 'on rooftops'],
      poetCount: 2,
      poemNumber: 1,
    });

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    expect(lastImageResponseCall?.options).toMatchObject({
      width: 1200,
      height: 630,
    });
  });

  it('keeps the exact "By N poets · linejam.com" metadata copy', async () => {
    mockFetchQuery.mockResolvedValue({
      lines: ['Rain'],
      poetCount: 3,
      poemNumber: 1,
    });

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    expect(JSON.stringify(lastImageResponseCall?.element)).toContain(
      'By 3 poets · linejam.com'
    );
  });

  it('uses singular "poet" for a solo poem', async () => {
    mockFetchQuery.mockResolvedValue({
      lines: ['Rain'],
      poetCount: 1,
      poemNumber: 1,
    });

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    expect(JSON.stringify(lastImageResponseCall?.element)).toContain(
      'By 1 poet · linejam.com'
    );
  });

  it('renders the Linejam wordmark fallback when the poem has no public preview', async () => {
    mockFetchQuery.mockResolvedValue(null);

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('Linejam');
    expect(serialized).toContain('Collaborative Poetry');
  });
});
