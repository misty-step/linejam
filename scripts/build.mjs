// One build produces everything the Worker serves, from sources of truth:
//   folio/assets/**        → /folio/* (byte-exact, checksum-verified), tokens.css,
//                            inline SVG strings, raster icons derived from mark.svg
//   node_modules fonts     → /fonts/*.woff2 + fonts.css (self-hosted, OFL)
//   web/static, web/src    → index.html, styles.css, app.js, theme.js
// A checksum mismatch fails the build. Nothing here is hand-copied.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const folio = join(root, 'folio/assets');
const out = join(root, 'dist/public');
const generated = join(root, 'web/src/generated');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// ── 1. Canonical assets: verify every checksum, then copy the exact bytes ──
const manifest = JSON.parse(await readFile(join(folio, 'checksums.json'), 'utf8'));
const assets = {};
for (const [name, expected] of Object.entries(manifest)) {
  const bytes = await readFile(join(folio, name));
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`folio/assets/${name}: sha256 ${actual} does not match checksums.json ${expected}`);
  }
  assets[name] = bytes;
}

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'folio'), { recursive: true });
await mkdir(join(out, 'fonts'), { recursive: true });
await mkdir(generated, { recursive: true });
for (const [name, bytes] of Object.entries(assets)) await writeFile(join(out, 'folio', name), bytes);
await cp(join(folio, 'checksums.json'), join(out, 'folio/checksums.json'));

// ── 2. Tokens → CSS custom properties (the only colors, radii and motion in the UI) ──
const tokens = JSON.parse(assets['tokens.json'].toString('utf8'));
const cssName = {
  bg: '--bg', bgDesk: '--bg-desk', surface: '--surface', surfaceSubtle: '--surface-subtle',
  surfaceElevated: '--surface-elevated', ink: '--ink', inkSecondary: '--ink-secondary', inkMuted: '--ink-muted',
  hairline: '--hairline', hairlineStrong: '--hairline-strong', accent: '--accent', accentHover: '--accent-hover',
  accentInk: '--accent-ink', accentSoft: '--accent-soft', accentBorder: '--accent-border', danger: '--danger',
  dangerSoft: '--danger-soft', dangerBorder: '--danger-border', heartActive: '--heart', heartSoft: '--heart-soft',
};
const mode = (set, indent) =>
  Object.entries(cssName)
    .map(([token, name]) => {
      if (!(token in set)) throw new Error(`tokens.json is missing ${token}`);
      return `${indent}${name}: ${set[token]};`;
    })
    .join('\n');
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
const tokensCss = `/* Generated from folio/assets/tokens.json by scripts/build.mjs. Do not edit. */
:root {
  color-scheme: light;
${mode(tokens.light, '  ')}
  --font-serif: ${tokens.typography.serif};
  --font-sans: ${tokens.typography.sans};
  --font-mono: ${tokens.typography.mono};
  --radius-sheet: ${tokens.radii.sheet};
  --radius-control: ${tokens.radii.control};
  --radius-tag: ${tokens.radii.tag};
  --ease-out: ${tokens.motion.easeOut};
  --tap: ${tokens.motion.tapMs}ms;
  --micro: ${tokens.motion.microMs}ms;
  --screen: ${tokens.motion.screenMs}ms;
  /* The QR is always light-mode ink on the light elevated plate, in both modes. */
  --qr-ink: ${tokens.light.ink};
  --qr-plate: ${tokens.light.surfaceElevated};
  /* The one soft shadow (floating layers only) and the dialog scrim, from light ink. */
  --shadow-float: 0 12px 32px rgba(${rgb(tokens.light.ink)}, 0.16);
  --scrim: rgba(${rgb(tokens.light.ink)}, 0.42);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
${mode(tokens.dark, '    ')}
  }
}
:root[data-theme='dark'] {
  color-scheme: dark;
${mode(tokens.dark, '  ')}
}
`;
await writeFile(join(out, 'tokens.css'), tokensCss);

// ── 3. Inline SVG: the file text itself, so geometry and attributes are exact ──
const svgEntries = Object.entries(assets)
  .filter(([name]) => name.endsWith('.svg'))
  .map(([name, bytes]) => `  ${JSON.stringify(name.replace(/\.svg$/, ''))}: ${JSON.stringify(bytes.toString('utf8').trim())},`)
  .join('\n');
await writeFile(
  join(generated, 'folio.ts'),
  `// Generated from folio/assets/*.svg by scripts/build.mjs. Do not edit.\nexport const FOLIO_SVG: Record<string, string> = {\n${svgEntries}\n};\n`
);

// ── 4. Raster icons, all derived from mark.svg: #224e42 mark on opaque #f4f1ea ──
const markSvg = assets['mark.svg'].toString('utf8');
const paper = tokens.light.bg;
const ink = tokens.light.accent;
function iconSvg(size, markFraction) {
  const mark = Math.round(size * markFraction);
  const offset = (size - mark) / 2;
  const placed = markSvg.replace('<svg ', `<svg x="${offset}" y="${offset}" width="${mark}" height="${mark}" color="${ink}" `);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${paper}"/>${placed}</svg>`
  );
}
async function png(size, markFraction) {
  // flatten + removeAlpha: an RGB PNG with no alpha channel at all.
  return sharp(iconSvg(size, markFraction), { density: 72 })
    .resize(size, size)
    .flatten({ background: paper })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}
await writeFile(join(out, 'apple-touch-icon.png'), await png(180, 0.68));
await writeFile(join(out, 'icon-192.png'), await png(192, 0.72));
await writeFile(join(out, 'icon-512.png'), await png(512, 0.72));
// Maskable: the whole mark sits well inside the central 80% safe zone.
await writeFile(join(out, 'icon-maskable-512.png'), await png(512, 0.56));
// favicon.ico: 16 px and 32 px PNG frames in one ICO container.
const frames = [await png(16, 0.94), await png(32, 0.9)];
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const size = [16, 32][i];
  const at = 6 + 16 * i;
  header.writeUInt8(size, at);
  header.writeUInt8(size, at + 1);
  header.writeUInt8(0, at + 2);
  header.writeUInt8(0, at + 3);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(24, at + 6);
  header.writeUInt32LE(frame.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += frame.length;
});
await writeFile(join(out, 'favicon.ico'), Buffer.concat([header, ...frames]));

// ── 5. Self-hosted OFL fonts ──
const fonts = [
  { pkg: '@fontsource-variable/newsreader', css: 'wght.css', family: 'Newsreader', files: ['newsreader-latin-wght-normal', 'newsreader-latin-ext-wght-normal'], weight: '200 800' },
  { pkg: '@fontsource-variable/plus-jakarta-sans', css: 'wght.css', family: 'Plus Jakarta Sans', files: ['plus-jakarta-sans-latin-wght-normal', 'plus-jakarta-sans-latin-ext-wght-normal'], weight: '200 800' },
  { pkg: '@fontsource/ibm-plex-mono', css: '400.css', family: 'IBM Plex Mono', files: ['ibm-plex-mono-latin-400-normal'], weight: '400' },
  { pkg: '@fontsource/ibm-plex-mono', css: '500.css', family: 'IBM Plex Mono', files: ['ibm-plex-mono-latin-500-normal'], weight: '500' },
];
let fontsCss = '/* Generated by scripts/build.mjs. Self-hosted OFL fonts; no external requests. */\n';
const licensed = new Set();
for (const font of fonts) {
  const dir = join(root, 'node_modules', font.pkg);
  const css = await readFile(join(dir, font.css), 'utf8');
  for (const file of font.files) {
    const block = css.split('@font-face').find((b) => b.includes(`/${file}.woff2`));
    const range = block && /unicode-range:\s*([^;]+);/.exec(block);
    if (!range) throw new Error(`No unicode-range for ${file} in ${font.pkg}/${font.css}`);
    await cp(join(dir, 'files', `${file}.woff2`), join(out, 'fonts', `${file}.woff2`));
    fontsCss += `@font-face {\n  font-family: '${font.family}';\n  font-style: normal;\n  font-display: swap;\n  font-weight: ${font.weight};\n  src: url('/fonts/${file}.woff2') format('woff2');\n  unicode-range: ${range[1].trim()};\n}\n`;
  }
  if (!licensed.has(font.pkg)) {
    licensed.add(font.pkg);
    await cp(join(dir, 'LICENSE'), join(out, 'fonts', `${font.family.replace(/ /g, '')}-OFL.txt`));
  }
}
await writeFile(join(out, 'fonts.css'), fontsCss);

// ── 6. Static files and the client bundle ──
await cp(join(root, 'web/static'), out, { recursive: true });
const common = { bundle: true, minify: true, format: 'esm', target: 'es2022', legalComments: 'none', logLevel: 'warning' };
await build({ ...common, entryPoints: [join(root, 'web/src/main.ts')], outfile: join(out, 'app.js') });
await build({ ...common, format: 'iife', entryPoints: [join(root, 'web/src/theme-boot.ts')], outfile: join(out, 'theme.js') });

console.log(`build: ${Object.keys(manifest).length} folio checksums verified → dist/public`);
