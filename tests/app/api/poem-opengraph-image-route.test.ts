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
 * The route delegates to the shared fixed-identity renderer. These
 * regressions pin the social-preview metadata and dimensions.
 */
describe('GET /poem/[id]/opengraph-image (post-extraction regression)', () => {
  let Image: PoemOpenGraphImageHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchQuery.mockReset();
    lastImageResponseCall = null;

    const dependencies: PoemOpenGraphDependencies = {
      loadFonts: async () => ({ fonts: [] }),
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

  it('renders the Linejam wordmark fallback when the poem has no public preview', async () => {
    mockFetchQuery.mockResolvedValue(null);

    await Image({ params: Promise.resolve({ id: 'poem123' }) });

    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('Linejam');
  });
});
