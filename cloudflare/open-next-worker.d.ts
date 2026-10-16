/**
 * `.open-next/worker.js`, produced by `opennextjs-cloudflare build` and
 * aliased in wrangler.jsonc so typechecking works before a build exists.
 */
declare module 'open-next-worker' {
  /** The Worker's bindings, passed through to OpenNext untouched. */
  export type OpenNextEnv = object;
  /** The Workers execution context, passed through to OpenNext untouched. */
  export interface OpenNextContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
  const worker: {
    fetch(
      request: Request,
      env: OpenNextEnv,
      ctx: OpenNextContext
    ): Promise<Response>;
  };
  export default worker;
}
