/** A refused request: a visible, structured reason. Never a silent default. */
export class Reject extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Failure = { ok: false; status: number; code: string; message: string };
export type Result<T> = { ok: true; value: T } | Failure;

/** Durable Object methods return Results: RPC does not carry custom error fields. */
export function attempt<T>(run: () => T): Result<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof Reject) {
      return { ok: false, status: error.status, code: error.code, message: error.message };
    }
    throw error;
  }
}

export async function attemptAsync<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof Reject) {
      return { ok: false, status: error.status, code: error.code, message: error.message };
    }
    throw error;
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Reject(result.status, result.code, result.message);
  return result.value;
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function failure(error: Reject): Response {
  return json({ error: { code: error.code, message: error.message } }, error.status);
}

export function randomId(prefix: string, bytes = 12): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let out = '';
  for (const b of raw) out += b.toString(16).padStart(2, '0');
  return `${prefix}_${out}`;
}

/** Unbiased integer in [0, max). */
export function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const box = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(box);
    if (box[0]! < limit) return box[0]! % max;
  }
}

export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
