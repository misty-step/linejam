// Same Eight: keep today's names, ids and silhouette ideas; redraw them as one family with a
// shared face, attached limbs, one tint each, equal optical mass and optical sizing.
import {
  TINT,
  lift,
  deep,
  circle,
  ellipse,
  smooth,
  poly,
  rrect,
  ring,
} from '../engine.js';

const feet = (fill, y = 87.5, dx = 11) => [
  { t: 'shape', d: ellipse(50 - dx, y, 7, 4.5), fill },
  { t: 'shape', d: ellipse(50 + dx, y, 7, 4.5), fill },
];
const arms = (fill, y, dx, tilt = 28) => [
  {
    t: 'shape',
    d: ellipse(50 - dx, y, 6.6, 4.2),
    fill,
    tf: `rotate(${-tilt} ${50 - dx} ${y})`,
  },
  {
    t: 'shape',
    d: ellipse(50 + dx, y, 6.6, 4.2),
    fill,
    tf: `rotate(${tilt} ${50 + dx} ${y})`,
  },
];

const pip = {
  id: 'pip',
  name: 'Pip',
  color: TINT.peach,
  draw: () => {
    const c = TINT.peach;
    return {
      parts: [
        ...arms(c, 63, 30, 30),
        ...feet(deep(c, 0.12), 87.5, 13),
        {
          t: 'shape',
          d: smooth([
            [50, 13],
            [58.5, 19.5],
            [80.5, 67],
            [81.5, 79.5],
            [70, 86.5],
            [30, 86.5],
            [18.5, 79.5],
            [19.5, 67],
            [41.5, 19.5],
          ]),
          fill: c,
        },
        {
          t: 'shape',
          d: smooth([
            [50, 9],
            [57.5, 16],
            [64.5, 32.5],
            [50, 37.5],
            [35.5, 32.5],
            [42.5, 16],
          ]),
          fill: TINT.mint,
        },
      ],
      face: { x: 50, y: 59, gap: 19 },
      anchors: { head: [50, 6, -8] },
    };
  },
};

const moss = {
  id: 'moss',
  name: 'Moss',
  color: TINT.mint,
  draw: () => {
    const c = TINT.mint;
    return {
      parts: [
        ...arms(c, 58, 33, 24),
        ...feet(deep(c, 0.12)),
        { t: 'shape', d: rrect(18.5, 23, 63, 61, 18), fill: c },
        {
          t: 'shape',
          d: smooth([
            [64, 25],
            [68, 14],
            [78, 10],
            [79, 19],
            [71, 25],
          ]),
          fill: TINT.pistachio,
          w: 0.85,
        },
      ],
      face: { x: 50, y: 51, gap: 21 },
      anchors: { head: [44, 17, -10] },
    };
  },
};

const pebble = {
  id: 'pebble',
  name: 'Pebble',
  color: TINT.cream,
  draw: () => {
    const c = TINT.cream;
    return {
      parts: [
        ...feet(deep(TINT.lilac, 0.25), 85.5, 14),
        {
          t: 'shape',
          d: smooth([
            [28, 42],
            [50, 34.5],
            [70.5, 38.5],
            [85, 52],
            [85, 70],
            [71, 82.5],
            [34, 84],
            [16.5, 76],
            [13.5, 58],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d:
            circle(70, 50, 2.4) +
            circle(76, 60, 1.8) +
            circle(24, 70, 2) +
            circle(31, 76.5, 1.5),
          fill: lift(TINT.lilac, 0.1),
          skip: 'small',
        },
      ],
      face: { x: 48.5, y: 58, gap: 21 },
      anchors: { head: [48, 30, -6], sky: [88, 26] },
    };
  },
};

const orbit = {
  id: 'orbit',
  name: 'Orbit',
  color: TINT.sky,
  draw: () => {
    const c = TINT.sky;
    const ring = (sweep) => `M9 55A41 11.5 0 0 ${sweep} 91 55`;
    return {
      parts: [
        {
          t: 'glyph',
          d: ring(1),
          pen: 6.5,
          fill: TINT.mint,
          tf: 'rotate(-14 50 55)',
        },
        { t: 'shape', d: circle(50, 50, 27.5), fill: c },
        {
          t: 'glyph',
          d: ring(0),
          pen: 6.5,
          fill: TINT.mint,
          tf: 'rotate(-14 50 55)',
        },
        { t: 'shape', d: circle(83, 17, 5.8), fill: TINT.peach },
      ],
      face: { x: 47, y: 45.5, gap: 18, mw: 8, my: 8 },
      anchors: { head: [46, 20, -10], hand: [80, 80, -30], sky: [16, 18] },
    };
  },
};

const sprout = {
  id: 'sprout',
  name: 'Sprout',
  color: TINT.rose,
  draw: () => {
    const c = TINT.rose;
    return {
      parts: [
        {
          t: 'shape',
          d: smooth([
            [48.5, 37],
            [37, 27],
            [29, 12.5],
            [41, 12],
            [50.5, 26],
          ]),
          fill: TINT.mint,
        },
        {
          t: 'shape',
          d: smooth([
            [51.5, 37],
            [57.5, 22.5],
            [71.5, 12],
            [74, 24],
            [62.5, 34],
          ]),
          fill: TINT.mint,
        },
        ...arms(c, 60, 28, 26),
        {
          t: 'shape',
          d: smooth([
            [50, 33.5],
            [66.5, 37.5],
            [77, 52],
            [73, 68.5],
            [61, 80],
            [50, 93, 1],
            [39, 80],
            [27, 68.5],
            [23, 52],
            [33.5, 37.5],
          ]),
          fill: c,
        },
      ],
      face: { x: 50, y: 55.5, gap: 20 },
      anchors: { head: [50, 26, 0] },
    };
  },
};

const sunny = {
  id: 'sunny',
  name: 'Sunny',
  color: TINT.butter,
  draw: () => {
    const pts = ring(50, 52, 39, 37, 16, -90, (i) => (i % 2 ? 0.74 : 1));
    return {
      parts: [{ t: 'shape', d: smooth(pts, true, 0.7), fill: TINT.butter }],
      face: { x: 50, y: 52, gap: 19 },
      anchors: { head: [50, 14, -6] },
    };
  },
};

const ziggy = {
  id: 'ziggy',
  name: 'Ziggy',
  color: TINT.aqua,
  draw: () => ({
    parts: [
      {
        t: 'shape',
        d: poly([
          [43, 8.5],
          [77, 8.5],
          [62, 38],
          [81, 38],
          [38, 93],
          [47, 57],
          [23, 57],
        ]),
        fill: TINT.aqua,
        w: 1.1,
      },
    ],
    face: { x: 54, y: 24.5, gap: 13.5, mw: 7, my: 7.5 },
    anchors: { head: [60, 3, 8], hand: [80, 72, -30], front: [50, 70, 0] },
  }),
};

const plum = {
  id: 'plum',
  name: 'Plum',
  color: TINT.lilac,
  draw: () => {
    const c = TINT.lilac;
    return {
      parts: [
        ...feet(deep(c, 0.14), 86.5, 11),
        ...arms(c, 62, 31, 24),
        { t: 'line', d: 'M50 30Q50.5 20 55 13', w: 1 },
        {
          t: 'shape',
          d: smooth([
            [55, 17],
            [63, 9],
            [74, 10],
            [68, 18.5],
            [58, 20],
          ]),
          fill: TINT.mint,
          w: 0.85,
        },
        {
          t: 'shape',
          d: smooth([
            [50, 30.5],
            [64, 24.5],
            [79.5, 34.5],
            [83, 55],
            [73, 76],
            [50, 85],
            [27, 76],
            [17, 55],
            [20.5, 34.5],
            [36, 24.5],
          ]),
          fill: c,
        },
        {
          t: 'line',
          d: 'M42 34Q35.5 48 39 62',
          w: 0.7,
          color: deep(c, 0.3),
          soft: true,
          skip: 'small',
        },
      ],
      face: { x: 50, y: 55, gap: 21 },
      anchors: { head: [44, 19, -10] },
    };
  },
};

export default {
  id: 'same-eight',
  name: 'Same Eight',
  range: 'Conservative',
  stance: "Today's eight names and shapes, redrawn as one family.",
  moods: false,
  face: {
    eye: 'bean',
    w: 5.8,
    h: 9.2,
    gap: 20,
    mouth: 'open',
    mw: 11.5,
    my: 9.5,
    cheek: '#FF9DB6',
    cheekR: 4,
    cheekDy: 7.5,
    cheekDx: 2.6,
    cheekOp: 0.8,
    smallEye: 1.28,
  },
  chars: [pip, moss, pebble, orbit, sprout, sunny, ziggy, plum],
};
