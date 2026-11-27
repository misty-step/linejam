// The one HTTP client behind the CLI and the MCP server. It calls the same
// Worker routes as the browser, with the same guest credential, and nothing
// else: no admin key, no direct storage access, no rule of its own.

export class Rejection extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface MintedGuest {
  guestId: string;
  guestToken: string;
}

export function baseUrl(): string {
  const url = process.env.LINEJAM_URL;
  if (!url) throw new Rejection(0, 'no_target', 'Set LINEJAM_URL to the Linejam Worker, e.g. http://127.0.0.1:8787');
  return url.replace(/\/+$/, '');
}

export class Linejam {
  private readonly url: string;
  private readonly token: string | null;

  constructor(url: string, token: string | null = null) {
    this.url = url;
    this.token = token;
  }

  as(token: string): Linejam {
    return new Linejam(this.url, token);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (method !== 'GET') headers['content-type'] = 'application/json';
    let response: Response;
    try {
      response = await fetch(this.url + path, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      });
    } catch (error) {
      throw new Rejection(0, 'unreachable', `Cannot reach ${this.url}: ${(error as Error).message}`);
    }
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new Rejection(response.status, 'bad_response', 'The server did not answer with JSON');
    }
    if (!response.ok) {
      const error = (parsed as { error?: { code?: string; message?: string } } | null)?.error;
      throw new Rejection(response.status, error?.code ?? 'error', error?.message ?? `HTTP ${response.status}`);
    }
    return parsed as T;
  }

  async mintGuest(): Promise<MintedGuest> {
    const minted = await new Linejam(this.url).request<{ guestId: string; token: string }>('POST', '/api/guest', {
      fresh: true,
    });
    return { guestId: minted.guestId, guestToken: minted.token };
  }

  createRoom(penName: string, emblem: string) {
    return this.request('POST', '/api/rooms', { penName, emblem });
  }
  joinRoom(code: string, penName: string, emblem: string) {
    return this.request('POST', `/api/rooms/${encodeURIComponent(code)}/join`, { penName, emblem });
  }
  roomState(code: string) {
    return this.request('GET', `/api/rooms/${encodeURIComponent(code)}`);
  }
  startGame(code: string) {
    return this.request('POST', `/api/rooms/${encodeURIComponent(code)}/start`);
  }
  assignment(code: string) {
    return this.request('GET', `/api/rooms/${encodeURIComponent(code)}/assignment`);
  }
  submitLine(code: string, poemId: string, lineIndex: number, text: string) {
    return this.request('POST', `/api/rooms/${encodeURIComponent(code)}/lines`, { poemId, lineIndex, text });
  }
  revealPoem(code: string, poemId: string) {
    return this.request('POST', `/api/rooms/${encodeURIComponent(code)}/reveal`, { poemId });
  }
  listPoems() {
    return this.request('GET', '/api/poems');
  }
  getPoem(poemId: string) {
    return this.request('GET', `/api/poems/${encodeURIComponent(poemId)}`);
  }
  toggleFavorite(poemId: string) {
    return this.request('POST', `/api/poems/${encodeURIComponent(poemId)}/favorite`);
  }
  listFavorites() {
    return this.request('GET', '/api/favorites');
  }
}
