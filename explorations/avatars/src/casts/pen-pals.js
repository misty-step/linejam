// Pen Pals: the refined cast. Spine: Small Hours (one body, one face, six moods). Grafts: Same
// Eight craft rules, a writerly voice and one chunky pen from Marks, paper props from Paper
// Folk, and a palette that never reuses a status color (the Kitchen Table lesson).
// Revised from pen-pals-v1.js after the size, lamp and resemblance checks; see critique.js.
import {
  TINT,
  lift,
  deep,
  mix,
  circle,
  ellipse,
  smooth,
  rrect,
  scallop,
  mirror,
} from '../engine.js';

const PAL = {
  lilac: TINT.lilac,
  luna: '#A6E6D9',
  coral: '#FFA497',
  sand: '#FFD97F',
  pistachio: TINT.pistachio,
  sky: TINT.sky,
  cream: TINT.cream,
  orchid: '#F4B8E6',
};

const feet = (fill, y = 87.5, dx = 10.5) => [
  { t: 'shape', d: ellipse(50 - dx, y, 7.2, 4.6), fill },
  { t: 'shape', d: ellipse(50 + dx, y, 7.2, 4.6), fill },
];
export function bean(left = 19, right = 81, top = 27, bottom = 88) {
  const cx = (left + right) / 2;
  const w = right - left;
  const h = bottom - top;
  return smooth([
    [cx, top],
    [cx + w * 0.34, top + h * 0.07],
    [right - w * 0.015, top + h * 0.33],
    [right, top + h * 0.62],
    [cx + w * 0.37, top + h * 0.9],
    [cx + w * 0.15, bottom],
    [cx - w * 0.15, bottom],
    [cx - w * 0.37, top + h * 0.9],
    [left, top + h * 0.62],
    [left + w * 0.015, top + h * 0.33],
    [cx - w * 0.34, top + h * 0.07],
  ]);
}

const quill = {
  id: 'quill',
  name: 'Quill',
  color: PAL.lilac,
  line: 'Stays up for the last line.',
  draw: () => {
    const c = PAL.lilac;
    return {
      parts: [
        ...feet(PAL.sand, 88.5, 10),
        {
          t: 'shape',
          d: smooth([
            [50, 31],
            [61, 29.5],
            [70.5, 13.5, 1],
            [77.5, 31],
            [83, 47],
            [83, 64],
            [76, 80],
            [62, 88.5],
            [38, 88.5],
            [24, 80],
            [17, 64],
            [17, 47],
            [22.5, 31],
            [29.5, 13.5, 1],
            [39, 29.5],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: circle(39, 53, 13.5) + circle(61, 53, 13.5),
          fill: lift(c, 0.62),
        },
        {
          t: 'line',
          d: 'M22 60Q26 74 36.5 80M78 60Q74 74 63.5 80',
          w: 0.72,
          color: deep(c, 0.32),
          soft: true,
          skip: 'small',
        },
        {
          t: 'line',
          d: 'M44.5 74l2.8 2.8l2.8-2.8M50.2 79l2.8 2.8l2.8-2.8',
          w: 0.6,
          color: deep(c, 0.32),
          soft: true,
          only: 'large',
        },
        {
          t: 'shape',
          d: 'M45.2 58.4Q50 57.2 54.8 58.4L50 66Z',
          fill: PAL.sand,
          w: 0.72,
        },
      ],
      face: {
        x: 50,
        y: 52.5,
        gap: 22,
        noMouth: true,
        cheekDy: 9.5,
        cheekDx: 2.4,
      },
      anchors: { head: [50, 24, -4] },
    };
  },
};

const dusk = {
  id: 'dusk',
  name: 'Dusk',
  color: PAL.luna,
  line: 'Finds the brightest phone in the room.',
  draw: (k) => {
    const c = PAL.luna;
    const wing = lift(c, 0.4);
    const upper = [
      [37, 44],
      [27, 30],
      [12, 25],
      [4.5, 34],
      [6, 51],
      [15, 61],
      [31, 61],
    ];
    const lower = [
      [34, 62],
      [22, 67],
      [17, 79],
      [24, 85],
      [37, 76],
    ];
    return {
      parts: [
        { t: 'shape', d: smooth(lower), fill: wing, skip: 'small' },
        { t: 'shape', d: smooth(mirror(lower)), fill: wing, skip: 'small' },
        { t: 'shape', d: smooth(upper), fill: wing },
        { t: 'shape', d: smooth(mirror(upper)), fill: wing },
        {
          t: 'shape',
          d: circle(17.5, 42, 5.2) + circle(82.5, 42, 5.2),
          fill: PAL.sand,
          w: 0.7,
          skip: 'small',
        },
        {
          t: 'line',
          d: 'M44.5 31Q39.5 18 27 11M55.5 31Q60.5 18 73 11',
          w: k.small ? 1.1 : 1,
        },
        {
          t: 'shape',
          d: ellipse(26, 10.5, 6.2, 3.8),
          fill: c,
          w: 0.8,
          tf: 'rotate(-26 26 10.5)',
        },
        {
          t: 'shape',
          d: ellipse(74, 10.5, 6.2, 3.8),
          fill: c,
          w: 0.8,
          tf: 'rotate(26 74 10.5)',
        },
        ...feet(deep(c, 0.14), 87.5, 9),
        { t: 'shape', d: bean(27, 73, 29, 88), fill: c },
        {
          t: 'fill',
          d: scallop(50, 77, 12.5, 8, 7, 0.6),
          fill: lift(c, 0.6),
          skip: 'small',
        },
      ],
      face: { x: 50, y: 54, gap: 18.5, cheekDx: 1.6 },
      anchors: { head: [50, 24, -6] },
    };
  },
};

const doodle = {
  id: 'doodle',
  name: 'Doodle',
  color: PAL.sand,
  line: 'Takes the long way to five words.',
  draw: (k) => {
    const shell = PAL.sand;
    const body = PAL.cream;
    const spiral = k.small
      ? smooth(
          [
            [66, 50],
            [70, 46],
            [72, 55],
            [63, 60],
            [57, 50],
            [64, 40],
            [77, 44],
            [80, 57],
          ],
          false
        )
      : smooth(
          [
            [66.5, 50.5],
            [69, 48],
            [69.5, 54],
            [63.5, 56.5],
            [59, 50],
            [63, 42.5],
            [73, 42.5],
            [78.5, 52],
            [75, 63],
            [64, 68],
            [53, 62],
          ],
          false
        );
    return {
      parts: [
        { t: 'shape', d: circle(66, 50, 24), fill: shell },
        { t: 'line', d: spiral, w: k.small ? 0.8 : 0.72 },
        {
          t: 'line',
          d: 'M22 45Q17.5 33 14 27M34 44Q36.5 32 40 26',
          w: k.small ? 1.1 : 1,
        },
        { t: 'shape', d: circle(14, 26, 3.8), fill: body, w: 0.8 },
        { t: 'shape', d: circle(40, 25.5, 3.8), fill: body, w: 0.8 },
        {
          t: 'shape',
          d: smooth([
            [28, 41],
            [39, 43.5],
            [46, 54],
            [48.5, 68],
            [58, 74.5],
            [80, 74],
            [91, 78],
            [92.5, 86],
            [84, 90],
            [40, 90.5],
            [18, 88.5],
            [10, 79],
            [9.5, 57],
            [16.5, 45],
          ]),
          fill: body,
        },
      ],
      face: { x: 28.5, y: 61, gap: 18.5, cheekDx: 1.2, mw: 8 },
      anchors: { head: [28, 36, -12], hand: [84, 80, -24], sky: [88, 14] },
    };
  },
};

const rhyme = {
  id: 'rhyme',
  name: 'Rhyme',
  color: PAL.coral,
  line: 'Has a rhyme ready. Keeps it quiet.',
  draw: (k) => {
    const c = PAL.coral;
    // Small sizes get a bigger, higher tail: it is the cue that separates the fox from the owl.
    const tail = k.small
      ? smooth([
          [68, 80],
          [86, 73],
          [97, 55],
          [97.5, 35],
          [89, 22],
          [84, 40],
          [79, 58],
          [70, 69],
        ])
      : smooth([
          [70, 79],
          [84.5, 72],
          [94, 56],
          [93.5, 40.5],
          [87, 32.5],
          [84, 46],
          [79.5, 61],
          [71, 70],
        ]);
    const tip = k.small
      ? smooth([
          [89, 22],
          [97.5, 35],
          [98, 45],
          [90.5, 42],
          [86, 33],
        ])
      : smooth([
          [87, 32.5],
          [93.5, 40.5],
          [94.2, 48.5],
          [88.5, 47],
          [85, 40.5],
        ]);
    const body = smooth([
      [50, 34],
      [60, 32.5],
      [69, 25],
      [76.5, 9.5, 1],
      [80.5, 30],
      [82, 46],
      [81.5, 63],
      [75, 79],
      [61, 88],
      [39, 88],
      [25, 79],
      [18.5, 63],
      [18, 46],
      [19.5, 30],
      [23.5, 9.5, 1],
      [31, 25],
      [40, 32.5],
    ]);
    const mask = smooth([
      [19, 57],
      [31, 64.5],
      [43, 68],
      [50, 66],
      [57, 68],
      [69, 64.5],
      [81, 57],
      [80.5, 71],
      [72, 83],
      [50, 88],
      [28, 83],
      [19.5, 71],
    ]);
    return {
      parts: [
        { t: 'shape', d: tail, fill: c },
        { t: 'fill', d: tip, fill: '#FFF8EA' },
        ...feet(deep(c, 0.16), 87.5, 10),
        { t: 'shape', d: body, fill: c },
        {
          t: 'fill',
          d: 'M25 17L30 27L22.5 28.5Z',
          fill: '#FFF8EA',
          skip: 'small',
        },
        {
          t: 'fill',
          d: 'M75 17L70 27L77.5 28.5Z',
          fill: '#FFF8EA',
          skip: 'small',
        },
        { t: 'fill', d: mask, fill: '#FFF8EA' },
        { t: 'dot', d: ellipse(50, 61.2, 3, 2.2), fill: 'ink' },
      ],
      face: {
        x: 50,
        y: 51.5,
        gap: 22,
        mouth: 'cat',
        my: 13,
        mw: 10,
        cheek: false,
      },
      anchors: { head: [50, 26, -4] },
    };
  },
};

const haiku = {
  id: 'haiku',
  name: 'Haiku',
  color: PAL.pistachio,
  line: 'Leaps to the next line.',
  draw: (k) => {
    const c = PAL.pistachio;
    return {
      parts: [
        // Small sizes get bigger eye domes: they are the frog's silhouette.
        {
          t: 'shape',
          d: k.small ? circle(32, 35, 15) : circle(33.5, 37, 12.6),
          fill: c,
        },
        {
          t: 'shape',
          d: k.small ? circle(68, 35, 15) : circle(66.5, 37, 12.6),
          fill: c,
        },
        ...feet(deep(c, 0.1), 87.5, 12),
        {
          t: 'shape',
          d: smooth([
            [50, 42],
            [68, 41],
            [82.5, 52],
            [85.5, 68],
            [76.5, 83],
            [58, 89],
            [42, 89],
            [23.5, 83],
            [14.5, 68],
            [17.5, 52],
            [32, 41],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: ellipse(50, 77, 18, 9.5),
          fill: lift(c, 0.55),
          skip: 'small',
        },
      ],
      face: {
        x: 50,
        y: 36.5,
        gap: 33,
        mw: 20,
        my: 21,
        cheekDy: 22,
        cheekDx: -3,
        cheekR: 4.6,
      },
      anchors: { head: [50, 29, 0], sky: [88, 16] },
    };
  },
};

const hush = {
  id: 'hush',
  name: 'Hush',
  color: PAL.sky,
  line: 'Listens with both ears.',
  draw: () => {
    const c = PAL.sky;
    return {
      parts: [
        {
          t: 'shape',
          d: smooth([
            [37, 34],
            [31, 20],
            [31.5, 7],
            [37.5, 2.5],
            [43.5, 8.5],
            [45, 22],
            [46, 32],
          ]),
          fill: c,
        },
        {
          t: 'shape',
          d: smooth([
            [55, 32],
            [60.5, 20],
            [70, 12],
            [80.5, 12.5],
            [82, 19.5],
            [74, 26],
            [62, 34],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: smooth([
            [37.8, 28],
            [35.2, 17],
            [36.4, 8.8],
            [39.4, 8.2],
            [41.2, 16.5],
            [42.2, 27],
          ]),
          fill: lift(TINT.rose, 0.1),
          skip: 'small',
        },
        {
          t: 'fill',
          d: smooth([
            [60.5, 27],
            [66, 19.5],
            [74, 16.5],
            [77.5, 18.3],
            [71.5, 23],
            [63.5, 29.5],
          ]),
          fill: lift(TINT.rose, 0.1),
          skip: 'small',
        },
        ...feet(deep(c, 0.1)),
        { t: 'shape', d: bean(19, 81, 28, 88), fill: c },
        {
          t: 'shape',
          d: 'M47.3 60.2Q50 59.3 52.7 60.2L50 63.4Z',
          fill: TINT.rose,
          w: 0.55,
        },
      ],
      face: {
        x: 50,
        y: 54,
        gap: 21,
        mouth: 'cat',
        my: 11,
        mw: 9,
        cheekDy: 7.5,
        cheekDx: 2.6,
      },
      anchors: { head: [50, 31, -4], sky: [90, 30] },
    };
  },
};

const sonnet = {
  id: 'sonnet',
  name: 'Sonnet',
  color: PAL.cream,
  line: 'Counts syllables, not sheep.',
  draw: (k) => {
    const wool = PAL.cream;
    const face = lift(PAL.lilac, 0.28);
    const hoof = deep(PAL.lilac, 0.34);
    return {
      parts: [
        { t: 'shape', d: rrect(37.5, 80, 8.5, 10, 3.6), fill: hoof },
        { t: 'shape', d: rrect(54, 80, 8.5, 10, 3.6), fill: hoof },
        {
          t: 'shape',
          d: ellipse(18.5, 50, 8.6, 4.6),
          fill: face,
          tf: 'rotate(-24 18.5 50)',
        },
        {
          t: 'shape',
          d: ellipse(81.5, 50, 8.6, 4.6),
          fill: face,
          tf: 'rotate(24 81.5 50)',
        },
        {
          t: 'shape',
          d: scallop(50, 55, 31, 28.5, k.small ? 8 : 11, 0.56),
          fill: wool,
        },
        {
          t: 'shape',
          d: smooth([
            [50, 44],
            [62, 47],
            [67, 58],
            [63, 71],
            [50, 76],
            [37, 71],
            [33, 58],
            [38, 47],
          ]),
          fill: face,
          w: 0.85,
        },
        {
          t: 'shape',
          d: scallop(50, 43.5, 11.5, 5.2, 5, 0.6, 180),
          fill: wool,
          w: 0.85,
          skip: 'small',
        },
      ],
      face: {
        x: 50,
        y: 57,
        gap: 17.5,
        mw: 8,
        my: 9,
        cheekDx: 0.8,
        cheekR: 3.4,
      },
      anchors: { head: [50, 22, -8] },
    };
  },
};

const ode = {
  id: 'ode',
  name: 'Ode',
  color: PAL.orchid,
  line: 'Smiles through every round.',
  draw: (k) => {
    const c = PAL.orchid;
    const gill = mix(PAL.orchid, '#D65DB8', 0.45);
    // Small sizes get two big frills per side: the gills are the axolotl's silhouette.
    const lobes = k.small
      ? [
          [10, 37, 34],
          [10, 58, -34],
        ]
      : [
          [13.5, 35.5, 38],
          [10, 48, 0],
          [13.5, 60.5, -38],
        ];
    const parts = [];
    for (const [x, y, r] of lobes) {
      parts.push({
        t: 'shape',
        d: ellipse(x, y, k.small ? 11.5 : 8.4, k.small ? 6 : 4.2),
        fill: gill,
        tf: `rotate(${r} ${x} ${y})`,
        w: 0.85,
      });
      parts.push({
        t: 'shape',
        d: ellipse(100 - x, y, k.small ? 11.5 : 8.4, k.small ? 6 : 4.2),
        fill: gill,
        tf: `rotate(${-r} ${100 - x} ${y})`,
        w: 0.85,
      });
    }
    parts.push(...feet(deep(c, 0.08)));
    parts.push({
      t: 'shape',
      d: smooth([
        [50, 30],
        [70, 32.5],
        [81, 45],
        [80.5, 64],
        [72, 80],
        [58, 88],
        [42, 88],
        [28, 80],
        [19.5, 64],
        [19, 45],
        [30, 32.5],
      ]),
      fill: c,
    });
    return {
      parts,
      face: {
        x: 50,
        y: 53,
        gap: 27,
        mw: 15,
        my: 9.5,
        cheekDx: 1.5,
        cheekColor: gill,
      },
      anchors: { head: [50, 24, -6] },
    };
  },
};

export default {
  id: 'pen-pals',
  name: 'Pen Pals',
  range: 'Refined',
  stance:
    "Eight small-hours creatures with a writer's streak: one body, one face, six moods.",
  face: {
    eye: 'oval',
    w: 6.6,
    h: 8.8,
    gap: 21,
    mouth: 'smile',
    mw: 9,
    my: 9.5,
    cheek: '#FF9DB6',
    cheekR: 4.2,
    cheekDy: 7,
    cheekOp: 0.85,
    smallEye: 1.34,
  },
  chars: [quill, dusk, doodle, rhyme, haiku, hush, sonnet, ode],
};
