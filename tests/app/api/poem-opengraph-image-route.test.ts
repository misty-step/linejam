/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPoemOpenGraphImage,
  type PoemOpenGraphDependencies,
  type PoemOpenGraphImageHandler,
} from '@/app/poem/[id]/opengraph-image-handler';

type ImageResponseArguments = Parameters<
  PoemOpenGraphDependencies['createImageResponse']
>;
type ImageResponseOptions = ImageResponseArguments[1];

const mockFetchQuery = vi.fn();

let lastImageResponseCall: {
  element: ImageResponseArguments[0];
  options: ImageResponseOptions;
} | null = null;

/**
 * linejam-943 refactored this route to call the shared
 * lib/poemCard/PoemCard.tsx renderer instead of inlining its own JSX. This
 * pins the pre-refactor output (metadata copy, size) so the extraction
 * stayed byte-identical for the shipped social-preview surface.
 */
describe('GET /poem/[id]/opengraph-image (post-extraction regression)', () => {
  let Image: PoemOpenGraphImageHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchQuery.mockReset();
    lastImageResponseCall = null;

    const dependencies: PoemOpenGraphDependencies = {
      fetchPoemPreview: (poemId, shareSlug) =>
        mockFetchQuery({ poemId, shareSlug }),
      createImageResponse: (element, options) => {
        lastImageResponseCall = { element, options };
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        });
      },
    };
    Image = createPoemOpenGraphImage(dependencies);
  });

  it('renders the 1200x630 preview size unchanged', async () => {
    mockFetchQuery.mockResolvedValue({
      lines: ['A spark', 'in twilight', 'glows'],
      poetCount: 3,
    });

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    expect(lastImageResponseCall?.options).toMatchObject({
      width: 1200,
      height: 630,
    });
  });

  it('keeps the exact "By N poets · linejam.com" metadata copy', async () => {
    mockFetchQuery.mockResolvedValue({
      lines: ['A spark', 'in twilight', 'glows'],
      poetCount: 3,
    });

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('By 3 poets · linejam.com');
  });

  it('uses singular "poet" for a solo poem', async () => {
    mockFetchQuery.mockResolvedValue({
      lines: ['Solo line'],
      poetCount: 1,
    });

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('By 1 poet · linejam.com');
  });

  it('renders the Linejam wordmark fallback when the poem has no public preview', async () => {
    mockFetchQuery.mockResolvedValue(null);

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('Linejam');
    expect(serialized).toContain('Collaborative Poetry');
  });
});
