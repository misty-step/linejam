// Paper Folk: folded paper faces, as if every player folded their own from the note that
// goes around the room. Flat facets and thin creases instead of a heavy outline; the paper
// itself is light, so the cast reads on the dark page without a sticker edge.
import { TINT, lift, deep, poly, circle, rrect } from '../engine.js';

const crease = (d) => ({
  t: 'line',
  d,
  w: 0.62,
  color: '#39234E',
  op: 0.55,
  soft: true,
  skip: 'small',
});
const shade = (c) => deep(c, 0.13);

const fox = {
  id: 'fox',
  name: 'Fennel',
  color: TINT.peach,
  draw: () => {
    const c = TINT.peach;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [11, 31],
            [20, 8],
            [38, 30],
            [62, 30],
            [80, 8],
            [89, 31],
            [50, 89],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 30],
            [89, 31],
            [50, 89],
          ]),
          fill: shade(c),
        },
        {
          t: 'fill',
          d: poly([
            [17.5, 28.5],
            [21, 15],
            [31.5, 28.5],
          ]),
          fill: shade(c),
          skip: 'small',
        },
        {
          t: 'fill',
          d: poly([
            [68.5, 28.5],
            [79, 15],
            [82.5, 28.5],
          ]),
          fill: deep(c, 0.24),
          skip: 'small',
        },
        {
          t: 'shape',
          d: poly([
            [33, 58],
            [67, 58],
            [50, 89],
          ]),
          fill: TINT.cream,
          w: 0.7,
        },
        crease('M50 30V58'),
        { t: 'dot', d: circle(50, 84, 3.4), fill: 'ink' },
      ],
      face: { x: 50, y: 45, gap: 24 },
      anchors: { head: [50, 22, 0], hand: [82, 78, -30] },
    };
  },
};

const cat = {
  id: 'cat',
  name: 'Mitten',
  color: TINT.butter,
  draw: () => {
    const c = TINT.butter;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [13, 35],
            [17, 11],
            [36, 26],
            [64, 26],
            [83, 11],
            [87, 35],
            [81, 63],
            [50, 87],
            [19, 63],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 26],
            [64, 26],
            [83, 11],
            [87, 35],
            [81, 63],
            [50, 87],
          ]),
          fill: shade(c),
        },
        {
          t: 'fill',
          d: poly([
            [19, 17],
            [32, 26.5],
            [19.5, 30],
          ]),
          fill: TINT.rose,
          skip: 'small',
        },
        {
          t: 'fill',
          d: poly([
            [81, 17],
            [68, 26.5],
            [80.5, 30],
          ]),
          fill: deep(TINT.rose, 0.1),
          skip: 'small',
        },
        crease('M50 26V87'),
        {
          t: 'line',
          d: 'M34 64L20 61M34 68L21 70M66 64L80 61M66 68L79 70',
          w: 0.6,
          color: '#39234E',
          op: 0.6,
          soft: true,
          only: 'large',
        },
        {
          t: 'dot',
          d: poly([
            [45.5, 58],
            [54.5, 58],
            [50, 63.5],
          ]),
          fill: 'ink',
        },
      ],
      face: { x: 50, y: 47, gap: 24 },
      anchors: { head: [50, 20, 0], hand: [82, 78, -30] },
    };
  },
};

const dog = {
  id: 'dog',
  name: 'Biscuit',
  color: TINT.sky,
  draw: () => {
    const c = TINT.sky;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [27, 15],
            [73, 15],
            [77, 61],
            [50, 88],
            [23, 61],
          ]),
          fill: c,
        },
        {
          t: 'shape',
          d: poly([
            [27, 15],
            [7, 25],
            [14, 61],
            [31, 43],
          ]),
          fill: shade(c),
        },
        {
          t: 'shape',
          d: poly([
            [73, 15],
            [93, 25],
            [86, 61],
            [69, 43],
          ]),
          fill: deep(c, 0.2),
        },
        {
          t: 'fill',
          d: poly([
            [36, 60],
            [64, 60],
            [50, 88],
          ]),
          fill: lift(c, 0.55),
        },
        crease('M36 60H64'),
        {
          t: 'dot',
          d: 'M44 64.5H56Q56 71 50 72.5Q44 71 44 64.5Z',
          fill: 'ink',
        },
      ],
      face: { x: 50, y: 42, gap: 20 },
      anchors: { head: [50, 9, 0] },
    };
  },
};

const pig = {
  id: 'pig',
  name: 'Truffle',
  color: TINT.rose,
  draw: () => {
    const c = TINT.rose;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [23, 21],
            [77, 21],
            [88, 44],
            [84, 72],
            [66, 87],
            [34, 87],
            [16, 72],
            [12, 44],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 21],
            [77, 21],
            [88, 44],
            [84, 72],
            [66, 87],
            [50, 87],
          ]),
          fill: shade(c),
        },
        {
          t: 'shape',
          d: poly([
            [23, 21],
            [7, 10],
            [13, 36],
            [27, 38],
          ]),
          fill: deep(c, 0.2),
          w: 0.8,
        },
        {
          t: 'shape',
          d: poly([
            [77, 21],
            [93, 10],
            [87, 36],
            [73, 38],
          ]),
          fill: deep(c, 0.26),
          w: 0.8,
        },
        { t: 'shape', d: rrect(35, 57, 30, 19, 7), fill: lift(c, 0.4), w: 0.8 },
        {
          t: 'dot',
          d: circle(44, 66.5, 2.5) + circle(56, 66.5, 2.5),
          fill: 'ink',
        },
      ],
      face: { x: 50, y: 45, gap: 25 },
      anchors: { head: [50, 13, 0] },
    };
  },
};

const penguin = {
  id: 'penguin',
  name: 'Waddle',
  color: TINT.aqua,
  draw: () => {
    const c = TINT.aqua;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [50, 9],
            [74, 17],
            [87, 40],
            [85, 66],
            [71, 84],
            [50, 91],
            [29, 84],
            [15, 66],
            [13, 40],
            [26, 17],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 9],
            [74, 17],
            [87, 40],
            [85, 66],
            [71, 84],
            [50, 91],
          ]),
          fill: shade(c),
        },
        {
          t: 'shape',
          d: poly([
            [50, 34],
            [64, 25],
            [77, 39],
            [75, 62],
            [61, 78],
            [50, 81],
            [39, 78],
            [25, 62],
            [23, 39],
            [36, 25],
          ]),
          fill: '#FFFFFF',
          w: 0.75,
        },
        {
          t: 'shape',
          d: poly([
            [43.5, 55],
            [56.5, 55],
            [50, 66],
          ]),
          fill: TINT.butter,
          w: 0.75,
        },
      ],
      face: { x: 50, y: 45.5, gap: 21 },
      anchors: { head: [50, 5, 0] },
    };
  },
};

const bear = {
  id: 'bear',
  name: 'Bramble',
  color: TINT.lilac,
  draw: () => {
    const c = TINT.lilac;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [26, 24],
            [13, 15],
            [17, 35],
            [11, 57],
            [26, 80],
            [50, 89],
            [74, 80],
            [89, 57],
            [83, 35],
            [87, 15],
            [74, 24],
            [50, 19],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 19],
            [74, 24],
            [87, 15],
            [83, 35],
            [89, 57],
            [74, 80],
            [50, 89],
          ]),
          fill: shade(c),
        },
        {
          t: 'fill',
          d: poly([
            [17, 19],
            [24, 25.5],
            [18.5, 30],
          ]),
          fill: deep(c, 0.25),
          skip: 'small',
        },
        {
          t: 'fill',
          d: poly([
            [83, 19],
            [76, 25.5],
            [81.5, 30],
          ]),
          fill: deep(c, 0.3),
          skip: 'small',
        },
        {
          t: 'shape',
          d: poly([
            [37, 58],
            [63, 58],
            [59, 74],
            [50, 79],
            [41, 74],
          ]),
          fill: lift(c, 0.55),
          w: 0.75,
        },
        {
          t: 'dot',
          d: poly([
            [45, 61],
            [55, 61],
            [50, 66.5],
          ]),
          fill: 'ink',
        },
      ],
      face: { x: 50, y: 45, gap: 26 },
      anchors: { head: [50, 13, 0] },
    };
  },
};

const mouse = {
  id: 'mouse',
  name: 'Crumb',
  color: TINT.cream,
  draw: () => {
    const c = TINT.cream;
    const ear = [
      [27, 41],
      [7, 25],
      [9, 9],
      [29, 13],
      [41, 38],
    ];
    return {
      parts: [
        { t: 'shape', d: poly(ear), fill: deep(c, 0.08) },
        {
          t: 'shape',
          d: poly(ear.map(([x, y]) => [100 - x, y])),
          fill: deep(c, 0.14),
        },
        {
          t: 'fill',
          d: poly([
            [25, 34],
            [13, 23],
            [15, 14],
            [27, 17],
            [34, 33],
          ]),
          fill: TINT.rose,
          skip: 'small',
        },
        {
          t: 'fill',
          d: poly([
            [75, 34],
            [87, 23],
            [85, 14],
            [73, 17],
            [66, 33],
          ]),
          fill: deep(TINT.rose, 0.08),
          skip: 'small',
        },
        {
          t: 'shape',
          d: poly([
            [25, 38],
            [75, 38],
            [50, 90],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 38],
            [75, 38],
            [50, 90],
          ]),
          fill: shade(c),
        },
        { t: 'dot', d: circle(50, 85, 3.3), fill: 'ink' },
      ],
      face: { x: 50, y: 53, gap: 20 },
      anchors: { head: [50, 30, 0] },
    };
  },
};

const rabbit = {
  id: 'rabbit',
  name: 'Thistle',
  color: TINT.mint,
  draw: () => {
    const c = TINT.mint;
    return {
      parts: [
        {
          t: 'shape',
          d: poly([
            [40, 46],
            [29, 5],
            [46, 8],
            [51, 41],
          ]),
          fill: c,
        },
        {
          t: 'shape',
          d: poly([
            [49, 41],
            [54, 8],
            [71, 5],
            [60, 46],
          ]),
          fill: shade(c),
        },
        {
          t: 'fill',
          d: poly([
            [40, 38],
            [33, 11.5],
            [42.5, 13],
            [46, 38],
          ]),
          fill: TINT.rose,
          skip: 'small',
        },
        {
          t: 'shape',
          d: poly([
            [50, 38],
            [83, 58],
            [50, 91],
            [17, 58],
          ]),
          fill: c,
        },
        {
          t: 'fill',
          d: poly([
            [50, 38],
            [83, 58],
            [50, 91],
          ]),
          fill: shade(c),
        },
        {
          t: 'dot',
          d: poly([
            [46, 68],
            [54, 68],
            [50, 72.5],
          ]),
          fill: 'ink',
        },
      ],
      face: { x: 50, y: 58.5, gap: 19 },
      anchors: { head: [50, 30, 0], sky: [86, 20] },
    };
  },
};

export default {
  id: 'paper-folk',
  name: 'Paper Folk',
  range: 'Radical',
  stance:
    'Folded paper faces, as if each player folded one from the note going around.',
  moods: false,
  edge: false,
  inkScale: 0.66,
  face: {
    eye: 'dot',
    w: 6.4,
    h: 6.4,
    gap: 22,
    mouth: 'none',
    cheek: null,
    shine: false,
    smallEye: 1.25,
  },
  chars: [fox, cat, dog, pig, penguin, bear, mouse, rabbit],
};
