#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { port: { type: 'string', default: '4400' } },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Choose an unprivileged port between 1024 and 65535.');
}
const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../explorations/renewal'
);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
};
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname
    );
  } catch {
    response.writeHead(400).end('Invalid path.');
    return;
  }
  if (
    pathname.split('/').some((segment) => segment.startsWith('.')) ||
    pathname.includes('\0')
  ) {
    response.writeHead(404).end('Not found.');
    return;
  }
  const file = resolve(
    root,
    `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`
  );
  if (!file.startsWith(root + sep)) {
    response.writeHead(404).end('Not found.');
    return;
  }
  const contentType = contentTypes[extname(file)];
  try {
    const info = await stat(file);
    if (!info.isFile() || !contentType) {
      response.writeHead(404).end('Not found.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
    });
    if (request.method === 'HEAD') response.end();
    else
      createReadStream(file)
        .on('error', () => response.destroy())
        .pipe(response);
  } catch {
    response.writeHead(404).end('Not found.');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Linejam design explorations: http://127.0.0.1:${port}`);
  console.log(
    'Local design sketches only. No accounts, rooms, providers, or telemetry. Ctrl-C stops this server.'
  );
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
