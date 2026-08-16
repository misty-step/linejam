/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createCardRouteHandlers,
  type CardRouteDependencies,
  type CardRouteHandlers,
} from '@/app/poem/[id]/card/handler';

type ImageResponseArguments = Parameters<
  CardRouteDependencies['createImageResponse']
>;
type ImageResponseOptions = ImageResponseArguments[1];

const mockFetchQuery = vi.fn();
const mockGetToken = vi.fn();

let lastImageResponseCall: {
  element: ImageResponseArguments[0];
  options: ImageResponseOptions;
} | null = null;

describe('GET /poem/[id]/card', () => {
  let GET: CardRouteHandlers['GET'];
  let POST: CardRouteHandlers['POST'];
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchQuery.mockReset();
    mockGetToken.mockReset();
    lastImageResponseCall = null;

    const dependencies: CardRouteDependencies = {
      fetchPublicPoem: (poemId) => mockFetchQuery({ poemId }),
      fetchPoemDetail: (poemId, guestToken, clerkToken) =>
        clerkToken
          ? mockFetchQuery(
              { poemId, guestToken: undefined },
              { token: clerkToken }
            )
          : mockFetchQuery({ poemId, guestToken }),
      getConvexToken: () => mockGetToken({ template: 'convex' }),
      createImageResponse: (element, options) => {
        lastImageResponseCall = { element, options };
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        });
      },
    };
    ({ GET, POST } = createCardRouteHandlers(dependencies));
  });

  function makeRequest(search = '') {
    return new NextRequest(`https://linejam.app/poem/poem123/card${search}`);
  }

  const attributedPoem = {
    poem: { indexInRoom: 2 },
    lines: [
      { text: 'Rain', authorName: 'Emily' },
      { text: 'on rooftops', authorName: 'Wendell' },
    ],
  };

  it('returns a 404 when the poem is not public', async () => {
    mockFetchQuery.mockResolvedValue(null);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'poem123' }),
    });

    expect(response.status).toBe(404);
  });

  it('renders a themed PNG for a public poem, defaulting to kenya/light', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'poem123' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Disposition')).toContain(
      'linejam-poem-3.png'
    );
    expect(lastImageResponseCall?.options).toMatchObject({
      width: 1200,
    });
  });

  it('passes every line with its human author to the renderer', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);

    await GET(makeRequest(), { params: Promise.resolve({ id: 'poem123' }) });

    // The mocked ImageResponse captures the JSX from the shared full-card
    // renderer so attribution and line content can be checked together.
    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('Emily');
    expect(serialized).toContain('Wendell');
    expect(serialized).toContain('Rain');
    expect(serialized).toContain('on rooftops');
  });

  it('falls back to the default theme for an unrecognized ?theme value', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);

    const response = await GET(makeRequest('?theme=not-a-real-theme'), {
      params: Promise.resolve({ id: 'poem123' }),
    });

    expect(response.status).toBe(200);
  });

  it('grows the card height for every registered theme and mode', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);

    for (const theme of ['kenya', 'mono', 'vintage-paper', 'hyper']) {
      for (const mode of ['light', 'dark']) {
        const response = await GET(
          makeRequest(`?theme=${theme}&mode=${mode}`),
          { params: Promise.resolve({ id: 'poem123' }) }
        );
        expect(response.status, `${theme}/${mode}`).toBe(200);
      }
    }
  });

  it('passes the poem id through to the public query', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);

    await GET(makeRequest(), { params: Promise.resolve({ id: 'poem123' }) });

    expect(mockFetchQuery).toHaveBeenCalledWith({
      poemId: 'poem123',
    });
  });

  it('renders a private card for a guest participant without publishing it', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);
    const request = new NextRequest(
      'https://linejam.app/poem/poem123/card?theme=hyper&mode=dark',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken: 'guest-token' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: 'poem123' }),
    });

    expect(response.status).toBe(200);
    expect(mockFetchQuery).toHaveBeenCalledWith({
      poemId: 'poem123',
      guestToken: 'guest-token',
    });
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('returns unavailable when Clerk cannot mint a Convex token', async () => {
    mockGetToken.mockRejectedValue(new Error('Clerk is offline'));
    const request = new NextRequest('https://linejam.app/poem/poem123/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: 'poem123' }),
    });

    expect(response.status).toBe(404);
    expect(mockFetchQuery).not.toHaveBeenCalled();
  });

  it('forwards Clerk Convex auth for a signed-in participant card', async () => {
    mockGetToken.mockResolvedValue('convex-jwt');
    mockFetchQuery.mockResolvedValue(attributedPoem);
    const request = new NextRequest('https://linejam.app/poem/poem123/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: 'poem123' }),
    });

    expect(response.status).toBe(200);
    expect(mockGetToken).toHaveBeenCalledWith({ template: 'convex' });
    expect(mockFetchQuery).toHaveBeenCalledWith(
      { poemId: 'poem123', guestToken: undefined },
      { token: 'convex-jwt' }
    );
  });
});
