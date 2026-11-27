// Vitest global setup for the `faces` project: one live `wrangler dev`
// (workerd + SQLite Durable Objects) that the CLI and MCP child processes hit
// over HTTP — the same way a scripted player would.
import type { TestProject } from 'vitest/node';
// @ts-expect-error plain ESM helper without types
import { startLocalWorker } from '../../scripts/local.mjs';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const worker = (await startLocalWorker({ port: 8793 })) as { url: string; stop(): Promise<void> };
  project.provide('linejamUrl', worker.url);
  return () => worker.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    linejamUrl: string;
  }
}
