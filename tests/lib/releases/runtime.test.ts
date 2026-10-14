/** @vitest-environment node */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { expect, it } from 'vitest';
import { APP_VERSION } from '@/lib/appVersion';

it('renders both release routes without runtime code generation or source filesystem access', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--disallow-code-generation-from-strings',
      '--import',
      'tsx',
      '-e',
      `
        const { registerHooks } = require('node:module');
        const { createElement } = require('react');
        const { renderToStaticMarkup } = require('react-dom/server');
        registerHooks({
          resolve(specifier, context, nextResolve) {
            if (['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].includes(specifier)) {
              throw new Error('Release sources are unavailable in Workers');
            }
            return nextResolve(specifier, context);
          },
        });
        const Page = require('./app/releases/page.tsx').default;
        const { GET } = require('./app/releases.xml/route.ts');
        (async () => {
          const response = await GET();
          console.log(JSON.stringify({
            html: renderToStaticMarkup(createElement(Page)),
            status: response.status,
            contentType: response.headers.get('Content-Type'),
            feed: await response.text(),
          }));
        })().catch(error => { console.error(error); process.exitCode = 1; });
      `,
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  const result = JSON.parse(output);
  expect(result.html).toContain(
    `Current application version: <strong>v${APP_VERSION}</strong>`
  );
  expect(result.html).toContain('Version 0.27.0');
  expect(result.html).toContain('Version 1.15.1');
  expect(result.html).toContain(
    'Public notes are not recorded for this release. Technical history is available below.'
  );
  expect(result.status).toBe(200);
  expect(result.contentType).toBe('application/xml');
  expect(result.feed).toBe(fs.readFileSync('docs/releases/feed.xml', 'utf8'));
  expect(result.feed).toContain('<title>Linejam v0.27.0</title>');
});
