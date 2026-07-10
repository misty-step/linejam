// Lab-001 composer sweep: load every option x screen, collect console errors,
// assert non-trivial render, screenshot signature screens for spot-check.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/phaedrus/Development/linejam/explorations/lab-001';
const OUT = path.join(ROOT, '.sweep');
const SCREENS = ['home', 'join', 'lobby', 'write', 'wait', 'reveal', 'read'];
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].replace(/^\//, '') || 'index.html'));
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(process.env.SWEEP_PORT || 4179, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 940 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e)}`));

await page.goto(`http://localhost:${process.env.SWEEP_PORT || 4179}/frame.html`);
const ids = await page.evaluate(() =>
  Object.keys(window.LANE_SPECS || {}).sort()
);
console.log('options:', ids.join(' '));

const report = [];
for (const id of ids) {
  for (const screen of SCREENS) {
    errors.length = 0;
    await page.goto(`http://localhost:${process.env.SWEEP_PORT || 4179}/frame.html#${id}/${screen}`);
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const stage = document.querySelector('.screen-root');
      return {
        children: stage ? stage.children.length : -1,
        textLen: stage ? stage.innerText.trim().length : 0,
        hasError: !!document.querySelector('.frame-error'),
      };
    });
    const bad =
      info.children <= 0 || info.hasError || (info.textLen < 5 && screen !== 'home');
    if (bad || errors.length) {
      report.push(`FAIL ${id}/${screen} children=${info.children} text=${info.textLen} err=${info.hasError} ${errors.join(' | ')}`);
    }
    if (screen === 'write' || screen === 'reveal' || screen === 'read') {
      await page.screenshot({
        path: path.join(OUT, `${id}-${screen}.png`),
        clip: await page
          .locator('.screen-root')
          .boundingBox()
          .then((b) => b || { x: 0, y: 0, width: 430, height: 940 }),
      });
    }
  }
}
console.log(report.length ? report.join('\n') : 'ALL RENDER CLEAN');
await browser.close();
server.close();
