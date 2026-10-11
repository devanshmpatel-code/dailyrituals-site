// The Bodhi tree behind the breathing pause: a full, spreading Ficus religiosa grown procedurally from a seed, painted on
// a canvas and lit by the candle at its foot.
//
// How it grows: a short, fluted trunk with buttress roots; five great limbs that rise and then arch outward; and a crown
// filled by space colonisation (twigs grow toward points scattered through a billowing dome), so the branching is organic
// and leaves fill the whole crown, not only its rim. The heart-shaped leaves with their long drip tips hang from every twig.
//
// How it is drawn: everything still is painted once per layout, in slices over the first frames, into two layers: the
// still tree (a hazy far canopy at half resolution under the dark near tree) and the same tree as the candle would light
// it at full breath. A frame then costs almost nothing: the lit tree is revealed through a soft CSS mask around the flame
// that grows on the in-breath and shrinks on the out-breath, the crown leans a little with a CSS skew, and only the couple
// of hundred leaves nearest the light are drawn live so they can tremble. Now and then one lets go and drifts down.

export interface BodhiAnchor { x: number; y: number; h: number } // the flame's base (CSS px in the host) and its base size
export interface BodhiOptions { canvas: HTMLCanvasElement; anchor: () => BodhiAnchor; sky: readonly string[]; reduce: boolean; seed?: number }
export interface Bodhi { update(t: number, k: number, sway: number, outp: number, dt: number): void; destroy(): void }

type RGB = [number, number, number];
type Node = { x: number; y: number; p: number; w: number; kids: number; min: number; trunk: boolean };
type Leaf = { x: number; y: number; s: number; a: number; f: number; layer: number; v: number; ph: number; wx: number; px: number; py: number; d: number; lb: number };
type Root = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; w0: number; w1: number };
type Tree = { nodes: Node[]; leaves: Leaf[]; roots: Root[]; billows: number[][] };
type Falling = { x: number; y: number; spin: number; s: number; v: number; ph: number; age: number };

const LEVELS = 12, VARIANTS = 3, TRUNK_TOP = -0.29;
const under = (x: number) => -0.45 + 0.27 * (x / 1.3) ** 2; // the crown's underside lifts over the trunk and droops at the rim
// per layer: the shadow tints (plum, indigo, green-black), the warm colour the candle gives, and the glow at its brightest
const PAL: { shadow: RGB[]; ember: RGB; lit: RGB; glow: RGB; rim: number }[] = [
  { shadow: [[46, 40, 74], [46, 40, 74], [46, 40, 74]], ember: [0, 0, 0], lit: [0, 0, 0], glow: [0, 0, 0], rim: 0 }, // far: one hazy tint, set from the sky
  { shadow: [[46, 37, 66], [39, 39, 68], [37, 46, 56]], ember: [104, 50, 50], lit: [204, 124, 64], glow: [250, 192, 118], rim: 0.1 }, // mid canopy
  { shadow: [[25, 17, 33], [20, 20, 36], [19, 27, 28]], ember: [118, 46, 36], lit: [234, 146, 58], glow: [255, 214, 140], rim: 0.065 }, // near canopy
];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${+a.toFixed(3)})`;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const hex = (h: string): RGB => { const n = parseInt((h || '#2B2145').replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// how the candle's reach falls off: full near the flame, a long soft fade to nothing at the edge of its circle
const STOPS: [number, number][] = [[0, 1], [0.42, 0.86], [0.72, 0.36], [1, 0]];
const profile = (u: number) => { if (u >= 1) return 0; for (let i = 1; i < STOPS.length; i++) if (u <= STOPS[i][0]) { const [a, va] = STOPS[i - 1], [b, vb] = STOPS[i]; return va + (vb - va) * ((u - a) / (b - a)); } return 0; };

/** The heart-shaped Bodhi leaf, petiole first, hanging from (0,0) with its drip tip at (0, 1). Units of leaf length. */
function leafPath(ctx: CanvasRenderingContext2D, S: number) {
  const L = 0.28, W = 0.31; const p = (x: number, y: number) => [x * S, y * S] as const;
  ctx.beginPath(); ctx.moveTo(...p(0, L + 0.035));
  ctx.bezierCurveTo(...p(0.13, L - 0.03), ...p(W, L + 0.01), ...p(W, L + 0.2));
  ctx.bezierCurveTo(...p(W, L + 0.38), ...p(0.15, L + 0.54), ...p(0.052, L + 0.66));
  ctx.bezierCurveTo(...p(0.03, L + 0.74), ...p(0.012, L + 0.9), ...p(0, 1));
  ctx.bezierCurveTo(...p(-0.012, L + 0.9), ...p(-0.03, L + 0.74), ...p(-0.052, L + 0.66));
  ctx.bezierCurveTo(...p(-0.15, L + 0.54), ...p(-W, L + 0.38), ...p(-W, L + 0.2));
  ctx.bezierCurveTo(...p(-W, L + 0.01), ...p(-0.13, L - 0.03), ...p(0, L + 0.035)); ctx.closePath();
}

/** A sprite sheet: the far tint, then every near and mid tint at every step of candlelight, so leaves are only drawImage calls. */
function buildAtlas(dpr: number, sky: RGB) {
  const S = Math.round(52 * dpr), cw = Math.ceil(0.68 * S), ch = Math.ceil(1.06 * S), rows = 1 + 2 * VARIANTS;
  const c = document.createElement('canvas'); c.width = cw * LEVELS; c.height = ch * rows; const g = c.getContext('2d')!;
  const L = 0.28; g.lineCap = 'round';
  const sprite = (col: number, row: number, fill: RGB, l: number, pal: typeof PAL[number], shade: RGB, detail: boolean) => {
    g.save(); g.translate(col * cw + cw / 2, row * ch + 0.02 * S);
    // the petiole: long and slender, the reason the leaf trembles in any air
    g.strokeStyle = css(mix(fill, shade, 0.3)); g.lineWidth = 0.024 * S;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0.014 * S, L * 0.5 * S, 0, (L + 0.03) * S); g.stroke();
    leafPath(g, S); g.fillStyle = css(fill); g.fill();
    if (!detail) { g.restore(); return; }
    if (l > 0.02) { // candlelight through the blade: it glows from the middle, as a backlit leaf does
      g.save(); g.clip(); const r = g.createRadialGradient(0, (L + 0.34) * S, 0, 0, (L + 0.34) * S, 0.44 * S);
      r.addColorStop(0, css(pal.glow, 0.6 * l)); r.addColorStop(1, css(pal.glow, 0)); g.fillStyle = r; g.fillRect(-S, 0, 2 * S, 1.2 * S); g.restore();
    }
    // the midrib and three pairs of veins: light when lit, dark in silhouette
    g.strokeStyle = l > 0.3 ? css(pal.glow, 0.1 + 0.3 * l) : css(mix(fill, [0, 0, 0], 0.35), 0.55); g.lineWidth = 0.014 * S;
    g.beginPath(); g.moveTo(0, (L + 0.04) * S); g.lineTo(0, 0.95 * S);
    for (let i = 0; i < 3; i++) { const y = (L + 0.13 + i * 0.15) * S, x = (0.24 - i * 0.06) * S; g.moveTo(0, y); g.quadraticCurveTo(x * 0.5, y + 0.05 * S, x, y + 0.14 * S); g.moveTo(0, y); g.quadraticCurveTo(-x * 0.5, y + 0.05 * S, -x, y + 0.14 * S); }
    g.stroke();
    // a faint cool rim, so overlapping leaves read as leaves in the dark; warm and stronger when lit
    leafPath(g, S); g.lineWidth = 0.022 * S * (0.8 + l);
    g.strokeStyle = l > 0.2 ? css(pal.glow, 0.15 + 0.6 * (l - 0.2)) : css([168, 160, 214], pal.rim); g.stroke();
    g.restore();
  };
  sprite(0, 0, mix(PAL[0].shadow[0], sky, 0.5), 0, PAL[0], [20, 16, 30], false);
  for (let layer = 1; layer <= 2; layer++) for (let v = 0; v < VARIANTS; v++) for (let lv = 0; lv < LEVELS; lv++) {
    const l = lv / (LEVELS - 1), pal = PAL[layer];
    // shadow, then the deep red of a leaf barely lit, then amber, then gold where the light comes through
    const fill = l < 0.38 ? mix(pal.shadow[v], pal.ember, l / 0.38) : l < 0.74 ? mix(pal.ember, pal.lit, (l - 0.38) / 0.36) : mix(pal.lit, pal.glow, ((l - 0.74) / 0.26) * 0.8);
    sprite(lv, 1 + (layer - 1) * VARIANTS + v, fill, l, pal, pal.shadow[v], true);
  }
  return { c, cw, ch, S };
}

/**
 * Grows the tree in a unit space: the root at (0,0), the crown reaching up to about y = -1 and out to x = +-1.35.
 * Trunk and great limbs are laid down first; then twigs grow toward attraction points scattered through the crown.
 */
function growTree(seed: number): Tree {
  const r = rng(seed), nodes: Node[] = [];
  const add = (x: number, y: number, p: number, min = 0, trunk = false) => { nodes.push({ x, y, p, w: 0, kids: 0, min, trunk }); if (p >= 0) nodes[p].kids++; return nodes.length - 1; };
  // the crown: a dome of billows, a little uneven, its underside lifting over the trunk and drooping at the rim
  const billows = ([[0, -0.72, 0.33], [-0.4, -0.71, 0.3], [0.42, -0.72, 0.3], [-0.78, -0.6, 0.27], [0.8, -0.61, 0.26], [-1.1, -0.47, 0.22], [1.11, -0.49, 0.21],
    [-0.2, -0.86, 0.22], [0.23, -0.87, 0.21], [-0.6, -0.8, 0.21], [0.62, -0.81, 0.2], [0, -0.92, 0.16]] as const).map(([x, y, rad]) => [x + (r() - 0.5) * 0.06, y + (r() - 0.5) * 0.04, rad * (0.92 + r() * 0.16)]);
  const inside = (x: number, y: number) => y < under(x) && billows.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 < br * br);

  // the trunk: a slow twist up to the fork
  let prev = add(0, 0.02, -1, 0.17, true);
  const tx = (t: number) => 0.022 * Math.sin(t * 3.1 + 0.4) * (1 - t * 0.4) + 0.012 * t;
  for (let i = 1; i <= 8; i++) { const t = i / 8; prev = add(tx(t), TRUNK_TOP * t + 0.02 * (1 - t), prev, 0.15, true); }
  const fork = prev;

  // the great limbs: each rises steeply out of the fork, then arches outward and settles, with a gnarl along its length
  const D = 0.022, limbNodes: number[][] = [];
  const limb = (parent: number, P: number[][], w0: number, w1: number, gn: number) => {
    const out: number[] = []; let p = parent, lx = nodes[parent].x, ly = nodes[parent].y, acc = 0; const ph = r() * 6.28, ph2 = r() * 6.28;
    const cub = (t: number, i: number) => { const u = 1 - t; return u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]; };
    for (let i = 1; i <= 90; i++) {
      const t = i / 90, x0 = cub(t, 0), y0 = cub(t, 1), dx = cub(Math.min(1, t + 0.01), 0) - cub(Math.max(0, t - 0.01), 0), dy = cub(Math.min(1, t + 0.01), 1) - cub(Math.max(0, t - 0.01), 1);
      const m = Math.hypot(dx, dy) || 1, wob = gn * (0.02 * Math.sin(t * 7 + ph) + 0.008 * Math.sin(t * 19 + ph2)) * Math.sin(Math.PI * t);
      const x = x0 - (dy / m) * wob, y = y0 + (dx / m) * wob; acc += Math.hypot(x - lx, y - ly); lx = x; ly = y;
      if (acc >= D || i === 90) { p = add(x, y, p, w0 + (w1 - w0) * t); out.push(p); acc = 0; }
    }
    return out;
  };
  const top = nodes[fork];
  const LIMBS: [number, number, number, number, number][] = [ // start offset, end x, end y, rise, base width
    [-0.04, -1.06, -0.5, 0.17, 0.064], [-0.02, -0.56, -0.76, 0.22, 0.056], [0, -0.04, -0.9, 0.3, 0.048], [0.022, 0.52, -0.78, 0.22, 0.056], [0.04, 1.05, -0.52, 0.17, 0.062],
  ];
  for (const [o, ex, ey, rise, w] of LIMBS) {
    const sx = top.x + o, sy = top.y + 0.02, jx = ex + (r() - 0.5) * 0.06, jy = ey + (r() - 0.5) * 0.04;
    limbNodes.push(limb(fork, [[sx, sy], [sx + jx * 0.1, sy - rise * (1.1 + r() * 0.2)], [jx * 0.6, jy - 0.07 - r() * 0.04], [jx, jy]], w, 0.011, 1));
  }
  // secondary limbs climbing into the upper billows, and two low ones reaching out under the crown
  const branchOff = (li: number, at: number, ex: number, ey: number, w: number) => {
    const L = limbNodes[li], n = nodes[L[Math.floor(L.length * at)]], idx = L[Math.floor(L.length * at)];
    limb(idx, [[n.x, n.y], [n.x + (ex - n.x) * 0.15, n.y - 0.12], [n.x + (ex - n.x) * 0.7, ey - 0.04], [ex, ey]], w, 0.009, 0.7);
  };
  branchOff(0, 0.42, -0.74, -0.86, 0.03); branchOff(4, 0.42, 0.76, -0.86, 0.03); branchOff(1, 0.5, -0.32, -0.96, 0.026); branchOff(3, 0.5, 0.34, -0.97, 0.026);
  branchOff(0, 0.25, -1.24, -0.38, 0.026); branchOff(4, 0.25, 1.24, -0.4, 0.026); branchOff(2, 0.45, 0.16, -1.0, 0.022);

  // space colonisation: twigs grow toward the attraction points, one step at a time, until the crown is full
  const N = 1300, DI = 0.17, DK = 0.032, GW = 32, cell = (x: number) => Math.max(0, Math.min(GW - 1, Math.floor((x + 1.6) / DI)));
  type A = { x: number; y: number; best: number; node: number; alive: boolean };
  const attrs: A[] = [], grid: A[][] = Array.from({ length: GW * GW }, () => []);
  for (let tries = 0; attrs.length < N && tries < 20000; tries++) {
    const x = (r() * 2 - 1) * 1.42, y = -1.1 + r() * 0.88; if (!inside(x, y)) continue;
    const a = { x, y, best: 1e9, node: -1, alive: true }; attrs.push(a); grid[cell(y) * GW + cell(x)].push(a);
  }
  const see = (from: number) => {
    for (let i = from; i < nodes.length; i++) {
      const n = nodes[i], cx = cell(n.x), cy = cell(n.y);
      for (let gy = Math.max(0, cy - 1); gy <= Math.min(GW - 1, cy + 1); gy++) for (let gx = Math.max(0, cx - 1); gx <= Math.min(GW - 1, cx + 1); gx++)
        for (const a of grid[gy * GW + gx]) { if (!a.alive) continue; const d = Math.hypot(a.x - n.x, a.y - n.y); if (d < a.best) { a.best = d; a.node = i; } }
    }
  };
  see(0);
  for (let iter = 0, seen = nodes.length; iter < 140 && nodes.length < 5000; iter++) {
    const pull = new Map<number, [number, number]>();
    for (const a of attrs) {
      if (!a.alive) continue; if (a.best < DK) { a.alive = false; continue; } if (a.best > DI) continue;
      const n = nodes[a.node], d = a.best || 1, v = pull.get(a.node) ?? [0, 0]; v[0] += (a.x - n.x) / d; v[1] += (a.y - n.y) / d; pull.set(a.node, v);
    }
    if (!pull.size) break;
    for (const [i, v] of pull) {
      const n = nodes[i]; let m = Math.hypot(v[0], v[1]); if (m < 0.2) continue;
      let dx = v[0] / m + (r() - 0.5) * 0.36, dy = v[1] / m + (r() - 0.5) * 0.36 + 0.14 * (n.x / 1.3) ** 2; // a little wander, and the outer twigs droop
      m = Math.hypot(dx, dy); add(n.x + (dx / m) * D, n.y + (dy / m) * D, i);
    }
    see(seen); seen = nodes.length;
  }

  // thickness by the pipe model: each branch carries the twigs above it
  const acc = new Float64Array(nodes.length), TIP = 0.0034, E = 2.3;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]; n.w = Math.max(n.min, acc[i] > 0 ? Math.pow(acc[i], 1 / E) : TIP, TIP); if (n.p >= 0) acc[n.p] += Math.pow(n.w, E);
  }

  // leaves: clusters at the tips, and a few along every thin twig, hanging on their long stalks
  const leaves: Leaf[] = [];
  for (const n of nodes) {
    if (n.trunk || n.w > 0.0072) continue;
    const c = n.kids === 0 ? 4 + Math.floor(r() * 3) : 1 + (r() < 0.45 ? 1 : 0);
    for (let j = 0; j < c; j++) {
      const ang = r() * 6.283, rad = r() * 0.03, any = r() < 0.14;
      leaves.push({ x: n.x + Math.cos(ang) * rad, y: n.y + Math.sin(ang) * rad * 0.8, s: 0.74 + r() * 0.5, a: any ? (r() - 0.5) * 5 : (r() - 0.5) * 1.5 + Math.sign(n.x) * 0.22,
        f: r() < 0.5 ? -1 : 1, layer: r() < 0.52 ? 2 : 1, v: Math.floor(r() * VARIANTS), ph: r() * 6.283, wx: 0.86 + r() * 0.26, px: 0, py: 0, d: 0, lb: 0 });
    }
  }
  // buttress roots spreading over the ground
  const roots: Root[] = [];
  for (const [dx, w, dy] of [[-0.25, 0.08, 0.04], [0.23, 0.076, 0.042], [-0.12, 0.064, 0.05], [0.11, 0.066, 0.052], [-0.33, 0.045, 0.03], [0.31, 0.042, 0.032]] as const)
    roots.push({ x0: dx * 0.22, y0: -0.1, cx: dx * 0.55, cy: -0.03, x1: dx + (r() - 0.5) * 0.03, y1: dy + 0.01, w0: w, w1: 0.005 });
  return { nodes, leaves, roots, billows };
}

// the tree is the same at every size, so it is grown once per page; the atlas once per device pixel ratio and sky
const trees = new Map<number, Tree>();
let atlasCache: { key: string; a: ReturnType<typeof buildAtlas> } | null = null;

export function createBodhi(o: BodhiOptions): Bodhi {
  const cv = o.canvas, host = cv.parentElement!, dpr = Math.min(2, window.devicePixelRatio || 1), seed = o.seed ?? 1121;
  const skyC = mix([26, 20, 38], hex(o.sky[1]), 0.45); // the sky as the pause shows it, mixed down toward dusk
  // three layers: the still tree, far canopy and near (the host's canvas); the candlelit tree; the leaves that move. The last
  // two cover only the square the candle's light can reach, so a frame composites little more than the page did before.
  const layer = (cls: string) => { const c = document.createElement('canvas'); c.className = cls; c.setAttribute('aria-hidden', 'true'); return c; };
  const litEl = layer('fb-bodhi-lit'), liveEl = layer('fb-bodhi-live'); host.append(litEl, liveEl);
  const lc = liveEl.getContext('2d')!;
  let W = 0, H = 0, ox = 0, oy = 0, sx = 1, sy = 1, sc = 1, leafPx = 24, lx = 0, ly = 0, Rmax = 300;
  let lox = 0, loy = 0, lw = 0, lh = 0;
  let live: Leaf[] = [], order: Leaf[] = [], dirty = true, destroyed = false, still = false;
  let tree: Tree | null = null, atlas: ReturnType<typeof buildAtlas> | null = null;
  let clr = [0, 0, 0, 0]; // the part of the moving layer drawn last frame, cleared before the next
  const X = (x: number) => ox + x * sx, Y = (y: number) => oy + y * sy;

  const drawLeaf = (g: CanvasRenderingContext2D, l: Leaf, px: number, py: number, ang: number, lv: number, size: number, k = dpr) => {
    const a = atlas!, c = Math.cos(ang), s = Math.sin(ang), w = size * 0.68 * l.wx, h = size * 1.06;
    const row = l.layer === 0 ? 0 : 1 + (l.layer - 1) * VARIANTS + l.v, col = l.layer === 0 ? 0 : lv;
    g.setTransform(k * c * l.f, k * s * l.f, -k * s, k * c, px * k, py * k);
    g.drawImage(a.c, col * a.cw, row * a.ch, a.cw, a.ch, -w / 2, -0.02 * size, w, h);
  };
  /** The wood: every branch as short round-capped strokes, grouped by width so the whole tree is a few dozen strokes. */
  const drawWood = (g: CanvasRenderingContext2D, style: string | CanvasGradient, f: (x: number, y: number) => [number, number], ws: number, minW = 0) => {
    const nodes = tree!.nodes, buckets = new Map<number, number[]>();
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i]; if ((n.trunk && nodes[n.p].trunk) || n.w < minW) continue;
      const q = Math.max(0.5, Math.round(n.w * ws * 2) / 2), b = buckets.get(q) ?? [], p = nodes[n.p], [x0, y0] = f(p.x, p.y), [x1, y1] = f(n.x, n.y); b.push(x0, y0, x1, y1); buckets.set(q, b);
    }
    g.strokeStyle = style; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, b] of buckets) { g.lineWidth = w; g.beginPath(); for (let i = 0; i < b.length; i += 4) { g.moveTo(b[i], b[i + 1]); g.lineTo(b[i + 2], b[i + 3]); } g.stroke(); }
  };
  const outline = (g: CanvasRenderingContext2D, A: number[][], B: number[][]) => {
    g.beginPath(); g.moveTo(A[0][0], A[0][1]); for (const p of A) g.lineTo(p[0], p[1]); for (let i = B.length - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]); g.closePath(); g.fill();
  };
  const rootPoly = (g: CanvasRenderingContext2D, s: Root) => {
    const A: number[][] = [], B: number[][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, u = 1 - t, px = u * u * s.x0 + 2 * u * t * s.cx + t * t * s.x1, py = u * u * s.y0 + 2 * u * t * s.cy + t * t * s.y1;
      const dx = (2 * u * (s.cx - s.x0) + 2 * t * (s.x1 - s.cx)) * sx, dy = (2 * u * (s.cy - s.y0) + 2 * t * (s.y1 - s.cy)) * sy, m = Math.hypot(dx, dy) || 1;
      const w = (s.w0 + (s.w1 - s.w0) * Math.pow(t, 0.7)) * sc / 2; A.push([X(px) - (dy / m) * w, Y(py) + (dx / m) * w]); B.push([X(px) + (dy / m) * w, Y(py) - (dx / m) * w]);
    }
    outline(g, A, B);
  };
  // the trunk: broad and fluted, flaring into the roots at the foot and swelling again where the limbs part
  const trunkX = (t: number) => 0.022 * Math.sin(t * 3.1 + 0.4) * (1 - t * 0.4) + 0.012 * t;
  const trunkW = (t: number) => 0.19 + 0.17 * Math.pow(1 - t, 4) + 0.05 * Math.pow(t, 3);
  const trunkPoly = (g: CanvasRenderingContext2D) => {
    const A: number[][] = [], B: number[][] = [];
    for (let i = 0; i <= 22; i++) {
      const t = i / 22, y = 0.02 + (TRUNK_TOP - 0.03) * t, x = trunkX(t), w = (trunkW(t) / 2) * (t > 0.8 ? 1 - 0.55 * ((t - 0.8) / 0.2) ** 2 : 1), gl = 0.008 * Math.sin(t * 15 + 1) * Math.sin(Math.PI * t), gr = 0.007 * Math.sin(t * 13 + 4) * Math.sin(Math.PI * t);
      A.push([X(x - w + gl), Y(y)]); B.push([X(x + w + gr), Y(y)]);
    }
    outline(g, A, B);
  };
  const flutes = (g: CanvasRenderingContext2D, style: string, dx: number, lw: number) => {
    g.strokeStyle = style; g.lineCap = 'round'; g.lineWidth = lw;
    for (let i = 0; i < 9; i++) {
      // grooves of uneven length and spacing, where the stems that make up the trunk have grown together
      const u = (i - 4) / 4.6 + 0.04 * Math.sin(i * 2.7), ta = 0.03 + 0.25 * ((i * 0.37) % 1), tb = 0.62 + 0.33 * ((i * 0.61) % 1); g.beginPath();
      for (let j = 0; j <= 14; j++) { const t = ta + (tb - ta) * (j / 14), y = 0.02 + (TRUNK_TOP - 0.03) * t, x = trunkX(t) + u * trunkW(t) * 0.42 + 0.006 * Math.sin(t * 11 + i * 2.1); j ? g.lineTo(X(x) + dx, Y(y)) : g.moveTo(X(x) + dx, Y(y)); }
      g.stroke();
    }
  };
  /** The body of the crown: soft shade inside every billow, so the foliage has depth and the sky does not show through it. */
  const mass = (g: CanvasRenderingContext2D, rgb: string, within = 1e9) => {
    // deep inside each billow a soft core of shade; then a faint disc behind every other leaf, so the shade follows the
    // foliage itself and can never show past it, thick where the leaves crowd and thin where they part
    for (const [bx, by, br] of tree!.billows) {
      g.save(); g.translate(X(bx), Y(by - 0.04)); g.scale(sx, sy);
      const m = g.createRadialGradient(0, 0, 0, 0, 0, br * 0.66); m.addColorStop(0, `rgba(${rgb},0.75)`); m.addColorStop(0.6, `rgba(${rgb},0.55)`); m.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = m; g.beginPath(); g.arc(0, 0, br * 0.66, 0, 6.283); g.fill(); g.restore();
    }
    g.fillStyle = `rgba(${rgb},0.2)`; const ls = tree!.leaves;
    for (let i = 0; i < ls.length; i += 2) { const l = ls[i]; if (l.d > within) continue; const z = leafPx * l.s * (l.layer === 2 ? 1.12 : 1); g.beginPath(); g.arc(l.px - Math.sin(l.a) * z * 0.6, l.py + Math.cos(l.a) * z * 0.6, z * 0.42, 0, 6.283); g.fill(); }
  };
  const size = (c: HTMLCanvasElement, w: number, h: number, s = 1) => { c.width = Math.max(1, Math.round(w * dpr * s)); c.height = Math.max(1, Math.round(h * dpr * s)); const g = c.getContext('2d')!; g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0); return g; };

  /**
   * Lays the tree out for this viewport and queues the painting: the far canopy, the dark tree, then the same tree as the
   * candle lights it at the top of the breath. The work is cut into slices of several hundred leaves, a slice or two a frame,
   * painted straight into the layers so each frame's share is drawn with that frame; opening the pause never waits on it, and
   * it is all there within the first second ("Take a moment", while the pause fades in and the flame is still low).
   */
  let jobs: (() => number)[] = [], slowest = 0, bakeStart = 0;
  const build = () => {
    // measured on the host, which never leans, so the size is not thrown off by the skew
    const rc = host.getBoundingClientRect(); W = host.clientWidth; H = host.clientHeight; if (!W || !H) return;
    bakeStart = performance.now(); slowest = 0;
    tree = trees.get(seed) ?? growTree(seed); trees.set(seed, tree);
    const key = `${dpr}|${o.sky[1]}`; if (!atlasCache || atlasCache.key !== key) atlasCache = { key, a: buildAtlas(dpr, skyC) }; atlas = atlasCache.a;
    const an = o.anchor(), T = tree;
    ox = an.x - rc.left; oy = an.y - rc.top + 2; sy = Math.max(140, oy * 0.86); sx = Math.min(sy * 0.92, W * 0.43); sc = Math.sqrt(sx * sy);
    leafPx = Math.max(10.5, Math.min(23, sc * 0.045)); lx = ox; ly = oy - 2 - an.h * 0.6; Rmax = sc * 0.9;
    const reach = Rmax * 1.1;
    for (const l of T.leaves) { l.px = X(l.x); l.py = Y(l.y); l.d = Math.hypot(l.px - lx, l.py - ly); l.lb = Math.pow(clamp01(1 - l.d / reach), 1.05) * (l.layer === 2 ? 1 : 0.78); }
    // the leaves that move are the near ones the light reaches: they catch it and tremble; the rest are baked
    live = T.leaves.filter(l => l.layer === 2 && l.lb > 0.2).sort((a, b) => b.lb - a.lb).slice(0, 220).sort((a, b) => a.py - b.py);
    const isLive = new Set(live); order = T.leaves.filter(l => !isLive.has(l)).sort((a, b) => a.layer - b.layer);
    // the square the candle's light can reach: the lit tree and the moving leaves live in it
    lox = Math.max(0, Math.floor(lx - reach)); loy = Math.max(0, Math.floor(ly - reach)); lw = Math.max(1, Math.min(W, Math.ceil(lx + reach)) - lox); lh = Math.max(1, Math.min(H, Math.ceil(ly + reach)) - loy);

    const far = document.createElement('canvas'), fg = size(far, W, H, 0.5), d = size(cv, W, H), g = size(litEl, lw, lh); size(liveEl, lw, lh); clr = [0, 0, liveEl.width, liveEl.height];
    cv.style.transformOrigin = `${ox}px ${oy}px`;
    for (const el of [litEl, liveEl]) Object.assign(el.style, { left: `${lox}px`, top: `${loy}px`, width: `${lw}px`, height: `${lh}px`, transformOrigin: `${ox - lox}px ${oy - loy}px` });
    const slices = <L,>(arr: L[], n: number, f: (x: L) => void) => { for (let i = 0; i < arr.length; i += n) { const a = i; jobs.push(() => { const e = Math.min(arr.length, a + n); for (let j = a; j < e; j++) f(arr[j]); return e - a; }); } };
    const near = (l: Leaf) => leafPx * l.s * (l.layer === 2 ? 1.12 : 1);
    jobs = [];
    // far canopy: the same tree mirrored and set back, at half resolution so it is soft, hazed with the sky of the hour
    const fs = dpr * 0.5, fx = (x: number) => X(-x * 1.1 + 0.05), fy = (y: number) => Y(y * 1.05 - 0.03);
    const farLeaf: Leaf = { x: 0, y: 0, s: 1, a: 0, f: 1, layer: 0, v: 0, ph: 0, wx: 1, px: 0, py: 0, d: 0, lb: 0 };
    slices(T.leaves.filter((_, i) => !(i % 2)), 900, l => { farLeaf.f = l.f; farLeaf.wx = l.wx; drawLeaf(fg, farLeaf, fx(l.x), fy(l.y), -l.a, 0, leafPx * 1.15 * l.s, fs); });
    // then the near tree in shadow over it: a little ground shade, the crown's body, roots, fluted trunk, limbs and twigs
    jobs.push(() => {
      fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = css(skyC, 0.16); fg.fillRect(0, 0, far.width, far.height);
      d.setTransform(dpr, 0, 0, dpr, 0, 0); d.globalAlpha = 0.6; d.drawImage(far, 0, 0, W, H); d.globalAlpha = 1; far.width = far.height = 0;
      const bark = '#160F1D', ground = d.createRadialGradient(ox, oy, 0, ox, oy, sc * 0.6); ground.addColorStop(0, 'rgba(10,7,14,0.55)'); ground.addColorStop(1, 'rgba(10,7,14,0)');
      d.save(); d.translate(ox, oy); d.scale(1, 0.12); d.translate(-ox, -oy); d.fillStyle = ground; d.beginPath(); d.arc(ox, oy, sc * 0.6, 0, 6.283); d.fill(); d.restore();
      mass(d, '20,15,29'); d.fillStyle = bark; for (const s of T.roots) rootPoly(d, s); trunkPoly(d); drawWood(d, bark, (x, y) => [X(x), Y(y)], sc);
      flutes(d, 'rgba(6,4,10,0.35)', 0, Math.max(1.5, sc * 0.012));
      return 700;
    });
    slices(order, 700, l => drawLeaf(d, l, l.px, l.py, l.a, 0, near(l)));
    // the lit tree: warm on the wood, ember in the shade of the crown, amber through the lower leaves
    jobs.push(() => {
      g.setTransform(dpr, 0, 0, dpr, -lox * dpr, -loy * dpr);
      const wood = g.createRadialGradient(lx, ly, 0, lx, ly, reach);
      wood.addColorStop(0, 'rgb(214,142,88)'); wood.addColorStop(0.16, 'rgb(170,96,58)'); wood.addColorStop(0.45, 'rgb(96,52,46)'); wood.addColorStop(1, 'rgb(40,24,36)');
      g.fillStyle = wood; for (const s of T.roots) rootPoly(g, s); trunkPoly(g); drawWood(g, wood, (x, y) => [X(x), Y(y)], sc);
      // the fluted bark: dark grooves and a warm ridge beside each, the candle catching the folds; the trunk rounds away at its edges
      flutes(g, 'rgba(40,18,20,0.26)', 0, Math.max(1.5, sc * 0.014)); flutes(g, 'rgba(255,200,140,0.1)', Math.max(1, sc * 0.009), Math.max(1, sc * 0.006));
      const cyl = g.createLinearGradient(X(-0.2), 0, X(0.21), 0);
      cyl.addColorStop(0, 'rgba(18,9,18,0.75)'); cyl.addColorStop(0.3, 'rgba(18,9,18,0.3)'); cyl.addColorStop(0.55, 'rgba(18,9,18,0)'); cyl.addColorStop(0.78, 'rgba(18,9,18,0.22)'); cyl.addColorStop(1, 'rgba(18,9,18,0.7)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = cyl; g.fillRect(X(-0.32), Y(-0.6), sx * 0.64, sy * 0.68);
      // the shade inside the crown, a deep ember where the light reaches it (the mask does the fading), goes in behind the wood
      g.globalCompositeOperation = 'destination-over'; mass(g, '104,46,40', reach); g.globalCompositeOperation = 'source-over';
      return 700;
    });
    slices(order.filter(l => l.d < reach + leafPx * 1.5), 700, l => drawLeaf(g, l, l.px - lox, l.py - loy, l.a, Math.round(l.lb * (LEVELS - 1)), near(l)));
    jobs.push(() => { still = false; cv.dataset.readyMs = (performance.now() - bakeStart).toFixed(0); return 0; });
    dirty = false;
  };
  /** A frame's share of the baking: a slice or two, never more than a few milliseconds of drawing. */
  const bake = () => {
    const t0 = performance.now(); let units = 0;
    while (jobs.length && units < 900 && performance.now() - t0 < 6) units += jobs.shift()!();
    slowest = Math.max(slowest, performance.now() - t0); cv.dataset.buildMs = slowest.toFixed(1);
  };

  // a leaf that lets go, about once every two or three breaths, and a few fireflies
  let fall: Falling | null = null, lastOut = -1, cycles = 0, nextFall = 1;
  const fr = rng(seed + 99), flies = Array.from({ length: 7 }, () => ({ x: (fr() - 0.5) * 1.5, y: -0.22 - fr() * 0.5, ph: fr() * 6.283, sp: 0.6 + fr() * 0.8 }));
  const fallLeaf: Leaf = { x: 0, y: 0, s: 1, a: 0, f: 1, layer: 2, v: 1, ph: 0, wx: 1, px: 0, py: 0, d: 0, lb: 0 };

  const update = (t: number, k: number, sway: number, outp: number, dt: number) => {
    if (dirty) { build(); return; } if (jobs.length) bake();
    if (o.reduce) { k = 0.75; sway = 0; }
    const flick = o.reduce ? 1 : 0.975 + 0.025 * Math.sin(t * 11.3) * Math.sin(t * 4.1 + 1), R = Rmax * (0.5 + 0.6 * k) * flick;
    // the crown breathing, and the push of the out-breath, as a lean about the ground
    const theta = o.reduce ? 0 : 0.004 * Math.sin(t * 0.32) + 0.003 * Math.sin(t * 0.11 + 2) + 0.009 * sway;
    cv.style.transform = litEl.style.transform = `skewX(${(-theta).toFixed(5)}rad)`;
    // the candle's reach: the lit tree shows through a soft circle around the flame that grows with the breath
    const mx = lx - lox, my = ly - loy, mask = `radial-gradient(circle ${R.toFixed(1)}px at ${mx.toFixed(1)}px ${my.toFixed(1)}px, ${STOPS.map(([u, a]) => `rgba(0,0,0,${a}) ${(u * R).toFixed(1)}px`).join(', ')})`;
    litEl.style.maskImage = mask; litEl.style.setProperty('-webkit-mask-image', mask);
    const breeze = outp >= 0 && !o.reduce ? Math.sin(Math.PI * Math.min(1, outp * 1.35)) : 0, front = -1.2 + 2.4 * Math.max(0, outp);
    if (outp >= 0 && lastOut < 0 && !o.reduce) { cycles++; if (!fall && cycles >= nextFall) { fall = { x: (fr() - 0.5) * 1.2, y: -0.44 - fr() * 0.2, spin: (fr() - 0.5) * 2, s: 1 + fr() * 0.3, v: 26 + fr() * 12, ph: fr() * 6.283, age: 0 }; nextFall = cycles + 2 + (fr() < 0.5 ? 1 : 0); } }
    lastOut = outp;

    // the moving layer, once the tree is all painted: clear what was drawn last time, then the trembling leaves, the fireflies
    // and the falling leaf
    if (jobs.length) return;
    const g = lc; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(clr[0], clr[1], clr[2] - clr[0], clr[3] - clr[1]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const grow = (x: number, y: number, r: number) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const l of live) {
      const px = l.px + theta * (oy - l.py), I = l.lb * profile(l.d / R), size = leafPx * l.s * 1.12;
      let ang = l.a, off = 0;
      if (!o.reduce) {
        ang += 0.07 * Math.sin(t * 1.6 + l.ph) + 0.035 * Math.sin(t * 3.3 + l.ph * 1.7);
        if (breeze > 0) { const e = l.x - front, env = Math.exp(-e * e * 5) * breeze; ang += env * (0.25 * Math.sin(t * 6 + l.ph) + 0.08); off = env * 2; }
      }
      drawLeaf(g, l, px + off - lox, l.py + off * 0.3 - loy, ang, Math.round(clamp01(I) * (LEVELS - 1)), size); grow(px - lox, l.py - loy + size * 0.5, size * 1.1);
    }
    if (!o.reduce) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const x = X(f.x) + Math.sin(t * 0.21 * f.sp + f.ph) * sy * 0.12 - lox, y = Y(f.y) + Math.sin(t * 0.17 * f.sp + f.ph * 2) * sy * 0.07 - loy;
        const a = Math.max(0, Math.sin(t * 0.9 * f.sp + f.ph)) ** 3 * 0.7 * clamp01(Math.min(x, y, lw - x, lh - y) / 30); if (a < 0.03) continue;
        const rg = g.createRadialGradient(x, y, 0, x, y, 4.5); rg.addColorStop(0, `rgba(236,240,170,${a.toFixed(3)})`); rg.addColorStop(0.35, `rgba(220,230,130,${(a * 0.4).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,220,120,0)');
        g.fillStyle = rg; g.fillRect(x - 5, y - 5, 10, 10); grow(x, y, 6);
      }
      g.globalCompositeOperation = 'source-over';
      // the falling leaf: it rocks as it drifts down past the flame and catches the light as it turns
      if (fall) {
        fall.age += dt; const sw = Math.sin(fall.age * 2.1 + fall.ph);
        const px = X(fall.x) + Math.sin(fall.age * 0.8 + fall.ph) * 40 + sw * 16, py = Y(fall.y) + fall.age * fall.v;
        const ang = sw * 0.9 + fall.spin * fall.age * 0.5, face = 0.55 + 0.45 * Math.abs(Math.cos(ang)), dd = Math.hypot(px - lx, py - ly);
        const I = clamp01(Math.pow(clamp01(1 - dd / (Rmax * 1.1)), 1.05) * profile(dd / R) * face * 1.15), fade = clamp01((oy + 24 - py) / 50), size = leafPx * 1.2 * fall.s;
        if (fade > 0) { g.globalAlpha = fade; drawLeaf(g, fallLeaf, px - lox, py - loy, ang, Math.round(I * (LEVELS - 1)), size); g.globalAlpha = 1; grow(px - lox, py - loy + size * 0.5, size * 1.2); }
        if (fade <= 0 || py > H + 40) fall = null;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    clr = x1 > x0 ? [Math.max(0, Math.floor(x0 * dpr) - 2), Math.max(0, Math.floor(y0 * dpr) - 2), Math.min(liveEl.width, Math.ceil(x1 * dpr) + 2), Math.min(liveEl.height, Math.ceil(y1 * dpr) + 2)] : [0, 0, 0, 0];
    if (o.reduce && !jobs.length) still = true;
  };
  const ro = new ResizeObserver(() => { dirty = true; still = false; }); ro.observe(cv);
  return {
    update(t, k, sway, outp, dt) { if (!destroyed && !still) update(t, k, sway, outp, dt); },
    destroy() {
      // stop at once; let the tree fade out with the pause, then hand back the canvases' memory
      destroyed = true; ro.disconnect(); live = []; order = []; jobs = [];
      window.setTimeout(() => { for (const c of [litEl, liveEl, cv]) { c.width = 0; c.height = 0; } litEl.remove(); liveEl.remove(); }, o.reduce ? 0 : 450);
    },
  };
}
