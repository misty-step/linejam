// Folded Figures (wildcard): every character is its own exquisite corpse, the drawing game
// Linejam comes from. Head, body and feet come from different hands and meet at two folds.
// At small sizes the figure is framed as a portrait: only the top fold shows.
import {
  TINT,
  INK,
  lift,
  deep,
  circle,
  ellipse,
  rrect,
  smooth,
  poly,
  f,
} from '../engine.js';

const HEADS = {
  moth: (c) => ({
    parts: [
      { t: 'line', d: 'M44.5 17Q39 7 31 5.5M55.5 17Q61 7 69 5.5', w: 0.8 },
      {
        t: 'shape',
        d: ellipse(30.5, 5.5, 4.4, 2.8),
        fill: c,
        w: 0.8,
        tf: 'rotate(-20 30.5 5.5)',
      },
      {
        t: 'shape',
        d: ellipse(69.5, 5.5, 4.4, 2.8),
        fill: c,
        w: 0.8,
        tf: 'rotate(20 69.5 5.5)',
      },
      { t: 'shape', d: circle(50, 28, 15.5), fill: c },
    ],
    face: { x: 50, y: 28, gap: 12.5 },
  }),
  cat: (c) => ({
    parts: [
      {
        t: 'shape',
        d: smooth([
          [50, 18],
          [59.5, 17],
          [66, 6.5, 1],
          [69.5, 22],
          [66.5, 35.5],
          [50, 41],
          [33.5, 35.5],
          [30.5, 22],
          [34, 6.5, 1],
          [40.5, 17],
        ]),
        fill: c,
      },
    ],
    face: { x: 50, y: 28.5, gap: 13, mouth: 'cat' },
  }),
  bird: (c) => ({
    parts: [
      {
        t: 'shape',
        d: smooth([
          [45.5, 14],
          [43.5, 4.5],
          [49.5, 8.5],
          [53.5, 2.5],
          [55.5, 13],
        ]),
        fill: TINT.rose,
        w: 0.85,
      },
      { t: 'shape', d: circle(50, 27.5, 14.5), fill: c },
      {
        t: 'shape',
        d: 'M46 30.5Q50 29.5 54 30.5L50 37Z',
        fill: TINT.butter,
        w: 0.75,
      },
    ],
    face: { x: 50, y: 26, gap: 13, noMouth: true },
  }),
  teapot: (c) => ({
    parts: [
      { t: 'shape', d: circle(50, 14.5, 4.4), fill: TINT.butter, w: 0.85 },
      {
        t: 'shape',
        d: smooth([
          [31.5, 40, 1],
          [33.5, 28],
          [42, 20.5],
          [50, 18.5],
          [58, 20.5],
          [66.5, 28],
          [68.5, 40, 1],
        ]),
        fill: c,
      },
    ],
    face: { x: 50, y: 30.5, gap: 14 },
  }),
};

const BODIES = {
  sweater: (c) => [
    {
      t: 'shape',
      d: ellipse(31.5, 53, 5.5, 8.5),
      fill: c,
      tf: 'rotate(18 31.5 53)',
    },
    {
      t: 'shape',
      d: ellipse(68.5, 53, 5.5, 8.5),
      fill: c,
      tf: 'rotate(-18 68.5 53)',
    },
    { t: 'shape', d: rrect(33.5, 40, 33, 31, 9), fill: c },
    {
      t: 'line',
      d: 'M35 51H65M35 60H65',
      w: 1.1,
      color: lift(c, 0.6),
      soft: true,
      skip: 'small',
    },
  ],
  teacup: (c) => [
    { t: 'glyph', d: 'M67 46Q76.5 46 75 54Q74 60 65.5 58.5', pen: 3, fill: c },
    {
      t: 'shape',
      d: smooth([
        [30.5, 40.5, 1],
        [69.5, 40.5, 1],
        [66, 61],
        [57, 70],
        [43, 70],
        [34, 61],
      ]),
      fill: c,
    },
  ],
  fish: (c) => [
    {
      t: 'shape',
      d: poly([
        [32, 50],
        [22, 45],
        [25, 57],
      ]),
      fill: deep(c, 0.12),
      w: 0.85,
    },
    {
      t: 'shape',
      d: poly([
        [68, 50],
        [78, 45],
        [75, 57],
      ]),
      fill: deep(c, 0.12),
      w: 0.85,
    },
    { t: 'shape', d: ellipse(50, 55, 19.5, 15.5), fill: c },
    {
      t: 'line',
      d: 'M42 50Q45 54 42 58M50 49Q53 54 50 59M58 50Q61 54 58 58',
      w: 0.7,
      color: deep(c, 0.3),
      soft: true,
      skip: 'small',
    },
  ],
  book: (c) => [
    {
      t: 'shape',
      d: 'M50 45Q40 40.5 27.5 42.5V67Q40 65.5 50 70Z',
      fill: '#FFFFFF',
    },
    { t: 'shape', d: 'M50 45Q60 40.5 72.5 42.5V67Q60 65.5 50 70Z', fill: c },
    {
      t: 'line',
      d: 'M32 49Q38 47.5 45 49.5M32 55Q38 53.5 45 55.5',
      w: 0.6,
      color: deep(c, 0.3),
      soft: true,
      skip: 'small',
    },
  ],
};

const FEET = {
  boots: (c) => [
    {
      t: 'shape',
      d: smooth([
        [37, 70, 1],
        [46, 70, 1],
        [46.5, 91, 1],
        [31.5, 91, 1],
        [31.5, 86],
        [37, 84],
      ]),
      fill: c,
    },
    {
      t: 'shape',
      d: smooth([
        [54, 70, 1],
        [63, 70, 1],
        [63, 84],
        [68.5, 86],
        [68.5, 91, 1],
        [53.5, 91, 1],
      ]),
      fill: c,
    },
  ],
  bird: (c) => [
    { t: 'line', d: 'M44 70V86M56 70V86', w: 1.1 },
    {
      t: 'line',
      d: 'M44 86L37 92M44 86L44 93M44 86L51 92M56 86L49 92M56 86L56 93M56 86L63 92',
      w: 0.95,
      color: deep(c, 0.45),
    },
  ],
  frog: (c) => [
    {
      t: 'shape',
      d: smooth([
        [41, 70],
        [44, 84],
        [42.5, 90],
        [30, 92.5],
        [33, 86.5],
        [37, 82],
        [35.5, 72],
      ]),
      fill: c,
    },
    {
      t: 'shape',
      d: smooth([
        [59, 70],
        [64.5, 72],
        [63, 82],
        [67, 86.5],
        [70, 92.5],
        [57.5, 90],
        [56, 84],
      ]),
      fill: c,
    },
  ],
  skates: (c) => [
    { t: 'shape', d: rrect(32, 72, 36, 10, 5), fill: c },
    { t: 'shape', d: circle(40, 88, 5.2), fill: '#FFFFFF' },
    { t: 'shape', d: circle(60, 88, 5.2), fill: '#FFFFFF' },
  ],
};

const folds = (k) => ({
  t: 'raw',
  soft: true,
  svg: `<path d="M20 40.5H80M20 70.5H80" stroke="${INK}" stroke-width="${f(k.ink * 0.55)}" stroke-dasharray="${f(k.ink * 1.1)} ${f(k.ink * 1.6)}" opacity=".55"/>`,
});

function figure(id, name, [h, hc], [b, bc], [ft, fc], shift = [0, 0, 0]) {
  return {
    id,
    name,
    color: hc,
    crop: (k) => (k.small ? [21, -1, 58, 58] : null),
    draw: (k) => {
      const head = HEADS[h](hc, k);
      const move = (parts, dx) =>
        parts.map((p) => ({
          ...p,
          tf: `translate(${dx} 0)${p.tf ? ' ' + p.tf : ''}`,
        }));
      const parts = [
        ...move(FEET[ft](fc), shift[2]),
        ...move(BODIES[b](bc), shift[1]),
        ...move(head.parts, shift[0]),
      ];
      if (!k.small) parts.push(folds(k));
      return {
        parts,
        face: { ...head.face, x: head.face.x + shift[0] },
        anchors: {
          head: [50 + shift[0], 9, -8],
          hand: [80, 66, -30],
          front: [50, 60, 0],
          sky: [84, 12],
        },
      };
    },
  };
}

export default {
  id: 'folded-figures',
  name: 'Folded Figures',
  range: 'Wildcard',
  stance:
    'Each character is its own exquisite corpse: three hands, two folds, one friend.',
  moods: false,
  face: {
    eye: 'dot',
    w: 5.6,
    h: 5.6,
    gap: 13,
    mouth: 'smile',
    mw: 6.5,
    my: 6.5,
    cheek: null,
    smallEye: 1.1,
    smallGap: 1,
  },
  chars: [
    figure(
      'mothboots',
      'Mothboots',
      ['moth', TINT.butter],
      ['sweater', TINT.sky],
      ['boots', TINT.rose],
      [1.5, -1, 0]
    ),
    figure(
      'catcup',
      'Catcup',
      ['cat', TINT.peach],
      ['teacup', TINT.mint],
      ['bird', TINT.butter],
      [-1.5, 1, 0]
    ),
    figure(
      'birdfish',
      'Birdfish',
      ['bird', TINT.sky],
      ['fish', TINT.aqua],
      ['skates', TINT.lilac],
      [1, 0, -1.5]
    ),
    figure(
      'potfrog',
      'Potfrog',
      ['teapot', TINT.mint],
      ['sweater', TINT.rose],
      ['frog', TINT.pistachio],
      [-1, 1.5, 0]
    ),
    figure(
      'mothfin',
      'Mothfin',
      ['moth', TINT.lilac],
      ['fish', TINT.peach],
      ['bird', TINT.mint],
      [0, 1, -1]
    ),
    figure(
      'bookcat',
      'Bookcat',
      ['cat', TINT.cream],
      ['book', TINT.lilac],
      ['boots', TINT.sky],
      [1, -1.5, 1]
    ),
    figure(
      'cupbird',
      'Cupbird',
      ['bird', TINT.rose],
      ['teacup', TINT.butter],
      ['frog', TINT.aqua],
      [-1, 0, 1.5]
    ),
    figure(
      'rollpot',
      'Rollpot',
      ['teapot', TINT.pistachio],
      ['book', TINT.peach],
      ['skates', TINT.rose],
      [1.5, -1, 0]
    ),
  ],
};
