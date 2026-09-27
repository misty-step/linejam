// Contact sheet for drawing review: every character at true sizes on both pages, plus moods.
// bun explorations/avatars/tools/contact.js <cast-module> <out.svg> [--moods] [--props]
import { renderAvatar, MODE, MOODS } from '../src/engine.js';

const [modPath, outPath, ...flags] = process.argv.slice(2);
const cast = (await import(new URL(modPath, `file://${process.cwd()}/`).href))
  .default;
const SIZES = [24, 32, 44, 72, 128];
const pad = 16;
const colW = 150;
let y = pad;
let body = '';
const width = pad * 2 + colW * cast.chars.length;

function band(mode, rows) {
  const m = MODE[mode];
  const h = rows.reduce((a, r) => a + r.h, 0) + pad;
  let out = `<rect x="0" y="${y}" width="${width}" height="${h}" fill="${m.page}"/>`;
  let yy = y + pad / 2;
  for (const r of rows) {
    out += r.draw(yy, m, mode);
    yy += r.h;
  }
  y += h;
  return out;
}

function sizeRow(size) {
  return {
    h: Math.max(size, 20) + 26,
    draw: (yy, m, mode) =>
      cast.chars
        .map((c, i) => {
          const x = pad + i * colW + (colW - size) / 2;
          const svg = renderAvatar(cast, c.id, { size, mode, hollow: m.page });
          const label =
            size === 72
              ? `<text x="${pad + i * colW + colW / 2}" y="${yy + size + 18}" font-family="Nunito Sans, sans-serif" font-size="13" fill="${m.text}" text-anchor="middle">${c.name}</text>`
              : '';
          return `<g transform="translate(${x} ${yy})">${svg}</g>${label}`;
        })
        .join('') +
      `<text x="4" y="${yy + 12}" font-family="sans-serif" font-size="9" fill="${m.text2}">${size}</text>`,
  };
}

function moodRow(size, mood, extra = {}) {
  return {
    h: size + 22,
    draw: (yy, m, mode) =>
      cast.chars
        .map((c, i) => {
          const x = pad + i * colW + (colW - size) / 2;
          return `<g transform="translate(${x} ${yy})">${renderAvatar(cast, c.id, { size, mode, mood, hollow: m.surface, ...extra })}</g>`;
        })
        .join('') +
      `<text x="4" y="${yy + 12}" font-family="sans-serif" font-size="9" fill="${m.text2}">${mood}${extra.prop ? '+' + extra.prop : ''}</text>`,
  };
}

const rows = SIZES.map(sizeRow);
body += band('light', rows);
body += band('dark', rows);
if (flags.includes('--moods')) {
  const mrows = MOODS.map((mood) =>
    moodRow(64, mood, mood === 'watching' ? { outlined: true } : {})
  );
  body += band('light', mrows);
  body += band('dark', mrows);
}
if (flags.includes('--props')) {
  const prow = ['crown', 'pencil', 'note', 'moon', 'book'].map((p) =>
    moodRow(
      56,
      p === 'book'
        ? 'reading'
        : p === 'moon'
          ? 'away'
          : p === 'note'
            ? 'tucked'
            : p === 'pencil'
              ? 'writing'
              : 'idle',
      { prop: p }
    )
  );
  body += band('light', prow);
  body += band('dark', prow);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}">${body}</svg>`;
await Bun.write(outPath, svg);
console.log(`${outPath} ${width}x${y}`);
