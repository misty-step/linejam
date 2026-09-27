// Linejam cast engine: one renderer for every direction, so each board shows the same
// optical sizing, sticker edge, faces and props at true CSS sizes. Output is static SVG.

export const INK = '#39234E';
export const PAPER = '#FFFFFF';

// Character tints. Mid-light so plum ink reads on them and they lift off both pages.
export const TINT = {
  mint: '#A9EBC8',
  sky: '#A8D1FF',
  lilac: '#CBB5FF',
  rose: '#FFB3C6',
  peach: '#FFB887',
  butter: '#FFDC78',
  pistachio: '#CFE59C',
  aqua: '#9FE3E3',
  cream: '#FFF4E2',
};

export const MODE = {
  light: {
    page: '#eee8ff',
    surface: '#ffffff',
    muted: '#e5dbf5',
    text: '#39234e',
    text2: '#665074',
    edge: '#ffffff',
    lamp: '#f8ccb9',
  },
  dark: {
    page: '#23172f',
    surface: '#33223f',
    muted: '#412d50',
    text: '#f7f1ff',
    text2: '#d8c9e2',
    edge: '#f4ecff',
    lamp: '#edab80',
  },
};

/* ---------- color ---------- */
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
export function mix(a, b, t) {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
export const lift = (c, t = 0.5) => mix(c, '#FFFFFF', t);
/** WCAG 2 contrast ratio between two hex colors. */
export function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = hex(c).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const deep = (c, t = 0.18) => mix(c, INK, t);

/* ---------- geometry ---------- */
export const f = (n) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

export function circle(cx, cy, r) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}
export function ellipse(cx, cy, rx, ry) {
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
}
export function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}
export function poly(pts, closed = true) {
  return 'M' + pts.map(pt).join('L') + (closed ? 'Z' : '');
}
/** Catmull-Rom through points. A point written [x, y, 1] is a sharp corner. */
export function smooth(pts, closed = true, tension = 1) {
  const n = pts.length;
  const P = (i) =>
    closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1 = p1[2]
      ? p1
      : [
          p1[0] + ((p2[0] - p0[0]) * tension) / 6,
          p1[1] + ((p2[1] - p0[1]) * tension) / 6,
        ];
    const c2 = p2[2]
      ? p2
      : [
          p2[0] - ((p3[0] - p1[0]) * tension) / 6,
          p2[1] - ((p3[1] - p1[1]) * tension) / 6,
        ];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
export const mirror = (pts, axis = 50) =>
  pts.map((p) => [2 * axis - p[0], p[1], p[2]]);
export function rot(pts, deg, cx = 50, cy = 50) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map((p) => [
    cx + (p[0] - cx) * c - (p[1] - cy) * s,
    cy + (p[0] - cx) * s + (p[1] - cy) * c,
    p[2],
  ]);
}
export const move = (pts, dx, dy) =>
  pts.map((p) => [p[0] + dx, p[1] + dy, p[2]]);
export const scale = (pts, s, cx = 50, cy = 50) =>
  pts.map((p) => [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s, p[2]]);
/** Points around an ellipse, for bodies that need a few nudged vertices. */
export function ring(cx, cy, rx, ry, n, start = -90, jitter = null) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((start + (360 * i) / n) * Math.PI) / 180;
    const j = jitter ? jitter(i) : 1;
    out.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  return out;
}

/* ---------- optical sizing ---------- */
// Stroke and edge widths in CSS px by rendered size; small sizes get relatively heavier ink.
const INK_PX = [
  [24, 1.7],
  [32, 2.0],
  [44, 2.3],
  [56, 2.55],
  [72, 2.85],
  [96, 3.25],
  [128, 3.7],
  [160, 4.1],
];
const EDGE_PX = {
  light: [
    [24, 1.1],
    [32, 1.3],
    [44, 1.6],
    [56, 1.8],
    [72, 2.1],
    [96, 2.5],
    [128, 2.9],
    [160, 3.3],
  ],
  dark: [
    [24, 1.3],
    [32, 1.55],
    [44, 1.9],
    [56, 2.15],
    [72, 2.5],
    [96, 3.0],
    [128, 3.5],
    [160, 3.9],
  ],
};
function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return table[table.length - 1][1];
}
export const variantFor = (size) =>
  size <= 32 ? 'small' : size >= 96 ? 'large' : 'regular';
export function sizing(size, mode = 'light') {
  const u = 100 / size;
  return {
    ink: interp(INK_PX, size) * u,
    edge: interp(EDGE_PX[mode], size) * u,
    v: variantFor(size),
  };
}

/* ---------- parts ---------- */
// shape: filled, inked outline. fill: flat patch, no outline. line: open stroke (w = ink multiple).
// glyph: monoline stroke built from a wide ink pass under a fill pass (pen = fill width).
const ROUND = 'stroke-linecap="round" stroke-linejoin="round"';

function partEdge(p, k, edgeColor) {
  if (p.edge === false || !k.edge) return '';
  const tf = p.tf ? ` transform="${p.tf}"` : '';
  const e2 = 2 * k.edge;
  switch (p.t) {
    case 'shape':
      return `<path d="${p.d}" fill="${edgeColor}" stroke="${edgeColor}" stroke-width="${f(k.ink * (p.w ?? 1) + e2)}"${tf}/>`;
    case 'line':
      return `<path d="${p.d}" fill="none" stroke="${edgeColor}" stroke-width="${f(k.ink * (p.w ?? 1) + e2)}"${tf}/>`;
    case 'glyph': {
      const ds = [].concat(p.d);
      return ds
        .map(
          (d) =>
            `<path d="${d}" fill="none" stroke="${edgeColor}" stroke-width="${f(p.pen + 2 * k.ink + e2)}"${tf}/>`
        )
        .join('');
    }
    case 'dot':
      return `<path d="${p.d}" fill="${edgeColor}" stroke="${edgeColor}" stroke-width="${f(k.ink + e2)}"${tf}/>`;
    case 'union': {
      const w = [];
      for (const it of p.items)
        w.push(
          it.pen
            ? `<path d="${it.d}" fill="none" stroke="${edgeColor}" stroke-width="${f(it.pen + 2 * k.ink + e2)}"/>`
            : `<path d="${it.d}" fill="${edgeColor}" stroke="${edgeColor}" stroke-width="${f(2 * k.ink + e2)}"/>`
        );
      return `<g${tf}>${w.join('')}</g>`;
    }
    default:
      return '';
  }
}

/** A cloud or wool outline: round bumps on an ellipse (r is the bump radius per chord). */
export function scallop(cx, cy, rx, ry, n, bulge = 0.56, start = -90) {
  const pts = ring(cx, cy, rx, ry, n, start);
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]) * bulge;
    d += `A${f(r)} ${f(r)} 0 0 1 ${pt(b)}`;
  }
  return d + 'Z';
}

function partArt(p, k, o) {
  const tf = p.tf ? ` transform="${p.tf}"` : '';
  const ink = o.outlined ? 'currentColor' : INK;
  const fill = (c) => (o.outlined ? o.hollow : c);
  const op = p.op != null ? ` opacity="${p.op}"` : '';
  switch (p.t) {
    case 'shape':
      return `<path d="${p.d}" fill="${fill(p.fill)}" stroke="${p.ink === false ? 'none' : ink}" stroke-width="${f(k.ink * (p.w ?? 1))}"${tf}${op}/>`;
    case 'fill':
      if (o.outlined && !p.keep) return '';
      return `<path d="${p.d}" fill="${o.outlined ? ink : p.fill === 'ink' ? INK : p.fill}" stroke="none"${tf}${op}/>`;
    case 'dot':
      return `<path d="${p.d}" fill="${o.outlined ? ink : p.fill === 'ink' ? INK : p.fill}" stroke="none"${tf}${op}/>`;
    case 'line': {
      const color = o.outlined ? ink : (p.color ?? INK);
      if (o.outlined && p.soft) return '';
      return `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${f(k.ink * (p.w ?? 1))}"${tf}${op}/>`;
    }
    case 'glyph': {
      const ds = [].concat(p.d);
      const under = ds
        .map(
          (d) =>
            `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f(p.pen + 2 * k.ink)}"/>`
        )
        .join('');
      const over = ds
        .map(
          (d) =>
            `<path d="${d}" fill="none" stroke="${fill(p.fill)}" stroke-width="${f(p.pen)}"/>`
        )
        .join('');
      return `<g${tf}>${under}${over}</g>`;
    }
    case 'union': {
      // One outline around shapes and pen strokes: the whole ink pass, then the whole fill pass.
      const under = p.items
        .map((it) =>
          it.pen
            ? `<path d="${it.d}" fill="none" stroke="${ink}" stroke-width="${f(it.pen + 2 * k.ink)}"/>`
            : `<path d="${it.d}" fill="${ink}" stroke="${ink}" stroke-width="${f(2 * k.ink)}"/>`
        )
        .join('');
      const over = p.items
        .map((it) =>
          it.pen
            ? `<path d="${it.d}" fill="none" stroke="${fill(it.fill ?? p.fill)}" stroke-width="${f(it.pen)}"/>`
            : `<path d="${it.d}" fill="${fill(it.fill ?? p.fill)}" stroke="none"/>`
        )
        .join('');
      return `<g${tf}>${under}${over}</g>`;
    }
    case 'raw':
      return o.outlined && p.soft ? '' : p.svg;
    default:
      return '';
  }
}

const visible = (p, k) =>
  !(
    p.only &&
    p.only !== k.v &&
    !(Array.isArray(p.only) && p.only.includes(k.v))
  ) && !(p.skip && [].concat(p.skip).includes(k.v));

/* ---------- faces ---------- */
// One face per direction; moods change eyes and mouth only, so the family stays one family.
export const MOODS = [
  'idle',
  'writing',
  'tucked',
  'away',
  'reading',
  'watching',
];

function eyePath(style, x, y, w, h) {
  if (style === 'dot') return circle(x, y, Math.max(w, h) / 2);
  if (style === 'bean') return rrect(x - w / 2, y - h / 2, w, h, w / 2);
  return ellipse(x, y, w / 2, h / 2);
}

/**
 * The face as structured parts in face-local coordinates. `ink` fills follow the ink color;
 * `soft` parts (cheeks, tongue, eye shine) are dropped for outlined spectators; `weight` is a
 * multiple of the ink width. renderFace serializes these; the product exporter reuses them.
 */
export function faceParts(style, spec, k) {
  const mood = k.mood;
  const small = k.small;
  const es = small
    ? (style.smallEye ?? 1.3)
    : k.large
      ? (style.largeEye ?? 1)
      : 1;
  const w = (spec.w ?? style.w) * es;
  const h = (spec.h ?? style.h) * es;
  const gap = (spec.gap ?? style.gap) * (small ? (style.smallGap ?? 1.08) : 1);
  const mw = (spec.mw ?? style.mw) * (small ? 1.1 : 1);
  const my = (spec.my ?? style.my) * (small ? 1.06 : 1);
  const lw = small ? 0.78 : 0.86;
  const [lx, ly] = spec.look ?? [0, 0];
  let look = [lx, ly];
  if (mood === 'writing') look = [w * 0.28, h * 0.3];
  if (mood === 'reading') look = [0, h * 0.34];
  if (mood === 'watching') look = [w * 0.34, 0];
  const eyes = [-gap / 2, gap / 2].map((dx) => [dx + look[0], look[1]]);
  const parts = [];
  const closed = mood === 'tucked' || mood === 'away';
  if (!closed) {
    for (const [ex, ey] of eyes)
      parts.push({
        t: 'dot',
        d: eyePath(style.eye, ex, ey, w, h),
        fill: 'ink',
      });
    if (k.large && style.shine !== false) {
      for (const [ex, ey] of eyes)
        parts.push({
          t: 'fill',
          d: circle(ex - w * 0.16, ey - h * 0.2, Math.max(1.1, w * 0.2)),
          fill: '#FFFFFF',
          soft: true,
        });
    }
  } else if (mood === 'tucked') {
    const aw = w * 0.72;
    for (const [ex, ey] of eyes)
      parts.push({
        t: 'line',
        d: `M${f(ex - aw)} ${f(ey + h * 0.18)}Q${f(ex)} ${f(ey - h * 0.62)} ${f(ex + aw)} ${f(ey + h * 0.18)}`,
        w: lw,
      });
  } else {
    const aw = w * 0.74;
    for (const [ex, ey] of eyes)
      parts.push({
        t: 'line',
        d: `M${f(ex - aw)} ${f(ey - h * 0.02)}Q${f(ex)} ${f(ey + h * 0.5)} ${f(ex + aw)} ${f(ey - h * 0.02)}`,
        w: lw,
      });
  }
  if (style.cheek && !small && spec.cheek !== false) {
    const cr = spec.cheekR ?? style.cheekR ?? 4;
    const cx = gap / 2 + (spec.cheekDx ?? style.cheekDx ?? w * 0.9);
    const cy = spec.cheekDy ?? style.cheekDy ?? h * 0.62;
    const cc = spec.cheekColor ?? style.cheek;
    parts.push({
      t: 'fill',
      d: ellipse(-cx, cy, cr, cr * 0.7) + ellipse(cx, cy, cr, cr * 0.7),
      fill: cc,
      op: style.cheekOp ?? 0.9,
      soft: true,
    });
  }
  const mouth = spec.mouth ?? style.mouth;
  const tongue = style.tongue ?? '#FF8FA8';
  if (
    !spec.noMouth &&
    (mouth !== 'none' || mood === 'reading' || mood === 'tucked')
  ) {
    const mx = look[0] * 0.4;
    const myy = my + look[1] * 0.25;
    if (mood === 'reading') {
      const rx = mw * 0.3;
      const ry = mw * 0.36;
      parts.push({
        t: 'dot',
        d: ellipse(mx, myy + ry * 0.4, rx, ry),
        fill: 'ink',
      });
      if (k.large)
        parts.push({
          t: 'fill',
          d: ellipse(mx, myy + ry * 0.95, rx * 0.62, ry * 0.36),
          fill: tongue,
          soft: true,
        });
    } else if (mood === 'tucked') {
      const a = mw * 0.56;
      parts.push({
        t: 'shape',
        d: `M${f(mx - a)} ${f(myy - 0.4)}Q${f(mx)} ${f(myy + a * 1.35)} ${f(mx + a)} ${f(myy - 0.4)}Z`,
        fill: 'ink',
        w: lw * 0.6,
      });
      if (!small)
        parts.push({
          t: 'fill',
          d: ellipse(mx, myy + a * 0.45, a * 0.46, a * 0.2),
          fill: tongue,
          soft: true,
        });
    } else if (mood === 'away') {
      parts.push({
        t: 'dot',
        d: ellipse(mx, myy + 1, mw * 0.16, mw * 0.2),
        fill: 'ink',
      });
    } else if (mood === 'writing') {
      parts.push({
        t: 'line',
        d: `M${f(mx - mw * 0.28)} ${f(myy + 1)}Q${f(mx + mw * 0.05)} ${f(myy + 2.4)} ${f(mx + mw * 0.34)} ${f(myy + 0.4)}`,
        w: lw,
      });
      if (!small)
        parts.push({
          t: 'shape',
          d: ellipse(mx + mw * 0.3, myy + 2.6, mw * 0.14, mw * 0.2),
          fill: tongue,
          w: lw * 0.55,
          soft: true,
        });
    } else if (mood === 'watching' || mouth === 'small') {
      parts.push({
        t: 'line',
        d: `M${f(mx - mw * 0.22)} ${f(myy + 1)}H${f(mx + mw * 0.22)}`,
        w: lw,
      });
    } else if (mouth === 'cat') {
      const a = mw * 0.26;
      parts.push({
        t: 'line',
        d: `M${f(mx - 2 * a)} ${f(myy)}Q${f(mx - a)} ${f(myy + a * 1.3)} ${f(mx)} ${f(myy)}Q${f(mx + a)} ${f(myy + a * 1.3)} ${f(mx + 2 * a)} ${f(myy)}`,
        w: lw,
      });
    } else if (mouth === 'open') {
      const a = mw * 0.5;
      parts.push({
        t: 'shape',
        d: `M${f(mx - a)} ${f(myy - 0.3)}Q${f(mx)} ${f(myy + a * 1.45)} ${f(mx + a)} ${f(myy - 0.3)}Z`,
        fill: 'ink',
        w: lw * 0.6,
      });
      if (!small)
        parts.push({
          t: 'fill',
          d: ellipse(mx + a * 0.1, myy + a * 0.47, a * 0.42, a * 0.2),
          fill: tongue,
          soft: true,
        });
    } else {
      const a = mw / 2;
      parts.push({
        t: 'line',
        d: `M${f(mx - a)} ${f(myy)}Q${f(mx)} ${f(myy + a * 0.8)} ${f(mx + a)} ${f(myy)}`,
        w: lw,
      });
    }
  }
  const s = spec.s ?? 1;
  const r = spec.rot ?? 0;
  return {
    tf: `translate(${f(spec.x)} ${f(spec.y)})${r ? ` rotate(${r})` : ''}${s !== 1 ? ` scale(${f(s)})` : ''}`,
    parts,
  };
}

export function renderFace(style, spec, k, o) {
  if (!spec) return '';
  const ink = o.outlined ? 'currentColor' : INK;
  const face = faceParts(style, spec, k);
  const out = face.parts
    .filter((p) => !(o.outlined && p.soft))
    .map((p) => {
      const fill = p.fill === 'ink' ? ink : p.fill;
      const op = p.op != null ? ` opacity="${p.op}"` : '';
      if (p.t === 'line')
        return `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="${f(k.ink * p.w)}" ${ROUND}/>`;
      if (p.t === 'shape')
        return `<path d="${p.d}" fill="${fill}" stroke="${ink}" stroke-width="${f(k.ink * p.w)}" ${ROUND}/>`;
      return `<path d="${p.d}" fill="${fill}"${op}/>`;
    })
    .join('');
  return `<g transform="${face.tf}">${out}</g>`;
}

/* ---------- props ---------- */
// Drawn once in a local box around (0, 0); anchors on each character place them.
const PROP_PARTS = {
  crown: () => [
    {
      t: 'shape',
      d: 'M-15 7L-17.5 -9L-7.5 -1.5L0 -13L7.5 -1.5L17.5 -9L15 7Z',
      fill: TINT.butter,
    },
    { t: 'fill', d: circle(0, -13, 2.6), fill: TINT.peach, skip: 'small' },
  ],
  pencil: () => [
    { t: 'shape', d: 'M-19 -5.5H9L18 0L9 5.5H-19Z', fill: TINT.butter },
    { t: 'fill', d: 'M9 -5.5L18 0L9 5.5Z', fill: '#FFE9CF' },
    { t: 'line', d: 'M9 -5.5L18 0L9 5.5', w: 0.8 },
    { t: 'fill', d: 'M14.5 -2.1L18 0L14.5 2.1Z', fill: 'ink' },
    { t: 'shape', d: rrect(-25, -5.5, 7, 11, 2.6), fill: TINT.rose },
  ],
  // The note and the book are folded paper: one facet shaded, like the game's own note.
  note: () => [
    { t: 'shape', d: rrect(-17, -12, 34, 24, 3.5), fill: PAPER },
    {
      t: 'fill',
      d: 'M-15.6 10.6L-3 1.6Q0 -0.4 3 1.6L15.6 10.6Z',
      fill: '#EEE6FF',
      skip: 'small',
    },
    { t: 'line', d: 'M-15 -10L0 1.5L15 -10', w: 0.8 },
    { t: 'shape', d: circle(0, 2, 4.8), fill: TINT.peach, w: 0.8 },
  ],
  moon: () => [
    {
      t: 'shape',
      d: 'M4 -14A14 14 0 1 0 14 7A11 11 0 0 1 4 -14Z',
      fill: TINT.butter,
    },
  ],
  book: () => [
    { t: 'shape', d: 'M0 -8Q-9 -13 -20 -10V11Q-9 8 0 12Z', fill: PAPER },
    { t: 'shape', d: 'M0 -8Q9 -13 20 -10V11Q9 8 0 12Z', fill: '#EEE6FF' },
    {
      t: 'line',
      d: 'M-15.5 -4Q-10 -5.8 -5 -3.6M-15.5 1.5Q-10 -0.3 -5 1.9M5 -3.6Q10 -5.8 15.5 -4M5 1.9Q10 -0.3 15.5 1.5',
      w: 0.62,
      color: '#9F86C4',
      soft: true,
      skip: 'small',
    },
  ],
};
export const PROP_ANCHOR = {
  crown: 'head',
  pencil: 'hand',
  note: 'hand',
  moon: 'sky',
  book: 'front',
};
export const DEFAULT_ANCHORS = {
  head: [50, 10, -14],
  hand: [80, 80, -32],
  front: [50, 84, 0],
  sky: [86, 14, 0],
};
export const PROP_ROT = { pencil: -38, note: -10, book: 0, crown: 0, moon: 0 };
/** A prop's visible parts in its local box, for exporters. */
export const propParts = (name, k) =>
  PROP_PARTS[name](k).filter((p) => visible(p, k));

export function renderProp(name, anchor, k, o) {
  const make = PROP_PARTS[name];
  if (!make) return '';
  const [x, y, r = 0, sc = 1] = anchor;
  const pk = { ...k, ink: (k.ink / sc) * 0.92, edge: k.edge / sc };
  const parts = make(pk).filter((p) => visible(p, pk));
  const edge = o.outlined
    ? ''
    : parts.map((p) => partEdge(p, pk, o.edgeColor)).join('');
  const art = parts
    .map((p) => partArt(p, pk, { ...o, outlined: false }))
    .join('');
  const turn = r + (name === 'crown' || name === 'moon' ? 0 : PROP_ROT[name]);
  return `<g transform="translate(${f(x)} ${f(y)})${turn ? ` rotate(${f(turn)})` : ''}${sc !== 1 ? ` scale(${f(sc)})` : ''}" ${ROUND}>${edge}${art}</g>`;
}

/* ---------- avatar ---------- */
export function renderAvatar(cast, id, opts = {}) {
  const ch = cast.chars.find((c) => c.id === id);
  if (!ch) throw new Error(`${cast.id}: no character ${id}`);
  const size = opts.size ?? 44;
  const mode = opts.mode ?? 'light';
  const sz = sizing(size, mode);
  const v = opts.variant ?? sz.v;
  const k = {
    v,
    small: v === 'small',
    large: v === 'large',
    mood: cast.moods === false ? 'idle' : (opts.mood ?? 'idle'),
    ink: sz.ink * (cast.inkScale ?? 1),
    edge:
      cast.edge === false || opts.edge === false
        ? 0
        : sz.edge * (cast.edgeScale ?? 1),
  };
  const o = {
    outlined: !!opts.outlined,
    hollow: opts.hollow ?? 'var(--av-hollow, transparent)',
    edgeColor: opts.edgeColor ?? MODE[mode].edge,
  };
  // Size-aware framing: a character may crop to a portrait at small sizes.
  let vb = [0, 0, 100, 100];
  const crop = ch.crop?.(k);
  if (crop) {
    vb = crop;
    k.ink *= crop[2] / 100;
    k.edge *= crop[2] / 100;
  }
  let edge = '';
  let art = '';
  let face = '';
  let top = '';
  let anchors = { ...DEFAULT_ANCHORS };
  if (ch.legacy) {
    const uid = `${LEGACY_PREFIX}${++legacyN}`;
    const body = o.outlined
      ? ch.legacy
          .replace(/fill="#(FFB887|B6F1D0|D8C3FF)"/gi, `fill="${o.hollow}"`)
          .replace(/fill="#39234E"/gi, 'fill="currentColor"')
      : ch.legacy;
    const stroke = o.outlined ? 'currentColor' : INK;
    const filter =
      o.outlined || !k.edge
        ? ''
        : `<defs><filter id="${uid}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="${f(k.edge)}" result="d"/><feFlood flood-color="${o.edgeColor}"/><feComposite in2="d" operator="in" result="e"/><feMerge><feMergeNode in="e"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    art = `${filter}<g${filter ? ` filter="url(#${uid})"` : ''}><g transform="scale(1.5625)" fill="none" stroke="${stroke}" stroke-width="2.5">${body}</g></g>`;
  } else {
    const drawn = ch.draw(k);
    const parts = drawn.parts.filter((p) => visible(p, k));
    edge = o.outlined
      ? ''
      : parts.map((p) => partEdge(p, k, o.edgeColor)).join('');
    art = parts.map((p) => partArt(p, k, o)).join('');
    face = drawn.face ? renderFace(cast.face, drawn.face, k, o) : '';
    top = (drawn.over ?? [])
      .filter((p) => visible(p, k))
      .map((p) => partArt(p, k, o))
      .join('');
    anchors = { ...anchors, ...drawn.anchors };
  }
  let prop = '';
  if (opts.prop && (!k.small || opts.forceProp))
    prop = renderProp(opts.prop, anchors[PROP_ANCHOR[opts.prop]], k, o);
  const label = opts.label
    ? ` role="img" aria-label="${opts.label.replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true"';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const px = opts.px ?? size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" width="${px}" height="${px}"${cls}${label} focusable="false" ${crop ? 'overflow="hidden"' : 'overflow="visible" style="overflow:visible"'} ${ROUND}${o.outlined ? ' color="currentColor"' : ''}>${edge}${art}${face}${top}${prop}</svg>`;
}
let legacyN = 0;
// Filter ids must not collide between the static page and the browser-rendered preview.
const LEGACY_PREFIX = 'document' in globalThis ? 'lgr' : 'lgs';

/** Wrap raw 64-unit shipped art (today's cast) so it renders through the same boards. */
export function legacyCast(id, name, inner, meta = {}) {
  return { id, name, legacy: inner, ...meta };
}
