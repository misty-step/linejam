import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the real CLI as a child process, exactly as a scripted player would. */
export function cli(url: string, args: string[], env: Record<string, string> = {}): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const { LINEJAM_GUEST_TOKEN: _drop, ...clean } = process.env;
    const child = spawn(process.execPath, [join(root, 'cli/linejam.ts'), ...args], {
      env: { ...clean, LINEJAM_URL: url, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** The JSON lines a process wrote to stderr (Node warnings and blank lines skipped). */
export function stderrJson(result: CliResult): any[] {
  return result.stderr
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
}

export const WORDS = [1, 2, 3, 4, 5, 4, 3, 2, 1];
export const words = (tag: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${tag}${i + 1}`).join(' ');

/** A live MCP server over stdio. */
export class Mcp {
  private readonly child;
  private buffer = '';
  private nextId = 1;
  private readonly waiting = new Map<number | string | null, (message: any) => void>();
  readonly unsolicited: any[] = [];

  constructor(url: string) {
    this.child = spawn(process.execPath, [join(root, 'cli/mcp.ts')], {
      env: { ...process.env, LINEJAM_URL: url },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      let newline: number;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        const resolve = this.waiting.get(message.id);
        if (resolve) {
          this.waiting.delete(message.id);
          resolve(message);
        } else this.unsolicited.push(message);
      }
    });
  }

  /** Send a request and wait for the response with the same id. */
  request(method: string, params?: unknown): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  /** Send a raw line and wait for the response that carries `id`. */
  raw(line: string, id: number | string | null): Promise<any> {
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.child.stdin.write(line + '\n');
    });
  }

  notify(method: string): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  }

  /** Call a tool and parse its text content. */
  async tool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<{ isError: boolean; data: any; response: any }> {
    const response = await this.request('tools/call', { name, arguments: args });
    if (response.error) return { isError: false, data: null, response };
    return { isError: response.result.isError === true, data: JSON.parse(response.result.content[0].text), response };
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.child.on('close', () => resolve());
      this.child.stdin.end();
    });
  }
}
