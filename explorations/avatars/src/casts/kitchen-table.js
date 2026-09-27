// Kitchen Table: the things on the table where the game is played, each awake on its own
// colored coaster. The coaster is a token: every character has the same round footprint.
import {
  TINT,
  lift,
  deep,
  mix,
  circle,
  ellipse,
  rrect,
  smooth,
  poly,
} from '../engine.js';

const WHITE = '#FFFFFF';
const coaster = (c) => [
  { t: 'shape', d: circle(50, 50, 46), fill: c, w: 0.55 },
  {
    t: 'line',
    d: circle(50, 50, 40.5),
    w: 0.45,
    color: deep(c, 0.22),
    op: 0.7,
    soft: true,
    skip: 'small',
  },
];

const kettle = {
  id: 'kettle',
  name: 'Kettle',
  color: TINT.mint,
  draw: () => ({
    parts: [
      ...coaster(TINT.mint),
      {
        t: 'glyph',
        d: 'M34 43Q50 17 66 43',
        pen: 3.2,
        fill: deep(TINT.mint, 0.35),
      },
      {
        t: 'shape',
        d: smooth([
          [31, 59],
          [19.5, 46],
          [15.5, 49.5],
          [26, 68],
        ]),
        fill: WHITE,
      },
      {
        t: 'shape',
        d: smooth([
          [29, 76, 1],
          [27.5, 58],
          [35, 44],
          [50, 39.5],
          [65, 44],
          [72.5, 58],
          [71, 76, 1],
        ]),
        fill: WHITE,
      },
      { t: 'shape', d: rrect(26, 74, 48, 7, 3.5), fill: deep(TINT.mint, 0.12) },
      { t: 'shape', d: circle(50, 36.5, 4.4), fill: TINT.butter, w: 0.85 },
    ],
    face: { x: 50, y: 58, gap: 17 },
    anchors: { head: [50, 22, 0] },
  }),
};

const jam = {
  id: 'jam',
  name: 'Jam',
  color: TINT.rose,
  draw: () => ({
    parts: [
      ...coaster(TINT.rose),
      { t: 'shape', d: rrect(31, 36, 38, 44, 10), fill: WHITE },
      {
        t: 'fill',
        d: 'M31.6 52H68.4V70Q68.4 79.4 59 79.4H41Q31.6 79.4 31.6 70Z',
        fill: mix(TINT.rose, '#E9608A', 0.55),
      },
      {
        t: 'shape',
        d: smooth([
          [26.5, 38.5],
          [31, 27],
          [50, 22.5],
          [69, 27],
          [73.5, 38.5],
          [64, 41.5],
          [50, 37.5],
          [36, 41.5],
        ]),
        fill: TINT.peach,
      },
      { t: 'line', d: 'M30 36Q50 31 70 36', w: 0.8, skip: 'small' },
    ],
    face: { x: 50, y: 58, gap: 16, cheek: false },
    anchors: { head: [50, 14, 0] },
  }),
};

const toast = {
  id: 'toast',
  name: 'Toast',
  color: TINT.butter,
  draw: () => ({
    parts: [
      ...coaster(TINT.butter),
      {
        t: 'shape',
        d: smooth([
          [27, 77, 1],
          [27, 44],
          [21.5, 34],
          [29, 23],
          [50, 20.5],
          [71, 23],
          [78.5, 34],
          [73, 44],
          [73, 77, 1],
        ]),
        fill: '#E8A865',
      },
      {
        t: 'fill',
        d: smooth([
          [32.5, 72.5, 1],
          [32.5, 42.5],
          [28, 34.5],
          [33.5, 27],
          [50, 25.5],
          [66.5, 27],
          [72, 34.5],
          [67.5, 42.5],
          [67.5, 72.5, 1],
        ]),
        fill: '#FFF1D6',
      },
    ],
    face: { x: 50, y: 50, gap: 17 },
    anchors: { head: [50, 14, 0] },
  }),
};

const teacup = {
  id: 'teacup',
  name: 'Teacup',
  color: TINT.sky,
  draw: () => ({
    parts: [
      ...coaster(TINT.sky),
      {
        t: 'line',
        d: 'M42 30Q38 24 42 19M54 29Q50 23 54 17',
        w: 0.75,
        color: WHITE,
        skip: 'small',
      },
      { t: 'shape', d: ellipse(50, 76, 30, 6.5), fill: WHITE },
      {
        t: 'glyph',
        d: 'M70 50Q81.5 49 80 59Q78.5 67 67.5 64.5',
        pen: 3.4,
        fill: WHITE,
      },
      {
        t: 'shape',
        d: smooth([
          [26.5, 42, 1],
          [73.5, 42, 1],
          [70, 63],
          [59, 74.5],
          [41, 74.5],
          [30, 63],
        ]),
        fill: WHITE,
      },
      {
        t: 'fill',
        d: ellipse(50, 43.2, 22.5, 2.6),
        fill: deep(TINT.sky, 0.2),
        skip: 'small',
      },
    ],
    face: { x: 50, y: 55.5, gap: 17 },
    anchors: { head: [50, 26, 0] },
  }),
};

const candle = {
  id: 'candle',
  name: 'Wick',
  color: TINT.peach,
  draw: () => ({
    parts: [
      ...coaster(TINT.peach),
      {
        t: 'shape',
        d: smooth([
          [50, 11.5, 1],
          [57.5, 24],
          [55.5, 32.5],
          [50, 35],
          [44.5, 32.5],
          [42.5, 24],
        ]),
        fill: TINT.butter,
      },
      {
        t: 'fill',
        d: smooth([
          [50, 20, 1],
          [53.5, 27],
          [52, 31.5],
          [48, 31.5],
          [46.5, 27],
        ]),
        fill: '#FFF6D8',
        skip: 'small',
      },
      {
        t: 'shape',
        d: 'M36 40H64V78Q64 83 59 83H41Q36 83 36 78Z',
        fill: WHITE,
      },
      {
        t: 'shape',
        d: 'M36 40H64V47Q61 50 58.5 47Q56 55 52 48Q48 51 45 46.5Q41 49 36 45Z',
        fill: lift(TINT.lilac, 0.35),
        w: 0.8,
        skip: 'small',
      },
    ],
    face: { x: 50, y: 61, gap: 15, mw: 7 },
    anchors: { head: [50, 5, 0], hand: [78, 80, -30] },
  }),
};

const plant = {
  id: 'plant',
  name: 'Fern',
  color: TINT.pistachio,
  draw: () => ({
    parts: [
      ...coaster(TINT.pistachio),
      {
        t: 'shape',
        d: smooth([
          [49, 50],
          [36, 42],
          [27, 27],
          [40, 25],
          [50, 38],
        ]),
        fill: '#7ED39F',
      },
      {
        t: 'shape',
        d: smooth([
          [51, 50],
          [59, 34],
          [74, 22],
          [76, 36],
          [64, 47],
        ]),
        fill: '#7ED39F',
      },
      {
        t: 'shape',
        d: smooth([
          [50, 49],
          [45.5, 32],
          [50, 15.5],
          [55, 31],
        ]),
        fill: '#9BE0B5',
      },
      {
        t: 'shape',
        d: poly([
          [29, 50.5],
          [71, 50.5],
          [65.5, 83],
          [34.5, 83],
        ]),
        fill: WHITE,
      },
      { t: 'shape', d: rrect(26.5, 47, 47, 9, 4), fill: TINT.peach },
    ],
    face: { x: 50, y: 66.5, gap: 16, mw: 8 },
    anchors: { head: [50, 5, 0] },
  }),
};

const egg = {
  id: 'egg',
  name: 'Eggbert',
  color: TINT.lilac,
  draw: () => ({
    parts: [
      ...coaster(TINT.lilac),
      {
        t: 'shape',
        d: poly([
          [36, 60],
          [64, 60],
          [58, 75],
          [55, 77],
          [58, 84],
          [42, 84],
          [45, 77],
          [42, 75],
        ]),
        fill: TINT.butter,
      },
      { t: 'shape', d: ellipse(50, 43, 18, 22.5), fill: '#FFF8EC' },
      {
        t: 'shape',
        d: 'M33 60H67Q66.5 64 63.5 66H36.5Q33.5 64 33 60Z',
        fill: TINT.butter,
      },
    ],
    face: { x: 50, y: 44, gap: 16 },
    anchors: { head: [50, 16, 0] },
  }),
};

const lantern = {
  id: 'lantern',
  name: 'Lumen',
  color: TINT.aqua,
  draw: () => ({
    parts: [
      ...coaster(TINT.aqua),
      {
        t: 'glyph',
        d: 'M42 24Q50 12 58 24',
        pen: 2.8,
        fill: deep(TINT.aqua, 0.35),
      },
      {
        t: 'shape',
        d: poly([
          [36, 32],
          [64, 32],
          [58, 24],
          [42, 24],
        ]),
        fill: deep(TINT.aqua, 0.18),
      },
      { t: 'shape', d: rrect(33, 32, 34, 42, 6), fill: '#FFF3C4' },
      {
        t: 'fill',
        d: ellipse(50, 53, 12, 15),
        fill: TINT.butter,
        op: 0.75,
        skip: 'small',
      },
      { t: 'shape', d: rrect(30, 73, 40, 8, 3.5), fill: deep(TINT.aqua, 0.18) },
    ],
    face: { x: 50, y: 52, gap: 16 },
    anchors: { head: [50, 8, 0] },
  }),
};

export default {
  id: 'kitchen-table',
  name: 'Kitchen Table',
  range: 'Radical',
  stance:
    'The things on the table where you play, each awake on its own colored coaster.',
  moods: false,
  edge: false,
  face: {
    eye: 'bean',
    w: 5.2,
    h: 8,
    gap: 16,
    mouth: 'smile',
    mw: 8,
    my: 8.5,
    cheek: '#FF9DB6',
    cheekR: 3.4,
    cheekDy: 6.5,
    cheekDx: 2,
    cheekOp: 0.8,
    smallEye: 1.3,
  },
  chars: [kettle, jam, toast, teacup, candle, plant, egg, lantern],
};
