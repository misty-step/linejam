import type { RoomView } from '../../shared/types.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** A request that got no answer: the outcome is unknown, so nothing is assumed. */
export class NetworkError extends Error {}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new NetworkError('No connection. Try again');
  }
  if (response.status === 204) return null as T;
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Handled below as a malformed answer.
  }
  if (!response.ok) {
    const error = (parsed as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? 'error', error?.message ?? 'Something went wrong. Try again');
  }
  return parsed as T;
}

export type Link = 'connecting' | 'live' | 'polling' | 'reconnecting';

interface Handlers {
  state(view: RoomView): void;
  link(link: Link): void;
  /** The room is gone for this player: closed, left, or no longer a member. */
  ended(reason: 'closed' | 'left' | 'not_a_member' | 'room_not_found'): void;
}

const PING_MS = 25_000;
const PONG_MS = 10_000;
const POLL_MS = 2_500;

/**
 * Live room state. WebSocket first; if a socket cannot be held, the same
 * state is polled over HTTP until one can. Either way the server's view is
 * the only state — this never invents or merges anything.
 */
export class RoomLink {
  private socket: WebSocket | null = null;
  private stopped = false;
  private failures = 0;
  private version = -1;
  private retry: number | undefined;
  private poll: number | undefined;
  private ping: number | undefined;
  private pong: number | undefined;
  private readonly code: string;
  private readonly handlers: Handlers;

  constructor(code: string, handlers: Handlers) {
    this.code = code;
    this.handlers = handlers;
    this.wake = this.wake.bind(this);
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
    this.handlers.link('connecting');
    this.open();
  }

  accept(view: RoomView): void {
    if (view.version < this.version) return;
    this.version = view.version;
    this.handlers.state(view);
  }

  stop(): void {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    this.clear();
    window.clearInterval(this.poll);
    this.socket?.close(1000, 'bye');
    this.socket = null;
  }

  private clear(): void {
    window.clearTimeout(this.retry);
    window.clearInterval(this.ping);
    window.clearTimeout(this.pong);
  }

  /** Waking restores current state before anything else happens. */
  private wake(): void {
    if (this.stopped || document.visibilityState !== 'visible') return;
    void this.refresh();
    if (!this.socket || this.socket.readyState > WebSocket.OPEN) {
      window.clearTimeout(this.retry);
      this.open();
    }
  }

  private async refresh(): Promise<void> {
    try {
      const view = await api<RoomView | null>('GET', `/api/rooms/${this.code}?v=${this.version}`);
      if (view && !this.stopped) this.accept(view);
    } catch (error) {
      if (error instanceof ApiError && !this.stopped) {
        if (error.code === 'not_a_member') this.end('not_a_member');
        else if (error.code === 'room_not_found') this.end('room_not_found');
      }
    }
  }

  private end(reason: Parameters<Handlers['ended']>[0]): void {
    this.stop();
    this.handlers.ended(reason);
  }

  private open(): void {
    if (this.stopped) return;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${this.code}/ws`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.lost();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;
      this.failures = 0;
      window.clearInterval(this.poll);
      this.poll = undefined;
      this.handlers.link('live');
      this.ping = window.setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send('ping');
        this.pong = window.setTimeout(() => socket.close(4000, 'timeout'), PONG_MS);
      }, PING_MS);
    });
    socket.addEventListener('message', (event) => {
      if (socket !== this.socket) return;
      if (event.data === 'pong') {
        window.clearTimeout(this.pong);
        return;
      }
      const message = JSON.parse(event.data as string) as { type: string; state: RoomView };
      if (message.type === 'state') this.accept(message.state);
    });
    socket.addEventListener('close', (event) => {
      if (socket !== this.socket || this.stopped) return;
      this.socket = null;
      this.clear();
      if (event.code === 4410) this.end('closed');
      else if (event.code === 4403) this.end('left');
      else this.lost();
    });
  }

  private lost(): void {
    if (this.stopped) return;
    this.failures++;
    // After two failed attempts, keep the room usable over HTTP while retrying.
    if (this.failures >= 2 && this.poll === undefined) {
      this.handlers.link('polling');
      void this.refresh();
      this.poll = window.setInterval(() => void this.refresh(), POLL_MS);
    } else if (this.poll === undefined) {
      this.handlers.link('reconnecting');
      void this.refresh();
    }
    const delay = Math.min(500 * 2 ** Math.min(this.failures - 1, 4), this.poll === undefined ? 5_000 : 15_000);
    this.retry = window.setTimeout(() => this.open(), delay);
  }
}
