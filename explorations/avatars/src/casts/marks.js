// Marks: the punctuation that makes a poem breathe, built as chunky monoline glyphs that
// rhyme with the DynaPuff wordmark. Eyes and a small smile sit on the glyph itself.
import { TINT, circle, smooth } from '../engine.js';

const arm = (a, len, cx = 50, cy = 50) => {
  const r = (a * Math.PI) / 180;
  return `M${cx} ${cy}L${(cx + Math.cos(r) * len).toFixed(2)} ${(cy + Math.sin(r) * len).toFixed(2)}`;
};

const comma = {
  id: 'comma',
  name: 'Comma',
  color: TINT.mint,
  line: 'Knows when to pause.',
  draw: () => ({
    parts: [
      {
        t: 'shape',
        d: smooth([
          [47, 14.5],
          [63.5, 20],
          [72, 35.5],
          [70.5, 54],
          [62.5, 71],
          [49, 84.5],
          [30.5, 93.5, 1],
          [40, 80.5],
          [45, 67.5],
          [34, 63.5],
          [24.5, 53.5],
          [22.5, 36],
          [31, 20],
        ]),
        fill: TINT.mint,
      },
    ],
    face: { x: 47, y: 38.5, gap: 17 },
    anchors: { head: [47, 12, -8], hand: [74, 80, -30] },
  }),
};

const amp = {
  id: 'amp',
  name: 'Amp',
  color: TINT.rose,
  line: 'Always adds one more thing.',
  draw: () => ({
    parts: [
      {
        t: 'union',
        fill: TINT.rose,
        items: [
          { d: 'M38 43C21 54 16 70 26 82C36 93 58 91 70 76L80 62', pen: 14 },
          { d: 'M53 43L82 88', pen: 14 },
          { d: circle(45.5, 28, 17.5) },
        ],
      },
    ],
    face: { x: 45.5, y: 27, gap: 13.5, mw: 6.5, my: 6.5 },
    anchors: { head: [46, 9, -10], hand: [86, 70, -28] },
  }),
};

const aster = {
  id: 'aster',
  name: 'Aster',
  color: TINT.butter,
  line: 'Marks the good bits.',
  draw: () => ({
    parts: [
      {
        t: 'union',
        fill: TINT.butter,
        items: [
          ...[-60, 0, 60, 120, 180, 240].map((a) => ({
            d: arm(a, 34.5),
            pen: 17,
          })),
          { d: circle(50, 50, 18.5) },
        ],
      },
    ],
    face: { x: 50, y: 48.5, gap: 14.5, mw: 7, my: 7 },
    anchors: { head: [50, 26, 0], hand: [84, 78, -30] },
  }),
};

const tilde = {
  id: 'tilde',
  name: 'Tilde',
  color: TINT.sky,
  line: 'Goes with the flow.',
  draw: () => ({
    parts: [
      {
        t: 'glyph',
        d: 'M13 61C19 30 40 27 50 50C60 73 81 70 87 39',
        pen: 26,
        fill: TINT.sky,
      },
    ],
    face: { x: 30.5, y: 36, gap: 12.5, mw: 6, my: 6.5 },
    anchors: { head: [30, 17, -10], hand: [84, 64, -30], sky: [88, 16] },
  }),
};

const pilcrow = {
  id: 'pilcrow',
  name: 'Pilcrow',
  color: TINT.lilac,
  line: 'Starts a fresh stanza.',
  draw: () => ({
    parts: [
      {
        t: 'union',
        fill: TINT.lilac,
        items: [
          { d: 'M56 17V86', pen: 11.5 },
          { d: 'M73 17V86', pen: 11.5 },
          { d: 'M44 17H73', pen: 11.5 },
          {
            d: smooth([
              [57, 12],
              [57, 54],
              [41, 54],
              [26, 48],
              [19.5, 33.5],
              [26, 19],
              [41, 12],
            ]),
          },
        ],
      },
    ],
    face: { x: 38, y: 32.5, gap: 13, mw: 6.5, my: 7 },
    anchors: { head: [40, 5, -8], hand: [84, 84, -30], front: [48, 86, 0] },
  }),
};

const paren = {
  id: 'paren',
  name: 'Paren',
  color: TINT.peach,
  line: 'Holds a thought close.',
  draw: () => ({
    parts: [
      { t: 'glyph', d: 'M27 13Q3 52 27 91', pen: 10.5, fill: TINT.peach },
      { t: 'glyph', d: 'M73 13Q97 52 73 91', pen: 10.5, fill: TINT.peach },
      { t: 'shape', d: circle(50, 52, 22.5), fill: TINT.peach },
    ],
    face: { x: 50, y: 50, gap: 16, mw: 7.5, my: 7.5 },
    anchors: { head: [50, 26, -6], hand: [78, 82, -30] },
  }),
};

const dot = {
  id: 'dot',
  name: 'Dot',
  color: TINT.aqua,
  line: 'Ends every poem on time.',
  draw: () => ({
    parts: [{ t: 'shape', d: circle(50, 54, 33), fill: TINT.aqua }],
    over: [
      {
        t: 'line',
        d: 'M30.5 46Q33 33 45 29.5',
        w: 0.9,
        color: '#FFFFFF',
        soft: true,
        only: 'large',
      },
    ],
    face: { x: 50, y: 51, gap: 19 },
    anchors: { head: [50, 21, -8] },
  }),
};

// The slash is how a poem's line breaks survive when it is quoted in one line.
const slash = {
  id: 'slash',
  name: 'Slash',
  color: TINT.pistachio,
  line: 'Knows where every line breaks.',
  draw: () => ({
    parts: [{ t: 'glyph', d: 'M36 82L64 18', pen: 32, fill: TINT.pistachio }],
    face: { x: 55, y: 38, gap: 15, mw: 7, my: 7.5, rot: -10 },
    anchors: { head: [66, 5, 12], hand: [66, 84, -30] },
  }),
};

export default {
  id: 'marks',
  name: 'Marks',
  range: 'Evolutionary',
  stance:
    'The punctuation that makes a poem breathe, drawn as chunky glyphs with a face.',
  face: {
    eye: 'dot',
    w: 6.4,
    h: 6.4,
    gap: 16,
    mouth: 'smile',
    mw: 7.5,
    my: 7.5,
    cheek: null,
    smallEye: 1.3,
  },
  chars: [comma, amp, aster, tilde, pilcrow, paren, dot, slash],
};
