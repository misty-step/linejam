/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetchQuery = vi.fn();
vi.mock('convex/nextjs', () => ({
  fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
}));

const { mockGetToken } = vi.hoisted(() => ({
  mockGetToken: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => Promise.resolve({ getToken: mockGetToken }),
}));

// next/og's ImageResponse drives the real Satori/resvg render pipeline,
// which needs a genuine font binary or it throws — that pipeline is a
// third-party rendering boundary (like a DB or network client), not this
// route's logic. Stub it to capture what the route asked it to render, the
// same way tests/app/api/health.test.ts mocks the Convex HTTP client.
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

describe('GET /poem/[id]/card', () => {
  let GET: typeof import('@/app/poem/[id]/card/route').GET;
  let POST: typeof import('@/app/poem/[id]/card/route').POST;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchQuery.mockReset();
    mockGetToken.mockReset();
    lastImageResponseCall = null;
    const mod = await import('@/app/poem/[id]/card/route');
    GET = mod.GET;
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeRequest(search = '') {
    return new NextRequest(`https://linejam.app/poem/poem123/card${search}`);
  }

  const attributedPoem = {
    poem: { indexInRoom: 2 },
    lines: [
      { text: 'Rain', authorName: 'Emily', isBot: false },
      { text: 'on rooftops', authorName: 'Wendell', isBot: true },
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

  it('passes every line with its author and AI marker to the renderer', async () => {
    mockFetchQuery.mockResolvedValue(attributedPoem);

    await GET(makeRequest(), { params: Promise.resolve({ id: 'poem123' }) });

    // The mocked ImageResponse captured the JSX built by
    // lib/poemCard/PoemCard.tsx's poemFullCardElement — walk its children to
    // confirm both lines and the AI tag reached the renderer (criterion 3).
    const serialized = JSON.stringify(lastImageResponseCall?.element);
    expect(serialized).toContain('Emily');
    expect(serialized).toContain('Wendell (AI)');
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

    expect(mockFetchQuery).toHaveBeenCalledWith(expect.anything(), {
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
    expect(mockFetchQuery).toHaveBeenCalledWith(expect.anything(), {
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
      expect.anything(),
      { poemId: 'poem123', guestToken: undefined },
      { token: 'convex-jwt' }
    );
  });
});
