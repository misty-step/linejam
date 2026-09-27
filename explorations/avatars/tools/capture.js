// Capture review pages from the workspace Chromium (CDP over an SSH tunnel) as PNGs.
// PW=<playwright-core dir> CDP=http://127.0.0.1:19347 BASE=http://127.0.0.1:18090/linejam/avatars/ \
//   bun explorations/avatars/tools/capture.js <out-dir> <page>[#section,...] ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = await import(join(process.env.PW, 'index.mjs'));
const cdp = process.env.CDP ?? 'http://127.0.0.1:19347';
const base = process.env.BASE ?? 'http://127.0.0.1:18090/linejam/avatars/';
const [out, ...targets] = process.argv.slice(2);
const width = Number(process.env.WIDTH ?? 1280);
const dpr = Number(process.env.DPR ?? 2);
const full = process.env.FULL === '1';
mkdirSync(out, { recursive: true });

const browser = await chromium.connectOverCDP(cdp);
const ctx = await browser.newContext({
  viewport: { width, height: 900 },
  deviceScaleFactor: dpr,
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
const manifest = [];
for (const t of targets) {
  const [path, secs] = t.split('#');
  const res = await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => `${f.family} ${f.weight}`)
  );
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  const stem = path.replace(/\.html$/, '').replace(/\//g, '_') + `@${width}`;
  if (full || !secs) {
    const file = join(out, `${stem}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({
      page: path,
      width,
      dpr,
      file,
      status: res.status(),
      fonts,
      overflow,
    });
  }
  for (const s of (secs ?? '').split(',').filter(Boolean)) {
    const el = page.locator(`#${s}`);
    const file = join(out, `${stem}_${s}.png`);
    await el.screenshot({ path: file });
    manifest.push({
      page: path,
      section: s,
      width,
      dpr,
      file,
      status: res.status(),
      fonts,
      overflow,
    });
  }
  if (process.env.FRAGS === '1') {
    const frags = page.locator('.frag');
    const n = await frags.count();
    for (let i = 0; i < n; i++) {
      const file = join(out, `${stem}_frag${String(i).padStart(2, '0')}.png`);
      await frags.nth(i).screenshot({ path: file });
      manifest.push({
        page: path,
        frag: i,
        width,
        dpr,
        file,
        status: res.status(),
        fonts,
        overflow,
      });
    }
  }
}
writeFileSync(
  join(out, `manifest-${width}.json`),
  JSON.stringify(
    { base, cdp: 'workspace chromium over ssh', errors, captures: manifest },
    null,
    2
  )
);
console.log(
  JSON.stringify(
    {
      captures: manifest.length,
      errors,
      overflow: [...new Set(manifest.map((m) => m.overflow))],
      fonts: manifest[0]?.fonts,
    },
    null,
    1
  )
);
await ctx.close();
await browser.close();
