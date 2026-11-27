// Headed Chrome walkthrough against a live local `wrangler dev` (workerd +
// SQLite Durable Objects). Two real concurrent browser contexts — Host and
// Guest — play a whole game; a third, signed-out context reads the shared link.
//
//   xvfb-run -a node e2e/walkthrough.mjs            # all 9 viewport × mode runs
//   xvfb-run -a node e2e/walkthrough.mjs --only desktop-light
//
// Every run asserts as it goes and fails loudly. Evidence lands in e2e/out/.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import jsQR from 'jsqr';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { root, startLocalWorker } from '../scripts/local.mjs';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const only = flag('--only');
const out = flag('--out') ?? join(root, 'e2e/out');
const port = Number(flag('--port') ?? 8791);

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
  small: { width: 320, height: 568 },
};
const MODES = {
  light: { colorScheme: 'light', reducedMotion: 'no-preference' },
  dark: { colorScheme: 'dark', reducedMotion: 'no-preference' },
  reduced: { colorScheme: 'light', reducedMotion: 'reduce' },
};
const RECORD = new Set(['desktop-light', 'phone-light']);
const SPREADS = { landing: 920, lobby: 960, writing: 920, reveal: 1040 };

const tokens = JSON.parse(readFileSync(join(root, 'folio/assets/tokens.json'), 'utf8'));
const checksums = JSON.parse(readFileSync(join(root, 'folio/assets/checksums.json'), 'utf8'));

// What the two players write. Word counts follow 1-2-3-4-5-4-3-2-1.
const LINES = {
  host: [
    'Lanterns',
    'drift upstream',
    'past sleeping orchards',
    'where the river forgets',
    'every name it ever carried',
    'and the reeds answer',
    'in small hours',
    'quietly, then',
    'gone',
  ],
  guest: [
    'Morning',
    'spills over',
    'the kitchen table',
    'crumbs keep their secrets',
    'until the kettle starts singing',
    'something about the tide',
    'coming back slowly',
    'for us',
    'again',
  ],
};

class Failure extends Error {}
function check(condition, message) {
  if (!condition) throw new Failure(message);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Collects everything the acceptance bar counts, per browser context. */
function watch(context, label, ledger, origin) {
  context.on('page', (page) => {
    page.on('console', (message) => {
      if (message.type() === 'error') ledger.consoleErrors.push(`${label}: ${message.text()}`);
      if (/content security policy/i.test(message.text())) ledger.cspViolations.push(`${label}: ${message.text()}`);
    });
    page.on('pageerror', (error) => ledger.pageErrors.push(`${label}: ${error.message}`));
    page.on('request', (request) => {
      ledger.requests++;
      const url = request.url();
      if (
        !url.startsWith(origin) &&
        !url.startsWith(origin.replace('http', 'ws')) &&
        !/^(data|blob|about):/.test(url)
      ) {
        ledger.externalRequests.push(`${label}: ${url}`);
      }
    });
    page.on('requestfailed', (request) => {
      // A navigation away aborts in-flight requests of the page being left.
      if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
      ledger.failedRequests.push(`${label}: ${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400)
        ledger.badResponses.push(`${label}: ${response.status()} ${response.request().method()} ${response.url()}`);
    });
    page.on('websocket', (socket) => {
      ledger.sockets++;
      socket.on('framereceived', (frame) => {
        if (typeof frame.payload === 'string') ledger.frames[label].push(frame.payload);
      });
    });
  });
  return context.addInitScript(() => {
    // Chrome on Linux has no native share sheet, and calling navigator.share
    // under Xvfb crashes the renderer. Touch contexts therefore exercise the
    // documented copy fallback of "native share with a copy fallback".
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`)
    );
  });
}

/** Layout, target-size, type and overflow facts for whatever screen is showing. */
async function audit(page, name, viewportName, ledger) {
  const facts = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const doc = document.documentElement;
    const targets = [
      ...document.querySelectorAll('button, a[href], input, textarea, [role="radio"], [role="menuitem"]'),
    ]
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          what: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 40),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
        };
      });
    const inputs = [...document.querySelectorAll('input, textarea')]
      .filter(visible)
      .map((el) => parseFloat(getComputedStyle(el).fontSize));
    const beyond = [...document.querySelectorAll('#app *')]
      .filter(visible)
      .filter(
        (el) => el.getBoundingClientRect().right > doc.clientWidth + 0.5 || el.getBoundingClientRect().left < -0.5
      )
      .map((el) => el.className || el.tagName);
    const families = new Set();
    for (const el of document.querySelectorAll('#app *')) {
      if (
        visible(el) &&
        el.childNodes.length &&
        [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())
      ) {
        families.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
      }
    }
    const unnamed = [...document.querySelectorAll('button, a[href]')]
      .filter(visible)
      .filter((el) => !(el.getAttribute('aria-label') || el.textContent).trim())
      .map((el) => el.outerHTML.slice(0, 80));
    const spread = document.querySelector('.spread');
    const topbar = document.querySelector('.topbar');
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      beyond,
      targets,
      inputs,
      families: [...families],
      unnamed,
      spreadWidth: spread ? Math.round(spread.getBoundingClientRect().width) : null,
      columns: spread ? getComputedStyle(spread).gridTemplateColumns.split(' ').length : null,
      topbarHeight: Math.round(topbar.getBoundingClientRect().height),
      topbarBackdrop: getComputedStyle(topbar).backdropFilter,
      csp: window.__csp,
    };
  });
  const where = `${ledger.config} ${name}`;
  check(facts.overflow === 0, `${where}: horizontal overflow ${facts.overflow}px`);
  check(facts.beyond.length === 0, `${where}: elements beyond the viewport: ${facts.beyond.join(', ')}`);
  check(facts.csp.length === 0, `${where}: CSP violations ${facts.csp.join('; ')}`);
  check(facts.unnamed.length === 0, `${where}: controls without an accessible name: ${facts.unnamed.join(' | ')}`);
  check(
    facts.inputs.every((size) => size >= 16),
    `${where}: input text below 16px: ${facts.inputs}`
  );
  const allowed = ['Newsreader', 'Plus Jakarta Sans', 'IBM Plex Mono'];
  check(
    facts.families.every((f) => allowed.includes(f)),
    `${where}: fonts outside the three families: ${facts.families}`
  );
  check(facts.topbarHeight <= 60, `${where}: top bar wrapped (${facts.topbarHeight}px)`);
  check(facts.topbarBackdrop === 'none', `${where}: top bar uses backdrop-filter`);
  if (viewportName !== 'desktop') {
    const small = facts.targets.filter((t) => t.w < 44 || t.h < 44);
    check(small.length === 0, `${where}: touch targets under 44×44: ${JSON.stringify(small)}`);
    check(facts.columns === null || facts.columns === 1, `${where}: phone layout is not one column`);
  } else if (SPREADS[name]) {
    check(
      Math.abs(facts.spreadWidth - SPREADS[name]) <= 2,
      `${where}: spread is ${facts.spreadWidth}px, expected ~${SPREADS[name]}px`
    );
    check(facts.columns === 2, `${where}: desktop spread has ${facts.columns} columns`);
  }
  ledger.audits.push({
    screen: name,
    overflow: facts.overflow,
    minTarget: Math.min(...facts.targets.map((t) => Math.min(t.w, t.h))),
    targets: facts.targets.length,
    fonts: facts.families,
    spreadWidth: facts.spreadWidth,
  });
}

/** [L1-7.5] At 200% text the screen still has no horizontal overflow. */
async function auditLargeText(page, name, ledger) {
  const overflow = await page.evaluate(async () => {
    const rootEl = document.documentElement;
    rootEl.style.fontSize = '200%';
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = rootEl.scrollWidth - rootEl.clientWidth;
    rootEl.style.fontSize = '';
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return result;
  });
  check(overflow === 0, `${ledger.config} ${name}: ${overflow}px horizontal overflow at 200% text`);
  ledger.largeText.push({ screen: name, overflowAt200: overflow });
}

async function shot(page, config, name, shots, { fullPage = false } = {}) {
  const file = `${config}-${name}.png`;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(280); // let the 220ms screen transition finish
  await page.screenshot({ path: join(out, file), fullPage });
  shots.push(file);
}

async function qrDecode(page) {
  const png = PNG.sync.read(await page.locator('.qr-plate').screenshot());
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  check(result, 'QR did not decode');
  return result.data;
}

/** The tokens, the canonical assets and the inline SVG geometry, checked in the page. */
async function auditIdentity(page, mode, ledger, origin) {
  const set = mode.colorScheme === 'dark' ? tokens.dark : tokens.light;
  const seen = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const names = [
      '--bg',
      '--bg-desk',
      '--surface',
      '--ink',
      '--ink-muted',
      '--hairline',
      '--accent',
      '--accent-ink',
      '--danger',
      '--heart',
    ];
    return {
      vars: Object.fromEntries(names.map((n) => [n, css.getPropertyValue(n).trim()])),
      body: getComputedStyle(document.body).backgroundColor,
      topbar: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
      theme: document.documentElement.dataset.theme ?? 'system',
    };
  });
  const expected = {
    '--bg': set.bg,
    '--bg-desk': set.bgDesk,
    '--surface': set.surface,
    '--ink': set.ink,
    '--ink-muted': set.inkMuted,
    '--hairline': set.hairline,
    '--accent': set.accent,
    '--accent-ink': set.accentInk,
    '--danger': set.danger,
    '--heart': set.heartActive,
  };
  for (const [name, value] of Object.entries(expected)) {
    check(seen.vars[name] === value, `${ledger.config}: ${name} is ${seen.vars[name]}, tokens.json says ${value}`);
  }
  check(seen.body === hexToRgb(set.bg), `${ledger.config}: body background ${seen.body}`);
  check(seen.topbar === hexToRgb(set.bg), `${ledger.config}: top bar is not opaque --bg (${seen.topbar})`);
  check(seen.theme === 'system', `${ledger.config}: first visit should follow System, got ${seen.theme}`);

  // Served bytes match folio/assets/checksums.json exactly.
  const served = await page.evaluate(async (names) => {
    const out = {};
    for (const name of names) {
      const bytes = await (await fetch(`/folio/${name}`)).arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      out[name] = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return out;
  }, Object.keys(checksums));
  for (const [name, expectedHash] of Object.entries(checksums)) {
    check(served[name] === expectedHash, `${ledger.config}: /folio/${name} sha256 ${served[name]} != ${expectedHash}`);
    const local = createHash('sha256')
      .update(readFileSync(join(root, 'folio/assets', name)))
      .digest('hex');
    check(local === expectedHash, `folio/assets/${name} itself does not match checksums.json`);
  }
  ledger.checksums = Object.keys(served).length;

  // Inline SVG reproduces each file's elements and attributes exactly.
  const drift = await page.evaluate(async () => {
    const shape = (el) => ({
      tag: el.tagName.toLowerCase(),
      attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]).sort()),
      kids: [...el.children].map(shape),
    });
    const problems = [];
    const pairs = [['.brand .mark svg', 'mark']];
    for (const option of document.querySelectorAll('[data-emblem]'))
      pairs.push([`[data-emblem="${option.dataset.emblem}"] svg`, `emblem-${option.dataset.emblem}`]);
    for (const [selector, file] of pairs) {
      const inline = document.querySelector(selector);
      const text = await (await fetch(`/folio/${file}.svg`)).text();
      const canonical = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
      if (JSON.stringify(shape(inline)) !== JSON.stringify(shape(canonical))) problems.push(file);
    }
    return { problems, compared: pairs.length };
  });
  check(drift.problems.length === 0, `${ledger.config}: inline SVG differs from folio file: ${drift.problems}`);
  check(drift.compared === 9, `${ledger.config}: expected mark + 8 emblems inline, compared ${drift.compared}`);
  ledger.inlineSvgCompared = drift.compared;

  for (const path of [
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
  ]) {
    const response = await page.request.get(origin + path);
    check(response.status() === 200, `${path} answered ${response.status()}`);
  }
}

async function motionFacts(page, selector) {
  return page.evaluate((sel) => {
    const s = getComputedStyle(document.querySelector(sel));
    return { name: s.animationName, duration: s.animationDuration, easing: s.animationTimingFunction };
  }, selector);
}

async function type(page, selector, text, slow) {
  if (slow) {
    await page.locator(selector).click();
    await page.locator(selector).pressSequentially(text, { delay: 28 });
  } else {
    await page.locator(selector).fill(text);
  }
}

async function runConfig(browser, origin, viewportName, modeName) {
  const config = `${viewportName}-${modeName}`;
  const viewport = VIEWPORTS[viewportName];
  const mode = MODES[modeName];
  const recording = RECORD.has(config);
  const ledger = {
    config,
    viewport: `${viewport.width}x${viewport.height}`,
    mode: modeName,
    consoleErrors: [],
    pageErrors: [],
    cspViolations: [],
    failedRequests: [],
    badResponses: [],
    externalRequests: [],
    requests: 0,
    sockets: 0,
    frames: { host: [], guest: [], spectator: [] },
    audits: [],
    largeText: [],
    steps: [],
    screenshots: [],
  };
  const step = (text) => {
    ledger.steps.push(text);
    console.log(`  [${config}] ${text}`);
  };
  const options = {
    viewport,
    colorScheme: mode.colorScheme,
    reducedMotion: mode.reducedMotion,
    deviceScaleFactor: 1,
    hasTouch: viewportName !== 'desktop',
    isMobile: viewportName !== 'desktop',
    permissions: ['clipboard-read', 'clipboard-write'],
    ...(recording ? { recordVideo: { dir: join(out, 'video-raw', config), size: viewport } } : {}),
  };
  const hostContext = await browser.newContext(options);
  const guestContext = await browser.newContext(options);
  const readerContext = await browser.newContext({
    viewport,
    colorScheme: mode.colorScheme,
    reducedMotion: mode.reducedMotion,
  });
  // A late arrival: joins mid-game and watches. Nothing hidden may ever reach this context.
  const spectatorContext = await browser.newContext({
    viewport,
    colorScheme: mode.colorScheme,
    reducedMotion: mode.reducedMotion,
    hasTouch: viewportName !== 'desktop',
    isMobile: viewportName !== 'desktop',
  });
  await watch(hostContext, 'host', ledger, origin);
  await watch(guestContext, 'guest', ledger, origin);
  await watch(spectatorContext, 'spectator', ledger, origin);
  const readerLedger = {
    ...ledger,
    consoleErrors: [],
    pageErrors: [],
    cspViolations: [],
    failedRequests: [],
    badResponses: [],
    externalRequests: [],
    frames: { reader: [] },
  };
  await watch(readerContext, 'reader', readerLedger, origin);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const spectator = await spectatorContext.newPage();
  const slow = recording;

  try {
    // ── Landing ──
    await host.goto(origin + '/');
    await host.locator('[data-action="create"]:not([disabled])').waitFor();
    await auditIdentity(host, mode, ledger, origin);
    for (const label of ['Pen name', 'Emblem', 'New room', 'Room code', 'Join']) {
      check(
        await host.getByText(label, { exact: true }).first().isVisible(),
        `${config}: landing label "${label}" missing`
      );
    }
    check((await host.locator('[data-emblem]').count()) === 8, `${config}: emblem picker does not offer 8 emblems`);
    check((await host.locator('[data-emblem][aria-checked="true"]').count()) === 1, `${config}: no emblem preselected`);
    // An unselected emblem control is bounded by --ink-muted, never a hairline, and has no tinted badge.
    const unselected = await host
      .locator('[data-emblem][aria-checked="false"]')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          border: s.borderTopColor,
          background: s.backgroundColor,
          ink: getComputedStyle(el.querySelector('.emblem')).color,
        };
      });
    const set = mode.colorScheme === 'dark' ? tokens.dark : tokens.light;
    check(
      unselected.border === hexToRgb(set.inkMuted),
      `${config}: unselected emblem border ${unselected.border} is not --ink-muted`
    );
    check(
      unselected.background === 'rgba(0, 0, 0, 0)',
      `${config}: emblem control has a badge background ${unselected.background}`
    );
    check(unselected.ink === hexToRgb(set.ink), `${config}: resting emblem is not --ink`);
    await host.locator('[data-emblem="orrery"]').click();
    await host.waitForTimeout(240); // the 160ms selection transition
    const selected = await host.locator('[data-emblem="orrery"]').evaluate((el) => ({
      border: getComputedStyle(el).borderTopColor,
      ink: getComputedStyle(el.querySelector('.emblem')).color,
      background: getComputedStyle(el).backgroundColor,
    }));
    check(
      selected.ink === hexToRgb(set.accent) && selected.border === hexToRgb(set.accent),
      `${config}: selected emblem is not --accent`
    );
    check(selected.background === 'rgba(0, 0, 0, 0)', `${config}: selected emblem has a tinted background`);
    const screenMotion = await motionFacts(host, '.screen');
    if (mode.reducedMotion === 'reduce') {
      check(
        screenMotion.name === 'crossfade' && parseFloat(screenMotion.duration) <= 0.12,
        `${config}: reduced motion still animates: ${JSON.stringify(screenMotion)}`
      );
    } else {
      check(
        screenMotion.name === 'screen-in' && screenMotion.duration === '0.22s',
        `${config}: screen transition is ${JSON.stringify(screenMotion)}, expected 220ms`
      );
      check(screenMotion.easing === 'cubic-bezier(0.22, 1, 0.36, 1)', `${config}: easing is ${screenMotion.easing}`);
    }
    ledger.motion = screenMotion;

    // A blank pen name is refused at the control, with a reason.
    await host.locator('[data-action="create"]').click();
    await host.locator('#pen-name-error:has-text("Enter a pen name")').waitFor();
    await type(host, '#pen-name', 'Marlowe', slow);
    // Keyboard: the emblem picker is one radio group moved with the arrow keys.
    await host.locator('[data-emblem="orrery"]').focus();
    await host.keyboard.press('ArrowRight');
    check(
      (await host.locator('[data-emblem="arch"]').getAttribute('aria-checked')) === 'true',
      `${config}: ArrowRight did not move the emblem selection`
    );
    check(
      await host.locator('[data-emblem="arch"]').evaluate((el) => el === document.activeElement),
      `${config}: focus did not follow the selection`
    );
    await host.keyboard.press('ArrowLeft');
    check(
      (await host.locator('[data-emblem="orrery"]').getAttribute('aria-checked')) === 'true',
      `${config}: ArrowLeft did not move the emblem selection`
    );
    check(
      (await host.locator('[data-emblem][tabindex="0"]').count()) === 1,
      `${config}: the radio group has more than one tab stop`
    );
    await host.waitForTimeout(240);
    await audit(host, 'landing', viewportName, ledger);
    await auditLargeText(host, 'landing', ledger);
    await shot(host, config, 'landing', ledger.screenshots);
    step('landing: 5 canonical labels, 8 emblems, blank pen name refused');

    // ── Create room → lobby ──
    await host.locator('[data-action="create"]').click();
    await host.waitForURL(/\/room\/[2-9A-HJ-NP-Z]{4}$/);
    const code = new URL(host.url()).pathname.split('/').pop();
    await host.locator('.code-big').waitFor();
    check((await host.locator('.code-big').innerText()) === code, `${config}: lobby shows a different code`);
    check((await host.locator('.code-badge').innerText()) === code, `${config}: top bar badge missing the code`);
    step(`room ${'····'} created (4-char Parlor-alphabet code)`);

    // One player: the start control is disabled and says another is needed.
    const start = host.locator('[data-action="start"]');
    check(await start.isDisabled(), `${config}: Start game enabled with one player`);
    check((await host.locator('#start-note').innerText()) === 'Need 2 players', `${config}: start note missing`);
    check((await host.locator('.count').innerText()) === '1/8', `${config}: player count is not 1/8`);

    // The QR encodes the live join URL, with a 4-module quiet zone, on a white plate.
    const joinUrl = `${origin}/join?code=${code}`;
    const decoded = await qrDecode(host);
    check(decoded === joinUrl, `${config}: QR encodes ${decoded}, expected ${joinUrl}`);
    const qr = await host.locator('.qr-plate').evaluate((el) => {
      const svg = el.querySelector('svg');
      const size = Number(svg.getAttribute('viewBox').split(' ')[2]);
      const path = svg.querySelector('path').getAttribute('d');
      const xs = [...path.matchAll(/M(\d+) (\d+)h(\d+)/g)].flatMap((m) => [Number(m[1]), Number(m[1]) + Number(m[3])]);
      const ys = [...path.matchAll(/M(\d+) (\d+)h/g)].map((m) => Number(m[2]));
      return {
        size,
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys) + 1,
        width: el.getBoundingClientRect().width,
        plate: getComputedStyle(svg.querySelector('rect')).fill,
        ink: getComputedStyle(svg.querySelector('path')).fill,
      };
    });
    check(
      qr.minX === 4 && qr.minY === 4 && qr.maxX === qr.size - 4 && qr.maxY === qr.size - 4,
      `${config}: QR quiet zone is not 4 modules: ${JSON.stringify(qr)}`
    );
    check(
      qr.plate === 'rgb(255, 255, 255)' && qr.ink === 'rgb(27, 25, 22)',
      `${config}: QR colors ${qr.plate} / ${qr.ink}`
    );
    if (viewportName === 'desktop')
      check(Math.abs(qr.width - 216) <= 1, `${config}: QR is ${qr.width}px, expected ~216px`);
    ledger.qr = { decodes: true, modules: qr.size - 8, quietZone: 4, widthPx: Math.round(qr.width) };

    // Tap-to-copy on the code; Share invite copies the join link.
    await host.locator('[data-action="copy-code"]').click();
    await host.locator('[data-flash="copy-code"]:has-text("Code copied")').waitFor();
    check(
      (await host.evaluate(() => navigator.clipboard.readText())) === code,
      `${config}: clipboard does not hold the code`
    );
    await host.locator('[data-action="share-invite"]').click();
    await host.locator('[data-flash="share-invite"]:has-text("Link copied")').waitFor();
    check(
      (await host.evaluate(() => navigator.clipboard.readText())) === joinUrl,
      `${config}: clipboard does not hold the join link`
    );
    check((await host.locator('[aria-label="Invitation"]').count()) === 1, `${config}: more than one invitation area`);
    step('lobby: start disabled at 1 player; QR decodes to the live join URL; copy + share invite');

    // ── Guest joins through the URL the QR encodes ──
    await guest.goto(decoded);
    await guest.locator('#room-code').waitFor();
    check((await guest.locator('#room-code').inputValue()) === code, `${config}: join link did not prefill the code`);
    check((await guest.locator('#pen-name').inputValue()) === '', `${config}: join link prefilled a pen name`);
    await type(guest, '#pen-name', 'Ines', slow);
    await guest.locator('[data-emblem="vesper"]').click();
    await guest.locator('[data-form="join"] button[type="submit"]').click();
    await guest.waitForURL(new RegExp(`/room/${code}$`));
    await guest.locator('.roster .member:not(.is-open)').nth(1).waitFor();
    await host.locator('.roster .member:not(.is-open)').nth(1).waitFor();
    check(
      (await host.locator('.count').innerText()) === '2/8',
      `${config}: host did not see the guest arrive in real time`
    );
    check(
      (await guest.locator('#start-note').innerText()) === 'Waiting for host',
      `${config}: guest is not told they wait for the host`
    );
    check((await guest.locator('[data-action="start"]').count()) === 0, `${config}: guest sees a start control`);
    const rosterText = await host.locator('.roster').innerText();
    check(
      /Marlowe/.test(rosterText) && /Ines/.test(rosterText) && /Host/.test(rosterText) && /You/.test(rosterText),
      `${config}: roster is missing names or the host mark: ${rosterText}`
    );
    // The viewer's own emblem is --accent; another player's is --ink.
    const emblemColors = await host
      .locator('.roster .member .emblem')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
    check(
      emblemColors[0] === hexToRgb(set.accent) && emblemColors[1] === hexToRgb(set.ink),
      `${config}: roster emblem colors ${emblemColors}`
    );
    await host.locator('[data-action="start"]:not([disabled])').waitFor();
    if (viewportName === 'desktop') {
      // Compact, balanced: Start game sits directly under the roster, not across a void.
      const gap = await host.evaluate(
        () =>
          document.querySelector('[data-action="start"]').getBoundingClientRect().top -
          document.querySelector('.roster').getBoundingClientRect().bottom
      );
      check(gap >= 0 && gap <= 40, `${config}: ${Math.round(gap)}px gap above Start game`);
      ledger.startGapPx = Math.round(gap);
    }
    await audit(host, 'lobby', viewportName, ledger);
    await auditLargeText(host, 'lobby', ledger);
    await host.locator('[data-flash="share-invite"]:empty').waitFor({ state: 'attached' }); // resting state
    await shot(host, config, 'lobby', ledger.screenshots);
    step('guest joined via the QR URL; both rosters live; guest waits for host');

    // Identity survives refresh: same seat, still the host, no second seat.
    await host.reload();
    await host.locator('.roster .member:not(.is-open)').nth(1).waitFor();
    check((await host.locator('.count').innerText()) === '2/8', `${config}: refresh changed the seat count`);
    check((await host.locator('[data-action="start"]').count()) === 1, `${config}: refresh lost host authority`);

    // ── Start: two players ──
    await host.locator('[data-action="start"]:not([disabled])').click();
    await host.locator('#line-input').waitFor();
    await guest.locator('#line-input').waitFor();
    step('host started the game with 2 players');

    const pages = { host, guest };
    const hidden = []; // every line accepted so far
    for (let round = 0; round < 9; round++) {
      const words = [1, 2, 3, 4, 5, 4, 3, 2, 1][round];
      for (const who of ['host', 'guest']) {
        const page = pages[who];
        const other = who === 'host' ? 'guest' : 'host';
        await page.locator(`.round[aria-label="Round ${round + 1} of 9"]`).waitFor();
        check(
          (await page.locator('.cadence-step.is-current').innerText()) === String(words),
          `${config}: cadence does not mark ${words} for round ${round + 1}`
        );
        check(
          (await page.locator('.cadence').innerText()).replace(/\s+/g, '') === '123454321',
          `${config}: cadence track is not 1-2-3-4-5-4-3-2-1`
        );
        check(
          (await page.locator('label[for="line-input"]').innerText()).toLowerCase() ===
            `${words} ${words === 1 ? 'word' : 'words'}`,
          `${config}: composer does not state the target`
        );
        // Round 1 has no preceding line. Later rounds show exactly the line before — the other player's.
        if (round === 0) {
          check((await page.locator('.previous').count()) === 0, `${config}: round 1 shows a preceding line`);
        } else {
          const previous = await page.locator('.previous-line').innerText();
          check(
            previous === LINES[other][round - 1],
            `${config}: ${who} round ${round + 1} sees "${previous}", expected only "${LINES[other][round - 1]}"`
          );
          const text = await page.locator('#app').innerText();
          for (const earlier of hidden) {
            if (earlier !== previous)
              check(!text.includes(earlier), `${config}: ${who} can see an earlier line: "${earlier}"`);
          }
        }
      }

      if (round === 1) {
        // Over-count: three words where two are asked. Refused with the reason, draft kept.
        await type(host, '#line-input', 'drift far upstream', slow);
        check((await host.locator('#tally').innerText()) === '3/2', `${config}: live tally did not count 3/2`);
        check(
          await host.locator('#tally').evaluate((el) => el.classList.contains('is-over')),
          `${config}: over-count tally is not marked`
        );
        await host.locator('[data-form="line"] button[type="submit"]').click();
        await host.locator('#line-error:has-text("Use 2 words")').waitFor();
        check(
          (await host.locator('#line-input').inputValue()) === 'drift far upstream',
          `${config}: rejection lost the draft`
        );
        if (viewportName === 'desktop' && modeName === 'light')
          await shot(host, config, 'writing-overcount', ledger.screenshots);
        // The server enforces the same rule for any client.
        const assignment = await host.evaluate(
          async (c) => (await (await fetch(`/api/rooms/${c}/assignment`)).json()).assignment,
          code
        );
        const refused = await hostContext.request.post(`${origin}/api/rooms/${code}/lines`, {
          data: { poemId: assignment.poemId, lineIndex: 1, text: 'drift far upstream' },
        });
        check(
          refused.status() === 422 && (await refused.json()).error.message === 'Use 2 words',
          `${config}: server accepted an over-count line`
        );
        // The draft survives a refresh in the same session.
        await host.reload();
        await host.locator('#line-input').waitFor();
        check(
          (await host.locator('#line-input').inputValue()) === 'drift far upstream',
          `${config}: draft did not survive refresh`
        );
        await host.locator('#line-input').fill('');
        step('round 2: over-count refused with "Use 2 words" (client and server); draft survived refresh');
      }

      // Host tucks first, then waits calmly.
      await type(host, '#line-input', LINES.host[round], slow);
      check(
        (await host.locator('#tally').innerText()) === `${words}/${words}`,
        `${config}: tally is not ${words}/${words}`
      );
      if (round === 2) {
        await audit(host, 'writing', viewportName, ledger);
        // One sheet is the composer: the textarea inside has no border or box of its own.
        const compose = await host.evaluate(() => {
          const sheet = getComputedStyle(document.querySelector('.compose'));
          const area = getComputedStyle(document.querySelector('#line-input'));
          return {
            sheetBorder: sheet.borderTopWidth,
            areaBorder: area.borderTopWidth,
            areaBackground: area.backgroundColor,
            inside: Boolean(
              document.querySelector('.compose #tally') && document.querySelector('.compose button[type="submit"]')
            ),
          };
        });
        check(
          compose.sheetBorder === '1px' &&
            compose.areaBorder === '0px' &&
            compose.areaBackground === 'rgba(0, 0, 0, 0)',
          `${config}: nested composer boxes: ${JSON.stringify(compose)}`
        );
        check(compose.inside, `${config}: tally and Tuck line are not inside the compose sheet`);
        await auditLargeText(host, 'writing', ledger);
        await shot(host, config, 'writing', ledger.screenshots);
      }
      // Keyboard: on desktop the line is tucked with Enter; on phones with the button.
      if (viewportName === 'desktop') await host.locator('#line-input').press('Enter');
      else await host.locator('[data-form="line"] button[type="submit"]').click();
      await host.locator('.tucked:has-text("Line tucked")').waitFor();
      const waiting = await host.locator('.compose').innerText();
      check(waiting.includes(LINES.host[round]), `${config}: acknowledgement does not show the stored line`);
      check(
        /Ines\s*Writing/.test(waiting) && /Marlowe\s*Tucked/.test(waiting),
        `${config}: waiting does not show who has submitted: ${waiting}`
      );
      // Calm waiting: no countdown, no clock, nothing that hurries.
      check(
        !/\d+:\d\d|\b\d+\s*(s|sec|seconds)\b|\btimer\b|hurry|countdown|time left/i.test(
          await host.locator('#app').innerText()
        ),
        `${config}: waiting shows a timer`
      );
      check(
        (await host.locator('progress, [role="timer"], [role="progressbar"]').count()) === 0,
        `${config}: waiting has a timer element`
      );
      if (round === 2 && viewportName !== 'small') {
        await audit(host, 'waiting', viewportName, ledger);
        if (modeName === 'light') await shot(host, config, 'waiting', ledger.screenshots);
      }
      // The guest, still writing, is told that the host submitted — not what.
      check(
        !(await guest.locator('#app').innerText()).includes(LINES.host[round]),
        `${config}: guest can see the host's fresh line`
      );

      await type(guest, '#line-input', LINES.guest[round], slow);
      await guest.locator('[data-form="line"] button[type="submit"]').click();
      check(
        (await guest
          .locator('#line-error')
          .innerText()
          .catch(() => '')) === '',
        `${config}: guest line refused in round ${round + 1}`
      );
      hidden.push(LINES.host[round], LINES.guest[round]);

      if (round === 3) {
        // A late arrival joins the running game as a spectator.
        await spectator.goto(`${origin}/join?code=${code}`);
        await spectator.locator('#pen-name').fill('Odile');
        await spectator.locator('[data-form="join"] button[type="submit"]:not([disabled])').click();
        await spectator.waitForURL(new RegExp(`/room/${code}$`));
        await spectator.getByRole('heading', { name: 'Spectating' }).waitFor();
        check(
          (await spectator.locator('#line-input, [data-form="line"], .previous').count()) === 0,
          `${config}: a spectator has a composer or a preceding line`
        );
        check(
          (await spectator.locator('.progress .member').count()) === 2,
          `${config}: the spectator was added to the frozen writers`
        );
        await audit(spectator, 'spectating', viewportName, ledger);
        if (viewportName === 'phone' && modeName === 'light')
          await shot(spectator, config, 'spectating', ledger.screenshots);
        // The game goes on without them: the writers are already in the next round.
        await host.locator('.round[aria-label="Round 5 of 9"]').waitFor();
      }
      if (round >= 3) {
        const seen = await spectator.locator('#app').innerText();
        for (const line of hidden) check(!seen.includes(line), `${config}: the spectator can see "${line}"`);
      }
    }
    step(
      'nine rounds written 1-2-3-4-5-4-3-2-1; each round showed only the immediately preceding line; waiting had no timer'
    );

    // The sockets never carried hidden text: each frame holds at most the viewer's own line and one preceding line.
    for (const who of ['host', 'guest']) {
      const other = who === 'host' ? 'guest' : 'host';
      for (const payload of ledger.frames[who]) {
        if (payload === 'pong') continue;
        const state = JSON.parse(payload).state;
        if (state.phase !== 'writing') continue;
        const round = state.game.round;
        const allowed = new Set([LINES[who][round], round > 0 ? LINES[other][round - 1] : null]);
        for (const line of [...LINES.host, ...LINES.guest]) {
          if (!allowed.has(line))
            check(
              !payload.includes(JSON.stringify(line)),
              `${config}: a ${who} socket frame in round ${round + 1} carried "${line}"`
            );
        }
      }
    }
    check(ledger.sockets >= 3, `${config}: expected live WebSockets for both players and the spectator`);
    // Nothing a writer wrote ever reached the spectator's socket while it was hidden.
    check(ledger.frames.spectator.length > 0, `${config}: the spectator received no live updates`);
    for (const payload of ledger.frames.spectator) {
      for (const line of [...LINES.host, ...LINES.guest]) {
        check(!payload.includes(JSON.stringify(line)), `${config}: a spectator socket frame carried "${line}"`);
      }
      if (payload !== 'pong') {
        check(JSON.parse(payload).state.game?.assignment == null, `${config}: a spectator was given an assignment`);
      }
    }

    // ── Reading circle ──
    await host.locator('.rail').waitFor();
    await guest.locator('.rail').waitFor();
    check((await host.locator('.order-item').count()) === 2, `${config}: reading order does not list 2 poems`);
    check(
      (await host.locator('.order-item.is-next .order-state').innerText()) === 'up next',
      `${config}: no "up next" entry`
    );
    check((await host.locator('.poem .verse').count()) === 0, `${config}: poem text shown before reveal`);
    for (const frames of [ledger.frames.host, ledger.frames.guest]) {
      const last = JSON.parse(frames.filter((f) => f !== 'pong').at(-1)).state;
      check(
        last.game.circle.poems.every((p) => p.lines === null),
        `${config}: unrevealed poem text reached a client`
      );
    }
    // The spectator sees the reading order, no poem text and no reveal control.
    await spectator.locator('.rail').waitFor();
    check(
      (await spectator.locator('.poem .verse').count()) === 0 &&
        (await spectator.locator('[data-action="reveal"]').count()) === 0,
      `${config}: the spectator has poem text or a reveal control before reveal`
    );
    // The assigned reader has the control; the other player is told who reads.
    const firstReader = (await host.locator('[data-action="reveal"]').count()) === 1 ? 'host' : 'guest';
    const listener = firstReader === 'host' ? 'guest' : 'host';
    check(
      (await pages[listener].locator('[data-action="reveal"]').count()) === 0,
      `${config}: both players can reveal`
    );
    check(
      (await pages[listener].locator('.up-next-name').innerText()) === (firstReader === 'host' ? 'Marlowe' : 'Ines'),
      `${config}: next reader not announced`
    );
    check(
      /Up next: (Marlowe|Ines)/.test(await host.locator('.rail [role="status"]').innerText()),
      `${config}: next reader is not announced to assistive tech`
    );
    if (viewportName === 'desktop' && modeName === 'light')
      await shot(pages[firstReader], config, 'circle-up-next', ledger.screenshots);
    await pages[firstReader].locator('[data-action="reveal"]').click();
    for (const page of [host, guest]) {
      await page.locator('.poem .verse').nth(8).waitFor();
      check((await page.locator('.poem .verse').count()) === 9, `${config}: the whole poem is not shown together`);
      check((await page.locator('.poem .byline').count()) === 9, `${config}: bylines missing`);
      check(
        (await page.locator('.order-item.is-reading .order-state').innerText()) === 'reading now',
        `${config}: no "reading now" entry`
      );
      check(
        (await page.locator('.order-item.is-next .order-state').innerText()) === 'up next',
        `${config}: no "up next" entry after first reveal`
      );
    }
    // After reveal the room sees the poem, spectators included — with no heart, share or reveal controls.
    await spectator.locator('.poem .verse').nth(8).waitFor();
    check(
      (await spectator
        .locator('[data-action="heart"], [data-action="share"], [data-action="reveal"], [data-action="play-again"]')
        .count()) === 0,
      `${config}: the spectator has artifact or reveal controls`
    );
    const stillHidden = JSON.parse(
      ledger.frames.spectator.filter((f) => f !== 'pong').at(-1)
    ).state.game.circle.poems.find((p) => p.state === 'next');
    check(stillHidden.lines === null, `${config}: the unrevealed poem reached the spectator`);
    const poem = await host.locator('.poem .verse').allInnerTexts();
    const bylines = await host.locator('.poem .byline').allInnerTexts();
    const expectedPoem =
      poem[0] === LINES.host[0]
        ? LINES.host.map((l, i) => (i % 2 ? LINES.guest[i] : l))
        : LINES.guest.map((l, i) => (i % 2 ? LINES.host[i] : l));
    check(
      JSON.stringify(poem) === JSON.stringify(expectedPoem),
      `${config}: revealed poem is not the nine accepted lines in order`
    );
    check(
      bylines.every((b, i) => b === ((poem[0] === LINES.host[0]) === (i % 2 === 0) ? 'Marlowe' : 'Ines')),
      `${config}: bylines do not match the writers: ${bylines}`
    );
    const verse = await host
      .locator('.poem .verse')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          size: parseFloat(s.fontSize),
          family: s.fontFamily.split(',')[0].replace(/["']/g, ''),
          align: s.textAlign,
          opacity: getComputedStyle(el.closest('.poem-sheet')).opacity,
        };
      });
    check(
      verse.family === 'Newsreader' && (verse.align === 'left' || verse.align === 'start'),
      `${config}: verse is ${verse.family}, ${verse.align}`
    );
    if (viewportName === 'desktop')
      check(verse.size >= 24 && verse.size <= 26, `${config}: desktop verse is ${verse.size}px, expected 24–26px`);
    else check(verse.size >= 20, `${config}: phone verse is ${verse.size}px, expected >= 20px`);
    ledger.verse = verse;
    step(
      `reading circle: ${firstReader} revealed poem 1 — nine lines together with bylines; rail shows reading now / up next`
    );

    // ── Heart (a private save) ──
    await host.locator('[data-action="share"]').waitFor();
    await host.locator('[data-action="heart"]').click();
    await host.locator('[data-action="heart"][aria-pressed="true"]').waitFor();
    await guest.locator('.heart-count:has-text("1")').waitFor();
    check(
      (await guest.locator('[data-action="heart"]').getAttribute('aria-pressed')) === 'false',
      `${config}: the host's heart shows as the guest's`
    );
    await host.waitForTimeout(240); // the 160ms heart settle
    const heartColor = await host.locator('[data-action="heart"]').evaluate((el) => getComputedStyle(el).color);
    check(heartColor === hexToRgb(set.heartActive), `${config}: active heart is ${heartColor}, expected --heart`);
    const poemId = await host.evaluate(() => document.querySelector('[data-action="share"]').dataset.share);
    // Saving changed nothing about visibility: a signed-out reader gets nothing.
    const privateRead = await readerContext.request.get(`${origin}/api/poems/${poemId}`);
    check(
      privateRead.status() === 404,
      `${config}: a hearted poem is readable without a link (${privateRead.status()})`
    );
    step('heart toggled: personal, counted for the room, and not a publication');

    // ── Share: disclosed, explicit, live, reversible ──
    check(
      (await host.locator('.share .disclosure').innerText()) === 'Anyone with this link can read this poem',
      `${config}: share disclosure missing before publication`
    );
    check((await host.locator('[data-share-link]').count()) === 0, `${config}: a link exists before sharing`);
    await audit(host, 'reveal', viewportName, ledger);
    // Phones scroll; the whole stacked folio (rail, poem, heart, share, next) is one image.
    // Captured from the next reader's screen, so `Next poem` is in the picture with the rail, poem, heart and share.
    const nextReaderPage = (await host.locator('[data-action="reveal"]').count()) === 1 ? host : guest;
    await nextReaderPage.locator('[data-action="share"]').waitFor();
    await audit(nextReaderPage, 'reveal', viewportName, ledger);
    await auditLargeText(nextReaderPage, 'reveal', ledger);
    await shot(nextReaderPage, config, 'reveal', ledger.screenshots, { fullPage: viewportName !== 'desktop' });
    await host.locator('[data-action="share"]').click();
    await host.locator('[data-share-link]').waitFor();
    const sharePath = await host.locator('[data-share-link]').getAttribute('href');
    const shareUrl = origin + sharePath;
    check(
      (await host.evaluate(() => navigator.clipboard.readText())) === shareUrl,
      `${config}: the copied link is not the published link`
    );
    check(
      new RegExp(`^/poem/${poemId}\\?share=[\\w-]{32}$`).test(sharePath),
      `${config}: share link shape ${sharePath.replace(/share=.*/, 'share=…')}`
    );
    check(
      (await host.locator('.share .disclosure').innerText()) === 'Anyone with this link can read this poem',
      `${config}: disclosure missing after publication`
    );
    // A signed-out stranger opens the live link.
    const reader = await readerContext.newPage();
    const opened = await reader.goto(shareUrl);
    check(opened.status() === 200, `${config}: shared link answered ${opened.status()}`);
    await reader.locator('.poem .verse').nth(8).waitFor();
    check(
      JSON.stringify(await reader.locator('.poem .verse').allInnerTexts()) === JSON.stringify(expectedPoem),
      `${config}: shared page shows a different poem`
    );
    check(
      (await reader
        .locator('[data-action="share"], [data-action="revoke-share"], [data-action="copy-text"]')
        .count()) === 0,
      `${config}: a link reader has owner controls`
    );
    // [L1-3.11] No available action, no footer: no empty rule or spacing under the last line.
    const readerFooter = await reader.evaluate(() => {
      const sheet = document.querySelector('.poem-sheet');
      const last = sheet.querySelector('.poem-line:last-child');
      return {
        footers: document.querySelectorAll('.poem-actions').length,
        trailing: Math.round(sheet.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom),
        padding: parseFloat(getComputedStyle(sheet).paddingBottom),
      };
    });
    check(
      readerFooter.footers === 0 && readerFooter.trailing <= readerFooter.padding + 1,
      `${config}: a signed-out reader sees an empty action footer: ${JSON.stringify(readerFooter)}`
    );
    await audit(reader, 'shared', viewportName, readerLedger);
    if (modeName === 'light' && viewportName !== 'small') await shot(reader, config, 'shared-link', ledger.screenshots);
    // The link opens that poem only.
    const bare = await readerContext.request.get(`${origin}/api/poems/${poemId}`);
    check(bare.status() === 404, `${config}: the poem id alone is readable`);
    check(
      readerLedger.consoleErrors.length + readerLedger.pageErrors.length + readerLedger.badResponses.length === 0,
      `${config}: errors on the shared page: ${JSON.stringify([readerLedger.consoleErrors, readerLedger.badResponses])}`
    );
    step('share: disclosure shown, link published on copy, opened by a signed-out reader');

    // Revoke: the same link is a not-found page from then on.
    await host.locator('[data-action="revoke-share"]').click();
    await host.locator('[data-action="share"]').waitFor();
    const afterRevoke = await reader.goto(shareUrl);
    check(afterRevoke.status() === 404, `${config}: revoked link answered ${afterRevoke.status()}`);
    await reader.getByRole('heading', { name: 'Poem not found' }).waitFor();
    check(
      !(await reader.locator('#app').innerText()).includes(expectedPoem[0]),
      `${config}: revoked link still shows the poem`
    );
    check((await reader.title()) === 'Linejam', `${config}: not-found page leaks through its title`);
    check(
      (
        await readerContext.request.get(
          `${origin}/api/poems/${poemId}?share=${new URL(shareUrl).searchParams.get('share')}`
        )
      ).status() === 404,
      `${config}: revoked link still reads over the API`
    );
    step('revoke: the shared link now answers 404 and shows nothing');

    // ── Next poem → recap → Play again ──
    const secondReader = (await host.locator('[data-action="reveal"]').count()) === 1 ? 'host' : 'guest';
    check(secondReader !== firstReader, `${config}: the same player reads both poems`);
    check(
      (await pages[secondReader].locator('[data-action="reveal"]').innerText()) === 'Next poem',
      `${config}: reveal control is not labelled "Next poem"`
    );
    await pages[secondReader].locator('[data-action="reveal"]').click();
    await host.locator('.order-item.is-read').waitFor();
    check(
      (await host.locator('.order-item.is-read .order-state').innerText()) === 'read',
      `${config}: no "read" entry`
    );
    check((await host.locator('.poem .verse').count()) === 9, `${config}: second poem is not whole`);
    check(
      (await host.locator('.order-item .tag:has-text("Most hearts")').count()) === 1,
      `${config}: recap does not mark the hearted poem`
    );
    // Replay: an earlier poem opens again from the rail.
    await host.locator('.order-item.is-read .order-button').click();
    check(
      JSON.stringify(await host.locator('.poem .verse').allInnerTexts()) === JSON.stringify(expectedPoem),
      `${config}: replay did not reopen poem 1`
    );
    check(
      (await host.locator('[data-action="play-again"]').innerText()) === 'Play again',
      `${config}: host has no "Play again"`
    );
    check(
      (await guest.locator('[data-action="play-again"]').count()) === 0,
      `${config}: guest can start the next game`
    );
    check(
      /Waiting for host/.test(await guest.locator('.circle-actions').innerText()),
      `${config}: guest not told to wait for host at recap`
    );
    await audit(host, 'recap', viewportName, ledger);
    if (viewportName !== 'small' && modeName !== 'reduced') await shot(host, config, 'recap', ledger.screenshots);

    // The private archive holds both poems, the hearted one first.
    const archive = await host.evaluate(async () => (await fetch('/api/poems')).json());
    check(
      archive.length === 2 && archive[0].favorited && !archive[1].favorited && !archive[0].shared,
      `${config}: archive is not favorites-first: ${JSON.stringify(archive.map((p) => [p.favorited, p.shared]))}`
    );

    await host.locator('[data-action="play-again"]').click();
    for (const page of [host, guest]) {
      await page.locator('.round[aria-label="Round 1 of 9"]').waitFor();
      check(
        (await page.locator('#line-input').inputValue()) === '',
        `${config}: the new game starts with an old draft`
      );
      check((await page.locator('.previous').count()) === 0, `${config}: the new game's first round shows a line`);
    }
    const after = await host.evaluate(async () => (await fetch('/api/poems')).json());
    check(after.length === 2, `${config}: playing again changed the earlier poems`);
    // The late arrival writes normally in the next game, and has no archive from the one they watched.
    await spectator.locator('#line-input').waitFor();
    const watched = await spectator.evaluate(async () => (await fetch('/api/poems')).json());
    check(
      Array.isArray(watched) && watched.length === 0,
      `${config}: the spectator has archive entries from a game they only watched`
    );
    step('next poem → recap (replay, most hearts) → Play again started game 2; earlier poems intact');

    // ── Top bar: persistent Light / Dark / System, room options, focus handling ──
    if (modeName !== 'reduced') {
      await host.locator('[data-action="theme"]').click(); // System → Light
      await host.locator('[data-action="theme"]').click(); // Light → Dark
      check(
        (await host.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
        `${config}: theme toggle did not reach Dark`
      );
      await host.reload();
      await host.locator('#line-input').waitFor();
      const persisted = await host.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      check(
        persisted.theme === 'dark' && persisted.bg === hexToRgb(tokens.dark.bg),
        `${config}: explicit Dark did not persist across reload: ${JSON.stringify(persisted)}`
      );
      await host.locator('[data-action="theme"]').click(); // Dark → System
      check(
        (await host.evaluate(() => document.documentElement.dataset.theme)) === undefined,
        `${config}: toggle did not return to System`
      );
    }
    await host.locator('#menu-button').click();
    await host.locator('.menu').waitFor();
    const menuText = await host.locator('.menu').innerText();
    for (const item of ['How to play', 'Your poems', 'End game', 'Leave room'])
      check(menuText.includes(item), `${config}: room options is missing "${item}"`);
    await audit(host, 'menu', viewportName, ledger);
    await host.locator('.menu [data-action="end-game"]').click();
    const dialog = host.locator('dialog[open]');
    await dialog.waitFor();
    check(
      await dialog.getByRole('button', { name: 'Keep playing' }).evaluate((el) => el === document.activeElement),
      `${config}: the safe exit is not focused`
    );
    await audit(host, 'confirm', viewportName, ledger);
    if (viewportName === 'phone' && modeName === 'dark')
      await shot(host, config, 'confirm-end-game', ledger.screenshots);
    await host.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await host.locator('.round[aria-label="Round 1 of 9"]').waitFor();
    check((await host.locator('#line-input').count()) === 1, `${config}: Escape ended the game`);
    check(
      await host.evaluate(() => document.activeElement?.id === 'menu-button'),
      `${config}: focus did not return to the control that opened the dialog`
    );
    step('theme toggle persists across reload; End game asks first; Escape is the safe exit and focus returns');

    // ── Your poems: the private archive, private exports ──
    await guest.locator('#menu-button').click();
    await guest.locator('.menu a[href="/poems"]').click();
    await guest.getByRole('heading', { name: 'Your poems' }).waitFor();
    await guest.locator('.poem-row').nth(1).waitFor();
    check((await guest.locator('.poem-row').count()) === 2, `${config}: the guest's archive does not list both poems`);
    check(
      (await guest.locator('.poem-row .heart[aria-pressed="true"]').count()) === 0,
      `${config}: the host's heart shows as the guest's favorite`
    );
    await audit(guest, 'archive', viewportName, ledger);
    if (viewportName === 'phone' && modeName === 'light') await shot(guest, config, 'your-poems', ledger.screenshots);
    await guest.locator('.poem-row-link').first().click();
    await guest.locator('.poem .verse').nth(8).waitFor();
    const archived = await guest.locator('.poem .verse').allInnerTexts();
    await guest.locator('[data-action="copy-text"]').click();
    await guest.locator('[data-flash="export"]:has-text("Text copied")').waitFor();
    check(
      (await guest.evaluate(() => navigator.clipboard.readText())) === archived.join('\n'),
      `${config}: Copy text did not copy the poem`
    );
    const [download] = await Promise.all([
      guest.waitForEvent('download'),
      guest.locator('[data-action="save-image"]').click(),
    ]);
    check(
      download.suggestedFilename() === 'linejam-poem.png',
      `${config}: Save image produced ${download.suggestedFilename()}`
    );
    await guest.locator('[data-flash="export"]:has-text("Image saved")').waitFor();
    // Copying and exporting are private: the poem is still unreadable without a link.
    const exportedId = new URL(guest.url()).pathname.split('/').pop();
    check(
      (await readerContext.request.get(`${origin}/api/poems/${exportedId}`)).status() === 404,
      `${config}: exporting made the poem public`
    );
    await audit(guest, 'poem', viewportName, ledger);
    // Back to the room: the same seat, mid-game.
    await guest.goto(`${origin}/room/${code}`);
    await guest.locator('#line-input').waitFor();
    step('Your poems: both poems listed privately; Copy text and Save image stay private; the seat is kept');

    // ── End the stalled game, then close the room ──
    await host.locator('#menu-button').click();
    await host.locator('.menu [data-action="end-game"]').click();
    await host.locator('dialog[open]').getByRole('button', { name: 'End game' }).click();
    for (const page of [host, guest, spectator]) await page.locator('.roster').waitFor();
    check((await host.locator('.count').innerText()) === '3/8', `${config}: ending the game changed the roster`);
    const afterEnd = await host.evaluate(async () => (await fetch('/api/poems')).json());
    check(afterEnd.length === 2, `${config}: an ended game reached the archive`);
    await host.locator('#menu-button').click();
    await host.locator('.menu [data-action="close-room"]').click();
    const closing = host.locator('dialog[open]');
    check(
      await closing.getByRole('button', { name: 'Keep open' }).evaluate((el) => el === document.activeElement),
      `${config}: Close room's safe exit is not focused`
    );
    await closing.getByRole('button', { name: 'Close room' }).click();
    for (const page of [host, guest, spectator]) await page.getByRole('heading', { name: 'Room closed' }).waitFor();
    // A closed room rejects new arrivals with a visible reason.
    check(
      (await readerContext.request.post(`${origin}/api/guest`, { data: {} })).ok(),
      `${config}: could not mint a guest`
    );
    const refusedJoin = await readerContext.request.post(`${origin}/api/rooms/${code}/join`, {
      data: { penName: 'Late', emblem: 'arch' },
    });
    check(
      refusedJoin.status() === 410 && (await refusedJoin.json()).error.message === 'Room is closed',
      `${config}: a closed room admitted an arrival`
    );
    step('host ended the stalled game (lobby, nothing archived) and closed the room; a new arrival is refused');

    // ── Accounts are optional, and say so ──
    await reader.goto(origin + '/account');
    await reader.getByRole('heading', { name: 'Account' }).waitFor();
    check(
      (await reader.locator('#app').innerText()).includes('Accounts are not connected'),
      `${config}: the account page pretends sign-in works`
    );

    // ── Retired routes ──
    for (const path of ['/changelog', '/releases', '/releases.xml']) {
      const response = await readerContext.request.get(origin + path, { headers: { accept: 'text/html' } });
      check(response.status() === 404, `${config}: ${path} answered ${response.status()}`);
    }
    const gone = await reader.goto(origin + '/changelog');
    check(gone.status() === 404, `${config}: /changelog page answered ${gone.status()}`);
    await reader.getByRole('heading', { name: 'Page not found' }).waitFor();
    for (const page of [host, guest, spectator, reader]) {
      check(
        (await page.locator('a[href*="changelog"], a[href*="releases"], footer').count()) === 0,
        `${config}: a footer or release link is present`
      );
    }
    step('/changelog, /releases, /releases.xml answer 404; no footer links');

    // ── The acceptance counts ──
    const expected404 = (line) => /404 GET .*\/(poem\/[^?]+\?share=|changelog)/.test(line);
    const bad = ledger.badResponses.filter((line) => !expected404(line));
    check(ledger.consoleErrors.length === 0, `${config}: console errors: ${ledger.consoleErrors.join(' | ')}`);
    check(ledger.pageErrors.length === 0, `${config}: page errors: ${ledger.pageErrors.join(' | ')}`);
    check(ledger.cspViolations.length === 0, `${config}: CSP violations: ${ledger.cspViolations.join(' | ')}`);
    check(ledger.failedRequests.length === 0, `${config}: failed requests: ${ledger.failedRequests.join(' | ')}`);
    check(bad.length === 0, `${config}: 4xx/5xx responses: ${bad.join(' | ')}`);
    check(
      ledger.externalRequests.length + readerLedger.externalRequests.length === 0,
      `${config}: external requests: ${ledger.externalRequests.join(' | ')}`
    );
    ledger.result = 'pass';
  } catch (error) {
    ledger.result = 'fail';
    ledger.error = error.message;
    try {
      await host.screenshot({ path: join(out, `FAIL-${config}-host.png`) });
      await guest.screenshot({ path: join(out, `FAIL-${config}-guest.png`) });
    } catch {
      // The page may already be gone.
    }
  }

  const videos = recording ? { host: await host.video()?.path(), guest: await guest.video()?.path() } : null;
  await hostContext.close();
  await guestContext.close();
  await spectatorContext.close();
  await readerContext.close();
  if (videos?.host && videos?.guest && ledger.result === 'pass') {
    // Host and Guest side by side, as one playable H.264 file.
    const target = join(out, `walkthrough-${viewportName}.mp4`);
    const scale = viewportName === 'desktop' ? 'scale=960:600' : `scale=${viewport.width}:${viewport.height}`;
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      videos.host,
      '-i',
      videos.guest,
      '-filter_complex',
      `[0:v]${scale},setsar=1[a];[1:v]${scale},setsar=1[b];[a][b]hstack=inputs=2,pad=ceil(iw/2)*2:ceil(ih/2)*2[v]`,
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '30',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-r',
      '20',
      target,
    ]);
    ledger.video = `walkthrough-${viewportName}.mp4`;
  }
  const { frames, ...report } = ledger;
  report.socketFrames = { host: frames.host.length, guest: frames.guest.length, spectator: frames.spectator.length };
  return report;
}

/**
 * The HTTP fallback, in a real browser: the guest's WebSocket is refused, so
 * their room stays live by polling the same state route. The host stays on a
 * socket. Both must see each other and the game start.
 */
async function fallbackScenario(browser, origin) {
  const report = { result: 'fail', consoleErrors: [], guestSockets: 0, polls: 0 };
  const hostContext = await browser.newContext({ viewport: VIEWPORTS.phone });
  const guestContext = await browser.newContext({ viewport: VIEWPORTS.phone });
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    for (const page of [host, guest]) page.on('pageerror', (error) => report.consoleErrors.push(error.message));
    await guest.routeWebSocket(/\/api\/rooms\/.*\/ws$/, (socket) => {
      report.guestSockets++;
      socket.close({ code: 1011, reason: 'blocked by test' });
    });
    guest.on('request', (request) => {
      if (/\/api\/rooms\/[A-Z0-9]{4}\?v=/.test(request.url())) report.polls++;
    });
    await host.goto(origin + '/');
    await host.locator('#pen-name').fill('Marlowe');
    await host.locator('[data-action="create"]:not([disabled])').click();
    await host.waitForURL(/\/room\//);
    const code = new URL(host.url()).pathname.split('/').pop();
    await guest.goto(`${origin}/join?code=${code}`);
    await guest.locator('#pen-name').fill('Ines');
    await guest.locator('[data-form="join"] button[type="submit"]:not([disabled])').click();
    await guest.waitForURL(/\/room\//);
    await guest.locator('.roster .member:not(.is-open)').nth(1).waitFor();
    // The polling guest counts as present, so the host can start.
    await host.locator('[data-action="start"]:not([disabled])').waitFor();
    check(
      (await host.locator('.roster .member:not(.is-open) .presence').count()) === 0,
      'fallback: the polling guest is not shown as present'
    );
    await host.locator('[data-action="start"]').click();
    // The guest learns of the game without any socket.
    await guest.locator('#line-input').waitFor({ timeout: 15_000 });
    await guest.locator('#line-input').fill('Morning');
    await guest.locator('[data-form="line"] button[type="submit"]').click();
    await guest.locator('.tucked:has-text("Line tucked")').waitFor();
    await host.locator('.progress, #line-input').first().waitFor();
    check(report.guestSockets >= 2, `fallback: expected the guest's sockets to be refused, saw ${report.guestSockets}`);
    check(report.polls >= 2, `fallback: expected HTTP polling, saw ${report.polls} polls`);
    check(report.consoleErrors.length === 0, `fallback: page errors ${report.consoleErrors.join(' | ')}`);
    report.result = 'pass';
  } catch (error) {
    report.error = error.message;
  }
  await hostContext.close();
  await guestContext.close();
  return report;
}

/**
 * [L1-2.3] A browser holding a credential the server refuses is shown
 * recovery. It is not silently given a new identity.
 */
async function recoveryScenario(browser, origin) {
  const report = { result: 'fail' };
  const context = await browser.newContext({ viewport: VIEWPORTS.phone });
  try {
    await context.addCookies([{ name: 'linejam_guest_token', value: 'bm90LWEtdG9rZW4.forged', url: origin }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.goto(origin + '/');
    await page.locator('.recovery:has-text("Session expired")').waitFor();
    check(
      await page.locator('[data-action="create"]').isDisabled(),
      'recovery: New room is enabled with a refused credential'
    );
    check(
      await page.locator('[data-form="join"] button[type="submit"]').isDisabled(),
      'recovery: Join is enabled with a refused credential'
    );
    const before = (await context.cookies()).find((c) => c.name === 'linejam_guest_token').value;
    check(before === 'bm90LWEtdG9rZW4.forged', 'recovery: the refused credential was replaced without asking');
    await page.locator('[data-action="fresh-guest"]').click();
    await page.locator('[data-action="create"]:not([disabled])').waitFor();
    check((await page.locator('.recovery').count()) === 0, 'recovery: the notice stayed after starting fresh');
    await page.locator('#pen-name').fill('Marlowe');
    await page.locator('[data-action="create"]').click();
    await page.waitForURL(/\/room\//);
    await page.locator('.code-big').waitFor();
    check(errors.length === 0, `recovery: errors ${errors.join(' | ')}`);
    report.result = 'pass';
  } catch (error) {
    report.error = error.message;
  }
  await context.close();
  return report;
}

/**
 * [L1-3.10] Submit state is scoped to one assignment. The guest's round-1
 * line is accepted and the round advances over the socket while that submit
 * is still settling (its follow-up state read is held back). An Enter on the
 * round-2 line must be sent at once, not dropped.
 */
async function rapidSubmitScenario(browser, origin) {
  const report = { result: 'fail', heldReads: 0, inFlightAtEnter: 0, round2SentMs: null, errors: [] };
  const hostContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const guestContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    for (const page of [host, guest]) {
      page.on('pageerror', (error) => report.errors.push(error.message));
      page.on('console', (message) => message.type() === 'error' && report.errors.push(message.text()));
    }
    await host.goto(origin + '/');
    await host.locator('#pen-name').fill('Marlowe');
    await host.locator('[data-action="create"]:not([disabled])').click();
    await host.waitForURL(/\/room\//);
    const code = new URL(host.url()).pathname.split('/').pop();
    await guest.goto(`${origin}/join?code=${code}`);
    await guest.locator('#pen-name').fill('Ines');
    await guest.locator('[data-form="join"] button[type="submit"]:not([disabled])').click();
    await guest.waitForURL(/\/room\//);
    await host.locator('[data-action="start"]:not([disabled])').click();
    await host.locator('#line-input').waitFor();
    await guest.locator('#line-input').waitFor();

    await host.locator('#line-input').fill('Dawn');
    await host.locator('#line-input').press('Enter');
    await host.locator('.tucked:has-text("Line tucked")').waitFor();

    // Hold back the guest's room-state reads: the round-1 submit cannot settle.
    let hold = false;
    let inFlight = 0;
    await guest.route(
      (url) => url.pathname === `/api/rooms/${code}`,
      async (route) => {
        if (!hold || route.request().method() !== 'GET') return route.continue();
        report.heldReads++;
        inFlight++;
        await new Promise((resolve) => setTimeout(resolve, 4000));
        inFlight--;
        await route.continue().catch(() => undefined);
      }
    );
    hold = true;
    await guest.locator('#line-input').fill('Moss');
    await guest.locator('#line-input').press('Enter');
    // The round advances over the socket while the round-1 submit is still settling.
    await guest.locator('.round[aria-label="Round 2 of 9"]').waitFor({ timeout: 3000 });
    await guest.locator('#line-input').fill('cold river');
    report.inFlightAtEnter = inFlight;
    check(report.inFlightAtEnter > 0, 'rapid-submit: the round-1 submit had already settled; race not exercised');
    const enterAt = Date.now();
    const sent = guest.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().endsWith(`/api/rooms/${code}/lines`) &&
        request.postDataJSON()?.lineIndex === 1,
      { timeout: 2000 }
    );
    await guest.locator('#line-input').press('Enter');
    await sent.catch(() => {
      throw new Failure('rapid-submit: Enter on the round-2 line was dropped while round 1 was settling');
    });
    report.round2SentMs = Date.now() - enterAt;
    await guest.locator('.tucked:has-text("Line tucked")').waitFor({ timeout: 10_000 });
    const assignment = await guest.evaluate(
      async (c) => (await (await fetch(`/api/rooms/${c}/assignment`)).json()).assignment,
      code
    );
    check(
      assignment.lineIndex === 1 && assignment.submitted === 'cold river',
      `rapid-submit: round 2 stored ${JSON.stringify(assignment)}`
    );
    check(report.errors.length === 0, `rapid-submit: errors ${report.errors.join(' | ')}`);
    report.result = 'pass';
  } catch (error) {
    report.error = error.message;
    await host.screenshot({ path: join(out, 'rapid-submit-failure-host.png') }).catch(() => undefined);
    await guest.screenshot({ path: join(out, 'rapid-submit-failure-guest.png') }).catch(() => undefined);
  }
  await hostContext.close();
  await guestContext.close();
  return report;
}

/**
 * [L1-8.2]–[L1-8.8] Error capture on the real path: a second local Worker with
 * a loopback Sentry DSN. Headed Chrome raises an uncaught error, an unhandled
 * rejection and a CSP violation; each becomes a same-origin beacon, and the
 * Worker forwards each as one scrubbed, tagged Sentry envelope.
 */
async function telemetryScenario(browser, origin) {
  const report = { result: 'fail', beacons: [], envelopes: [], external: [], health: null, plainHealth: null };
  const received = [];
  const sink = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      received.push({ path: request.url, auth: request.headers['x-sentry-auth'] ?? '', body });
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
  });
  await new Promise((resolve) => sink.listen(0, '127.0.0.1', resolve));
  const sinkPort = sink.address().port;
  const wired = await startLocalWorker({
    port: port + 1,
    vars: { SENTRY_DSN: `http://e2ekey@127.0.0.1:${sinkPort}/7` },
  });
  const context = await browser.newContext({ viewport: VIEWPORTS.phone });
  try {
    report.plainHealth = await (await fetch(`${origin}/api/health`)).json();
    report.health = await (await fetch(`${wired.url}/api/health`)).json();
    check(
      report.plainHealth.sentryConfigured === false && report.health.sentryConfigured === true,
      `telemetry: sentryConfigured ${JSON.stringify([report.plainHealth, report.health])}`
    );
    check(
      typeof report.health.release === 'string' && report.health.release === report.plainHealth.release,
      'telemetry: health does not report one release identity'
    );
    check(!JSON.stringify(report.health).includes('e2ekey'), 'telemetry: health exposes the DSN');

    const page = await context.newPage();
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith(wired.url) && url.endsWith('/api/telemetry/error'))
        report.beacons.push({ body: request.postDataJSON(), cookie: Boolean(request.headers().cookie) });
    });
    page.on('response', (response) => {
      if (!response.url().startsWith(wired.url) && !/^(data|blob):/.test(response.url()))
        report.external.push(response.url());
    });
    // A page with an identifier and a share slug in the URL: neither may leave the Worker.
    await page.goto(`${wired.url}/poem/p_0123456789abcdef01234567?share=secret-share-slug-0123456789abcdef`);
    await page.locator('#app').waitFor();
    const beaconResponses = [];
    page.on('response', (response) => {
      if (response.url().endsWith('/api/telemetry/error')) beaconResponses.push(response.status());
    });
    await page.evaluate(() => {
      setTimeout(() => {
        throw new TypeError('probe room K7QM failed for ada@example.com');
      });
      Promise.reject(new Error('probe rejection /poem/p_0123456789abcdef01234567?share=leak'));
      const img = document.createElement('img');
      img.src = 'https://cdn.example.test/probe.png';
      document.body.append(img);
    });
    const deadline = Date.now() + 10_000;
    while (received.length < 3 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));

    report.envelopes = received.map(({ path, auth, body }) => {
      const [, , event] = body
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));
      return { path, auth: auth.replace(/sentry_key=[^,]+/, 'sentry_key=…'), event, raw: body };
    });
    const kinds = report.envelopes.map((e) => e.event.tags.kind).sort();
    check(
      JSON.stringify(kinds) === JSON.stringify(['browser_error', 'csp_violation', 'unhandled_rejection']),
      `telemetry: forwarded kinds ${JSON.stringify(kinds)}`
    );
    for (const { path, auth, event, raw } of report.envelopes) {
      check(path === '/api/7/envelope/', `telemetry: envelope sent to ${path}`);
      check(auth.startsWith('Sentry sentry_version=7'), 'telemetry: no Sentry auth header');
      check(
        event.environment === 'local' && event.release === report.health.release && event.tags.route === '/poem/:id',
        `telemetry: event tags ${JSON.stringify(event.tags)}`
      );
      for (const leak of ['K7QM', 'ada@example.com', 'secret-share-slug', 'share=leak', 'p_0123456789abcdef01234567'])
        check(!raw.includes(leak), `telemetry: "${leak}" left the Worker`);
    }
    check(report.beacons.length === 3, `telemetry: ${report.beacons.length} beacons, expected 3`);
    check(
      report.beacons.every((b) => !b.cookie && b.body.route === '/poem/:id'),
      'telemetry: a beacon carried a cookie or the raw path'
    );
    check(
      beaconResponses.every((status) => status === 204),
      `telemetry: beacon answers ${beaconResponses}`
    );
    check(report.external.length === 0, `telemetry: requests to another origin: ${report.external.join(' | ')}`);
    report.result = 'pass';
  } catch (error) {
    report.error = error.message;
  }
  await context.close();
  await wired.stop();
  await new Promise((resolve) => sink.close(resolve));
  // The envelopes are scrubbed; keep them as evidence without the raw text.
  report.envelopes = report.envelopes.map(({ raw, ...rest }) => rest);
  return report;
}

// ───────────────────────── main ─────────────────────────

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const worker = flag('--url') ? { url: flag('--url'), stop: async () => {} } : await startLocalWorker({ port });
const origin = worker.url;
check(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),
  `Refusing to run the walkthrough against ${origin}: local targets only`
);
console.log(`walkthrough: headed Chrome against ${origin} (wrangler dev, workerd + SQLite Durable Objects)`);

const configs = [];
for (const viewportName of Object.keys(VIEWPORTS))
  for (const modeName of Object.keys(MODES)) configs.push([viewportName, modeName]);
const selected = configs.filter(([v, m]) => !only || only.split(',').includes(`${v}-${m}`));

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1500,1000'] });
const version = browser.version();
const reports = [];
let fallback = null;
let recovery = null;
let rapidSubmit = null;
let telemetry = null;
const extra = (name) => !only || only.split(',').includes(name);
try {
  for (const [viewportName, modeName] of selected) {
    console.log(`▶ ${viewportName}-${modeName}`);
    const report = await runConfig(browser, origin, viewportName, modeName);
    console.log(`${report.result === 'pass' ? '✔' : '✘'} ${report.config}${report.error ? ` — ${report.error}` : ''}`);
    reports.push(report);
  }
  if (extra('rapid-submit')) {
    console.log('▶ rapid-submit');
    rapidSubmit = await rapidSubmitScenario(browser, origin);
    console.log(
      `${rapidSubmit.result === 'pass' ? '✔' : '✘'} rapid-submit${rapidSubmit.error ? ` — ${rapidSubmit.error}` : ''}`
    );
  }
  if (extra('telemetry')) {
    console.log('▶ telemetry');
    telemetry = await telemetryScenario(browser, origin);
    console.log(
      `${telemetry.result === 'pass' ? '✔' : '✘'} telemetry${telemetry.error ? ` — ${telemetry.error}` : ''}`
    );
  }
  if (!only) {
    console.log('▶ http-fallback');
    fallback = await fallbackScenario(browser, origin);
    console.log(
      `${fallback.result === 'pass' ? '✔' : '✘'} http-fallback${fallback.error ? ` — ${fallback.error}` : ''}`
    );
    console.log('▶ credential-recovery');
    recovery = await recoveryScenario(browser, origin);
    console.log(
      `${recovery.result === 'pass' ? '✔' : '✘'} credential-recovery${recovery.error ? ` — ${recovery.error}` : ''}`
    );
  }
} finally {
  await browser.close();
  await worker.stop();
}
rmSync(join(out, 'video-raw'), { recursive: true, force: true });

const failed = reports.filter((r) => r.result !== 'pass');
const sum = (key) => reports.reduce((n, r) => n + r[key].length, 0);
const summary = {
  target: 'local wrangler dev (workerd + SQLite Durable Objects)',
  browser: `Google Chrome ${version} (headed)`,
  commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD']).toString().trim(),
  dirty:
    execFileSync('git', ['-C', root, 'status', '--porcelain', '--', '.', ':(exclude)evidence']).toString().trim() !==
    '',
  ranAt: new Date().toISOString(),
  runs: reports.length,
  passed: reports.length - failed.length,
  totals: {
    consoleErrors: sum('consoleErrors'),
    pageErrors: sum('pageErrors'),
    cspViolations: sum('cspViolations'),
    failedRequests: sum('failedRequests'),
    externalRequests: sum('externalRequests'),
    unexpected4xx5xx: reports.reduce(
      (n, r) => n + r.badResponses.filter((l) => !/404 GET .*\/(poem\/[^?]+\?share=|changelog)/.test(l)).length,
      0
    ),
    maxOverflowPx: Math.max(0, ...reports.flatMap((r) => r.audits.map((a) => a.overflow))),
    minPhoneTouchTargetPx: Math.min(
      ...reports.filter((r) => !r.config.startsWith('desktop')).flatMap((r) => r.audits.map((a) => a.minTarget))
    ),
    requests: reports.reduce((n, r) => n + r.requests, 0),
    maxOverflowAt200PercentTextPx: Math.max(0, ...reports.flatMap((r) => r.largeText.map((a) => a.overflowAt200))),
  },
  httpFallback: fallback,
  credentialRecovery: recovery,
  rapidSubmit,
  telemetry,
  // Share tokens are credentials to a public page; keep them out of evidence.
  reports: JSON.parse(JSON.stringify(reports).replace(/share=[\w-]+/g, 'share=…')),
};
writeFileSync(join(out, 'walkthrough.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`\n${summary.passed}/${summary.runs} runs passed · ${JSON.stringify(summary.totals)}`);
console.log(`evidence: ${out} (${readdirSync(out).length} files)`);
const extras = [fallback, recovery, rapidSubmit, telemetry].filter(Boolean);
if (failed.length || reports.length + extras.length === 0 || extras.some((e) => e.result !== 'pass')) process.exit(1);
