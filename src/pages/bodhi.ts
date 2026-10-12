// The Bodhi tree of the breathing pause: a full, spreading Ficus religiosa grown procedurally from a seed, painted on a
// canvas and lit by the candle chosen in the picker, which stands on the ground at its foot.
//
// How it grows: a short, fluted trunk with buttress roots; five great limbs that rise and then arch outward; and a crown
// filled by space colonisation (twigs grow toward points scattered through a billowing dome), so the branching is organic
// and leaves fill the whole crown, not only its rim. The heart-shaped leaves with their long drip tips hang from every twig.
//
// Where it stands: the picker lays it out (anchor: the trunk's foot and the tree's scale), large and near, so its crown
// spreads across the top of the pause like a canopy and runs out past the edges of the window, and the candles are small
// beside its trunk. Until a candle is lit it is a dark silhouette in the night, with a faint cool rim of moonlight along
// the left of its bark and its leaves.
//
// How it is lit: the candle stands on the ground a little in front of the trunk. Its light is worked out as light is: it
// falls off with the square of the distance and with the angle it arrives at, so the bark is brightest just behind the
// flame and fades up the trunk, the round trunk turns away from it at its sides, the roots catch it on the side facing the
// flame, the ground takes a pool of it (but not behind the trunk), the roots throw shadows away from the flame, and the
// underside of the crown glows amber above it while the leaves higher up and further out, behind other leaves, stay in
// the cool night.
//
// How it is drawn: everything still is painted once per layout, in slices while the page is idle between the first
// frames, into two layers: the still tree (a hazy far canopy at half resolution under the dark near tree, and the ground at
// its foot) and the light of the candle at its brightest on the tree and the ground. A frame then costs almost nothing: the
// light layer's opacity follows the flame (the breath and the same flicker the flame has), and only the couple of hundred
// leaves nearest the light are drawn live so they can tremble. Now and then, on an out-breath, one lets go and drifts down.

/** Where the candle's light comes from, in CSS px in the viewport. */
export interface BodhiLight {
  x: number; y: number; // the flame's centre of light
  gx: number; gy: number; // the middle of the candle's foot on the ground
  r: number; rimH: number; // the candle's radius and the height of the rim that shades its own foot (low: a glass lets the light through)
  e: number; // how flat a circle on the ground looks: its height over its width
  reach: number; // how far across the ground (in px) its light carries before it is lost in the night
}
/** the foot of the trunk (CSS px in the viewport), the tree's scale (px per unit across and up), and the candle */
export interface BodhiAnchor { x: number; y: number; sx: number; sy: number; light: BodhiLight }
export interface BodhiOptions { canvas: HTMLCanvasElement; anchor: () => BodhiAnchor; sky: readonly string[]; reduce: boolean; seed?: number; lightMax?: number }
/** light: how strongly the flame burns now (0: unlit); lightMax (in the options) is the strength the light layer is painted
 * at; outp: how far through the out-breath (below 0 outside it, and while choosing), when a leaf may fall. layout: the
 * anchor has moved, so the tree is laid out and painted again. */
export interface Bodhi { update(t: number, k: number, sway: number, outp: number, dt: number, light: number): void; layout(): void; destroy(): void }

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
    roots.push({ x0: dx * 0.22, y0: -0.1, cx: dx * 0.5, cy: -0.03, x1: dx * 0.82 + (r() - 0.5) * 0.03, y1: dy + 0.01, w0: w, w1: 0.012 }); // short and stout: seen near, long thin roots read as cracks
  return { nodes, leaves, roots, billows };
}

// the tree is the same at every size, so it is grown once per page; the atlas once per device pixel ratio and sky
const trees = new Map<number, Tree>();
let atlasCache: { key: string; a: ReturnType<typeof buildAtlas> } | null = null;

const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const BARK_LIT: RGB = [226, 152, 96]; // the bark as the flame lights it at its brightest

export function createBodhi(o: BodhiOptions): Bodhi {
  const cv = o.canvas, host = cv.parentElement!, dpr = Math.min(2, window.devicePixelRatio || 1), seed = o.seed ?? 1121, LMAX = o.lightMax ?? 1;
  const skyC = mix([26, 20, 38], hex(o.sky[1]), 0.45); // the sky as the pause shows it, mixed down toward dusk
  // three layers: the still tree, far canopy and near (the host's canvas); the light of the candle on the tree and the
  // ground; the leaves that move. The last two cover only the part of the scene the candle's light can reach.
  const layer = (cls: string) => { const c = document.createElement('canvas'); c.className = cls; c.setAttribute('aria-hidden', 'true'); return c; };
  const litEl = layer('fb-bodhi-lit'), liveEl = layer('fb-bodhi-live'); host.append(litEl, liveEl);
  const lc = liveEl.getContext('2d')!;
  let W = 0, H = 0, ox = 0, oy = 0, sx = 1, sy = 1, sc = 1, leafPx = 24, lx = 0, ly = 0;
  // the candle, in host px: its foot (cgx, cgy), its radius CR and the rim RIM that shades its own foot; the flame's height
  // above the ground LH; how far in front of the trunk's axis it stands LZ; the trunk's radius at its foot rT0; e, how flat
  // the ground looks; REACH, how far its light carries across the ground
  let cgx = 0, cgy = 0, CR = 10, RIM = 12, LH = 20, LZ = 100, rT0 = 40, E = 0.3, Kn = 1, Eref = 1, REACH = 200;
  let lox = 0, loy = 0, lw = 0, lh = 0, lastOp = '';
  let live: Leaf[] = [], order: Leaf[] = [], dirty = true, destroyed = false, still = false;
  let tree: Tree | null = null, atlas: ReturnType<typeof buildAtlas> | null = null;
  let clr = [0, 0, 0, 0]; // the part of the moving layer drawn last frame, cleared before the next
  const X = (x: number) => ox + x * sx, Y = (y: number) => oy + y * sy;

  /**
   * How much of the flame's light reaches a point, 0..1 after a soft exposure. The light falls off with the square of the
   * distance and with the angle it strikes at; the candle's rim shades whatever is low and close to it.
   */
  const rimShade = (rho: number, h: number) => smooth(-0.3 * CR, 0.3 * CR, LH + (h - LH) * (CR / Math.max(rho, CR)) - RIM);
  /** A leaf of the crown, lit from below: inverse square, the angle onto its underside, and the leaves between it and the flame. */
  const leafLight = (px: number, py: number, x: number, y: number) => {
    const dx = px - lx, dh = ly - py, d2 = dx * dx + dh * dh + (LZ - rT0) ** 2; if (dh <= 0) return 0;
    const e = (dh / Math.sqrt(d2) / d2 / Eref) * Math.exp(-Math.max(0, under(x) - y) * 7);
    return 1 - Math.exp(-Math.pow(e, 1.2) * 1.9); // a soft exposure, a little steeper than linear so the far crown keeps its night
  };
  /** The bark: the trunk is a cylinder facing the candle, the limbs above face it and a little down, the roots face up. */
  const woodLight = (x: number, y: number) => {
    let px: number, ph: number, pz: number, nx: number, ny: number, nz: number, k = 1;
    const t = clamp01(((y - oy) / sy - 0.02) / (TRUNK_TOP - 0.03)), r = (trunkW(t) / 2) * sx, dx = x - X(trunkX(t));
    px = x; ph = Math.max(CR * 0.5, oy - y);
    if (y <= oy + 0.03 * sy && Math.abs(dx) < r) { pz = Math.sqrt(r * r - dx * dx); nx = dx / r; ny = 0; nz = pz / r; } // the trunk, down to its foot
    else if (y <= oy - 0.04 * sy) { pz = 0; nx = 0; ny = -0.33; nz = 0.94; } // limbs, and roots where they leave the trunk
    else { pz = rT0 + Math.max(0, y - oy) / E; nx = 0; ny = 0.94; nz = 0.33; k = 0.7; } // roots lying low on the ground in front of it
    const vx = cgx - px, vy = LH - ph, vz = LZ - pz, d2 = vx * vx + vy * vy + vz * vz, d = Math.sqrt(d2);
    const c = Math.max(0, ((nx * vx + ny * vy + nz * vz) / d + 0.12) / 1.12); // a little wrap: bark is rough and round
    const s = rimShade(Math.hypot(vx, vz), ph);
    return 1 - Math.exp(-((c * Kn) / d2) * s * k * 1.7);
  };
  /** The ground: light falling at a slant (cos³), the candle's own shade around its foot and the trunk's shadow behind it. */
  const groundLight = (x: number, y: number) => {
    const gz = LZ + (y - cgy) / E, dx = x - cgx, dz = gz - LZ, rho = Math.hypot(dx, dz);
    let e = (LH / Math.sqrt(rho * rho + LH * LH)) ** 3 * rimShade(rho, 0);
    // the trunk stands between the flame and the ground behind it
    const qx = x - cgx, qz = gz - LZ, cx = ox - cgx, cz = -LZ, qq = qx * qx + qz * qz;
    if (qq > 1) { const u = (cx * qx + cz * qz) / qq; if (u > 0 && u < 1) e *= smooth(rT0 * 0.85, rT0 * 1.25, Math.hypot(cx - u * qx, cz - u * qz)); }
    return (1 - Math.exp(-e * 6.5)) * (1 - smooth(0.62 * REACH, REACH, rho)); // and it is gone well before the edge of the layer
  };

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
  const outline = (g: CanvasRenderingContext2D, A: number[][], B: number[][], fill = true) => {
    g.beginPath(); g.moveTo(A[0][0], A[0][1]); for (const p of A) g.lineTo(p[0], p[1]); for (let i = B.length - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]); g.closePath(); if (fill) g.fill();
  };
  /** A root's two edges (and the height of its back above the ground at each step), in host px. */
  const rootEdges = (s: Root) => {
    const A: number[][] = [], B: number[][] = [], C: number[][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, u = 1 - t, px = u * u * s.x0 + 2 * u * t * s.cx + t * t * s.x1, py = u * u * s.y0 + 2 * u * t * s.cy + t * t * s.y1;
      const dx = (2 * u * (s.cx - s.x0) + 2 * t * (s.x1 - s.cx)) * sx, dy = (2 * u * (s.cy - s.y0) + 2 * t * (s.y1 - s.cy)) * sy, m = Math.hypot(dx, dy) || 1;
      // a root is never straight or even: it wanders a little and swells and narrows along its length
      const bend = Math.sin(Math.PI * t), wob = sc * 0.011 * Math.sin(t * 6.5 + s.x1 * 31) * bend, qx = X(px) - (dy / m) * wob, qy = Y(py) + (dx / m) * wob;
      const w = ((s.w0 + (s.w1 - s.w0) * Math.pow(t, 0.7)) * sc / 2) * (1 + 0.2 * Math.sin(t * 10 + s.x1 * 17) * bend);
      A.push([qx - (dy / m) * w, qy + (dx / m) * w]); B.push([qx + (dy / m) * w, qy - (dx / m) * w]); C.push([qx, qy, w]);
    }
    return { A, B, C };
  };
  const rootPoly = (g: CanvasRenderingContext2D, s: Root, fill = true) => { const { A, B } = rootEdges(s); outline(g, A, B, fill); };
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
  const mass = (g: CanvasRenderingContext2D, rgb: string, lit = false) => {
    // deep inside each billow a soft core of shade; then a faint disc behind every other leaf, so the shade follows the
    // foliage itself and can never show past it, thick where the leaves crowd and thin where they part. Lit, each is as
    // strong as the candle's light there, so the ember fades into the dark crown
    for (const [bx, by, br] of tree!.billows) {
      const a = lit ? leafLight(X(bx), Y(by + br * 0.5), bx, by + br * 0.5) : 1; if (a < 0.01) continue;
      g.save(); g.translate(X(bx), Y(by - 0.04)); g.scale(sx, sy);
      const m = g.createRadialGradient(0, 0, 0, 0, 0, br * 0.66); m.addColorStop(0, `rgba(${rgb},${0.75 * a})`); m.addColorStop(0.6, `rgba(${rgb},${0.55 * a})`); m.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = m; g.beginPath(); g.arc(0, 0, br * 0.66, 0, 6.283); g.fill(); g.restore();
    }
    g.fillStyle = `rgba(${rgb},0.2)`; const ls = tree!.leaves;
    for (let i = 0; i < ls.length; i += 2) {
      const l = ls[i]; if (lit) { if (l.lb < 0.02) continue; g.globalAlpha = Math.min(1, l.lb * 1.3); }
      if (l.px < -leafPx * 2 || l.px > W + leafPx * 2 || l.py < -leafPx * 2 || l.py > H + leafPx * 2) continue; // out of the window
      const z = leafPx * l.s * (l.layer === 2 ? 1.12 : 1); g.beginPath(); g.arc(l.px - Math.sin(l.a) * z * 0.6, l.py + Math.cos(l.a) * z * 0.6, z * 0.42, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  };
  const size = (c: HTMLCanvasElement, w: number, h: number, s = 1) => { c.width = Math.max(1, Math.round(w * dpr * s)); c.height = Math.max(1, Math.round(h * dpr * s)); const g = c.getContext('2d')!; g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0); return g; };

  /**
   * Lays the tree out for this viewport and queues the painting: the far canopy, the dark tree and the ground at its foot,
   * then the light of the candle (see paintLight). The work is cut into slices painted straight into the layers while the
   * page is idle; opening the pause never waits on it, and it is all there within the first second or so, while the pause
   * fades in and the candle is chosen.
   */
  let jobs: (() => number)[] = [], slowest = 0, bakeStart = 0, treeReady = false;
  let rc = { left: 0, top: 0 }, groundY = 0;
  const slices = <L,>(arr: L[], n: number, f: (x: L) => void) => { for (let i = 0; i < arr.length; i += n) { const a = i; jobs.push(() => { const e = Math.min(arr.length, a + n); for (let j = a; j < e; j++) f(arr[j]); return e - a; }); } };
  const near = (l: Leaf) => leafPx * l.s * (l.layer === 2 ? 1.12 : 1);
  // only what is in the window is painted: the crown runs out well past its edges
  const onScreen = (x: number, y: number, m: number) => x > -m && x < W + m && y > -m && y < H + m;

  /** The candle's light, in host px, and everything worked out from it: how lit each leaf is, and the part of the scene it reaches. */
  const placeLight = () => {
    const L = o.anchor().light, T = tree!;
    // the candle stands on the ground in front of the trunk: the light's place in the scene, in host px
    lx = L.x - rc.left; ly = L.y - rc.top; cgx = L.gx - rc.left; cgy = L.gy - rc.top; CR = L.r; RIM = L.rimH; E = L.e; LH = cgy - ly; REACH = L.reach;
    rT0 = (trunkW(0.12) / 2) * sx; LZ = rT0 + Math.max(CR, (cgy - oy) / E); // the ground in front of the trunk: z = rT0 + (y - oy) / E
    { const dz = LZ - (trunkW(0.05) / 2) * sx; Kn = dz * dz; } // the bark straight behind the flame is lit to 1
    { const dh = ly - Y(under(0) + 0.02), d2 = dh * dh + (LZ - rT0) ** 2; Eref = dh / Math.sqrt(d2) / d2; } // and the middle of the crown's underside
    for (const l of T.leaves) { l.d = Math.hypot(l.px - lx, l.py - ly); l.lb = leafLight(l.px, l.py, l.x, l.y) * (l.layer === 2 ? 1 : 0.72); }
    // the part of the scene the light reaches: the lit leaves, the trunk and roots, and the pool of light on the ground
    let bx0 = Math.min(cgx - REACH, X(-0.42)), bx1 = Math.max(cgx + REACH, X(0.42)), by0 = Y(-0.5), by1 = Math.max(cgy + REACH * E, Y(0.08));
    for (const l of T.leaves) if (l.lb > 0.012) { const z = leafPx * 1.4; bx0 = Math.min(bx0, l.px - z); bx1 = Math.max(bx1, l.px + z); by0 = Math.min(by0, l.py - z); by1 = Math.max(by1, l.py + z); }
    lox = Math.max(0, Math.floor(bx0)); loy = Math.max(0, Math.floor(by0)); lw = Math.max(1, Math.min(W, Math.ceil(bx1)) - lox); lh = Math.max(1, Math.min(H, Math.ceil(by1)) - loy);
  };

  const build = () => {
    // measured on the host, which never moves, so the size is not thrown off by anything drawn over it
    const hr = host.getBoundingClientRect(); W = host.clientWidth; H = host.clientHeight; if (!W || !H) return;
    rc = { left: hr.left, top: hr.top };
    bakeStart = performance.now(); slowest = 0; treeReady = false;
    tree = trees.get(seed) ?? growTree(seed); trees.set(seed, tree);
    const key = `${dpr}|${o.sky[1]}`; if (!atlasCache || atlasCache.key !== key) atlasCache = { key, a: buildAtlas(dpr, skyC) }; atlas = atlasCache.a;
    const an = o.anchor(), T = tree;
    ox = an.x - rc.left; oy = an.y - rc.top; sx = an.sx; sy = an.sy; sc = Math.sqrt(sx * sy);
    // the leaves keep their size against the tree, so a tree seen near has larger leaves, not a sparser crown
    leafPx = Math.max(10.5, Math.min(42, sc * 0.042));
    for (const l of T.leaves) { l.px = X(l.x); l.py = Y(l.y); }
    placeLight();
    // the leaves that move are the near ones the light reaches: they catch it and tremble; the rest are baked
    live = T.leaves.filter(l => l.layer === 2 && l.lb > 0.22 && onScreen(l.px, l.py, leafPx)).sort((a, b) => b.lb - a.lb).slice(0, 200).sort((a, b) => a.py - b.py);
    const isLive = new Set(live); order = T.leaves.filter(l => !isLive.has(l)).sort((a, b) => a.layer - b.layer);
    // for the tests, and the page: where the trunk stands and how big it is, in CSS px in the viewport
    cv.dataset.foot = `${an.x.toFixed(1)},${an.y.toFixed(1)}`; cv.dataset.fork = (rc.top + Y(TRUNK_TOP)).toFixed(1); cv.dataset.trunk = (trunkW(0.5) * sx).toFixed(1);
    groundY = oy - 0.05 * sy; // where the ground meets the night behind the tree, a little behind its foot

    const far = document.createElement('canvas'), fg = size(far, W, H, 0.5), d = size(cv, W, H);
    jobs = [];
    // far canopy: the same tree mirrored and set back, at half resolution so it is soft, hazed with the sky
    const fs = dpr * 0.5, fx = (x: number) => X(-x * 1.1 + 0.05), fy = (y: number) => Y(y * 1.05 - 0.03);
    const farLeaf: Leaf = { x: 0, y: 0, s: 1, a: 0, f: 1, layer: 0, v: 0, ph: 0, wx: 1, px: 0, py: 0, d: 0, lb: 0 };
    slices(T.leaves.filter((l, i) => !(i % 2) && onScreen(fx(l.x), fy(l.y), leafPx * 2)), 900, l => { farLeaf.f = l.f; farLeaf.wx = l.wx; drawLeaf(fg, farLeaf, fx(l.x), fy(l.y), -l.a, 0, leafPx * 1.15 * l.s, fs); });
    // then the near tree in shadow over it: the ground at its foot, the crown's body, roots, fluted trunk, limbs and twigs
    jobs.push(() => {
      fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = css(skyC, 0.16); fg.fillRect(0, 0, far.width, far.height);
      d.setTransform(dpr, 0, 0, dpr, 0, 0); d.globalAlpha = 0.6; d.drawImage(far, 0, 0, W, H); d.globalAlpha = 1; far.width = far.height = 0;
      paintGround(d);
      const bark = '#160F1D', ground = d.createRadialGradient(ox, oy, 0, ox, oy, sc * 0.6); ground.addColorStop(0, 'rgba(8,5,11,0.7)'); ground.addColorStop(1, 'rgba(8,5,11,0)');
      d.save(); d.translate(ox, oy); d.scale(1, 0.12); d.translate(-ox, -oy); d.fillStyle = ground; d.beginPath(); d.arc(ox, oy, sc * 0.6, 0, 6.283); d.fill(); d.restore();
      mass(d, '20,15,29');
      // moonlight, from high on the left: the same wood a hair up and to the left in a cool grey, so the bark drawn over it
      // leaves a thin rim on the edges that face the moon
      const moon = 'rgba(146,144,196,0.22)', mo = Math.max(1, sc * 0.0028);
      d.save(); d.translate(-mo, -mo * 0.55); d.fillStyle = 'rgba(146,144,196,0.14)'; for (const s of T.roots) rootPoly(d, s);
      d.fillStyle = moon; trunkPoly(d); drawWood(d, moon, (x, y) => [X(x), Y(y)], sc, 0.016); d.restore();
      d.fillStyle = bark; for (const s of T.roots) rootPoly(d, s); trunkPoly(d); drawWood(d, bark, (x, y) => [X(x), Y(y)], sc);
      // the trunk's flutes, soft: seen near, sharp grooves would read as strokes of a pen
      d.save(); d.filter = `blur(${Math.max(1, sc * 0.004).toFixed(1)}px)`; flutes(d, 'rgba(6,4,10,0.26)', 0, Math.max(1.5, sc * 0.012)); d.restore();
      return 700;
    });
    slices(order.filter(l => onScreen(l.px, l.py, leafPx * 1.5)), 700, l => drawLeaf(d, l, l.px, l.py, l.a, 0, near(l)));
    jobs.push(() => { treeReady = true; return 0; });
    paintLight();
    schedule();
  };
  /** Lay the tree out again: it is grown and laid out in the first idle slice, not in a frame. */
  const relayout = () => { dirty = false; still = false; treeReady = false; unschedule(); jobs = [() => { build(); return 0; }]; schedule(); };

  /**
   * The ground at the tree's foot, under the night: dark earth, mottled where it dips and rises, with short grass growing in
   * patches, the tufts small towards the back and larger in front, and a little of the night's cool on some of their tips.
   * It thins out before the words below.
   */
  const paintGround = (d: CanvasRenderingContext2D) => {
    const gr = rng(seed + 11), y0 = groundY, y1 = Math.min(H, cgy + REACH * E * 0.8), k = Math.max(0.7, sc / 700);
    d.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < 46; i++) { // the earth: soft low swells and hollows, flattened by the angle we see it at
      const depth = gr(), y = y0 + depth * (y1 - y0), x = gr() * W, r = (30 + depth * 100) * k, light = gr() < 0.5;
      d.save(); d.translate(x, y); d.scale(1, 0.22); const m = d.createRadialGradient(0, 0, 0, 0, 0, r);
      m.addColorStop(0, light ? 'rgba(40,28,46,0.16)' : 'rgba(5,3,8,0.14)'); m.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = m; d.fillRect(-r, -r, 2 * r, 2 * r); d.restore();
    }
    d.lineCap = 'round';
    const patches = Math.round(W / 18);
    for (let i = 0; i < patches; i++) {
      const depth = gr() ** 1.25, py = y0 + 3 + depth * (y1 - y0), px = gr() * W, n = 2 + Math.floor(gr() * 8), spread = (6 + depth * 34) * k;
      for (let j = 0; j < n; j++) {
        const x = px + (gr() - 0.5) * spread * 2, y = py + (gr() - 0.5) * spread * 0.25, h = (1.5 + depth * 5) * (0.55 + gr() * 0.8) * k;
        const blades = 2 + Math.floor(gr() * 3);
        d.strokeStyle = `rgba(8,5,12,${(0.6 + 0.35 * gr()).toFixed(2)})`; d.lineWidth = Math.max(0.6, h * 0.11);
        d.beginPath();
        for (let b = 0; b < blades; b++) { const lean = (gr() - 0.5) * h * 1.1, bx = x + (b - blades / 2) * h * 0.13; d.moveTo(bx, y); d.quadraticCurveTo(bx + lean * 0.25, y - h * 0.6, bx + lean, y - h * (0.65 + gr() * 0.45)); }
        d.stroke();
        if (gr() < 0.22) { d.strokeStyle = 'rgba(150,148,200,0.1)'; d.lineWidth = Math.max(0.5, h * 0.06); d.beginPath(); d.moveTo(x, y - h * 0.45); d.lineTo(x - h * 0.1, y - h * 0.8); d.stroke(); }
      }
    }
  };

  /**
   * The light of the candle at its brightest, painted into its own layer: on the ground (with the shadows of the roots and
   * the trunk), on the roots and the bark, and through the lower crown. Its slices follow the tree's.
   */
  const paintLight = () => {
    const T = tree!, g = size(litEl, lw, lh); size(liveEl, lw, lh); clr = [0, 0, liveEl.width, liveEl.height];
    for (const el of [litEl, liveEl]) Object.assign(el.style, { left: `${lox}px`, top: `${loy}px`, width: `${lw}px`, height: `${lh}px` });
    litEl.style.opacity = lastOp = '0';
    // the light, worked out point by point at half resolution (it is smooth): how lit the bark would be there, and the ground
    const ms = 0.5, mw = Math.max(1, Math.ceil(lw * ms)), mh = Math.max(1, Math.ceil(lh * ms));
    const wm = document.createElement('canvas'), gm = document.createElement('canvas'); wm.width = gm.width = mw; wm.height = gm.height = mh;
    const wImg = new ImageData(mw, mh), gImg = new ImageData(mw, mh);
    // only where there is something to light: the wood within reach of the flame (beyond it the light on the outer limbs fades
    // to nothing), and the ground within its reach
    const wx0 = X(-0.72), wx1 = X(0.72), wy0 = Y(-0.62), gx0 = cgx - REACH, gx1 = cgx + REACH, gy0 = cgy - REACH * E, ROWS = 16;
    for (let r0 = 0; r0 < mh; r0 += ROWS) {
      const a = r0; jobs.push(() => {
        const e = Math.min(mh, a + ROWS), wd = wImg.data, gd = gImg.data;
        for (let j = a; j < e; j++) {
          const y = loy + (j + 0.5) / ms;
          for (let i = 0; i < mw; i++) {
            const x = lox + (i + 0.5) / ms, p = (j * mw + i) * 4, inWood = y > wy0 && x > wx0 && x < wx1, inGround = y > gy0 && x > gx0 && x < gx1;
            wd[p] = 255; wd[p + 1] = 255; wd[p + 2] = 255; gd[p] = 236; gd[p + 1] = 156; gd[p + 2] = 92;
            if (!inWood && !inGround) continue;
            // nothing of the light may reach the layer's own edge (unless that is the window's edge), or its square would show
            const fade = smooth(0, 24, Math.min(lox > 0 ? x - lox : 1e9, lox + lw < W ? lox + lw - x : 1e9, loy > 0 ? y - loy : 1e9, loy + lh < H ? loy + lh - y : 1e9));
            if (inWood) wd[p + 3] = (woodLight(x, y) * fade * (1 - smooth(0.5, 0.72, Math.abs(x - ox) / sx)) * 255) | 0;
            if (inGround) gd[p + 3] = (groundLight(x, y) * fade * 0.72 * 255) | 0;
          }
        }
        return (e - a) * mw / 40;
      });
    }
    // the lit wood: the bark at the flame's full light, with its folds and the roots' far sides in shade, seen through how
    // much of the light reaches each point; the crown's shade glows a deep ember behind it where the light reaches
    jobs.push(() => {
      const wctx = wm.getContext('2d')!; wctx.putImageData(wImg, 0, 0); gm.getContext('2d')!.putImageData(gImg, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, -lox * dpr, -loy * dpr); g.fillStyle = css(BARK_LIT);
      for (const s of T.roots) {
        const { A, B, C } = rootEdges(s); outline(g, A, B);
        // the root is round: its far side from the flame turns away into shade
        const m = C[4], vx = m[0] - cgx, vy = (m[1] - cgy) / E, vm = Math.hypot(vx, vy) || 1, sh = m[2] * 0.55;
        g.save(); outline(g, A, B, false); g.clip(); g.filter = `blur(${(sh * 0.5 * dpr).toFixed(1)}px)`;
        g.translate((vx / vm) * sh, (vy / vm) * sh * E + sh * 0.3); g.fillStyle = 'rgba(46,22,24,0.66)'; outline(g, A, B); g.restore();
        g.fillStyle = css(BARK_LIT);
      }
      trunkPoly(g); drawWood(g, css(BARK_LIT), (x, y) => [X(x), Y(y)], sc);
      // the bark's grain: short uneven streaks running up the trunk, only where there is wood
      g.globalCompositeOperation = 'source-atop'; g.lineCap = 'round'; const br = rng(seed + 3);
      for (let i = 0; i < 320; i++) {
        const t = br() * 0.95, u = (br() - 0.5) * 0.92, x = X(trunkX(t) + u * trunkW(t)), y = Y(0.02 + (TRUNK_TOP - 0.03) * t), len = sy * (0.015 + br() * 0.05);
        g.strokeStyle = br() < 0.62 ? `rgba(50,22,20,${(0.12 + br() * 0.18).toFixed(2)})` : `rgba(255,222,176,${(0.05 + br() * 0.08).toFixed(2)})`; g.lineWidth = (0.6 + br() * 1.4) * Math.max(1, sc / 600);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (br() - 0.5) * 3, y - len / 2, x + (br() - 0.5) * 2, y - len); g.stroke();
      }
      // where the trunk and the roots meet the ground the light cannot get in: a soft shade along the foot
      const foot = g.createLinearGradient(0, Y(0.03), 0, Y(-0.05)); foot.addColorStop(0, 'rgba(30,14,18,0.75)'); foot.addColorStop(1, 'rgba(30,14,18,0)');
      g.fillStyle = foot; g.fillRect(X(-0.5), Y(-0.05), sx, sy * 0.08);
      // the fluted bark: soft dark grooves and a warm ridge beside each, the candle catching the folds
      g.filter = `blur(${(Math.max(1, sc * 0.006) * dpr).toFixed(1)}px)`;
      flutes(g, 'rgba(60,26,24,0.34)', 0, Math.max(2, sc * 0.02)); flutes(g, 'rgba(255,214,160,0.12)', Math.max(1, sc * 0.012), Math.max(1, sc * 0.008));
      g.filter = 'none'; g.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.imageSmoothingQuality = 'high'; g.drawImage(wm, 0, 0, litEl.width, litEl.height);
      g.globalCompositeOperation = 'destination-over'; g.setTransform(dpr, 0, 0, dpr, -lox * dpr, -loy * dpr); mass(g, '112,48,38', true);
      g.globalCompositeOperation = 'source-over'; wm.width = wm.height = 0;
      return 700;
    });
    // the ground: the pool of light, a few fallen leaves and the grain of the earth in it, and the shadows of the roots
    // thrown away from the flame; it goes in behind the wood. Only the band of the layer where the ground is (from a little
    // behind the trunk's foot down) is painted, in two slices.
    const gTop = Math.max(loy, Math.floor(Math.min(cgy - REACH * E, oy - 0.12 * sy))), gH = loy + lh - gTop;
    let pc: HTMLCanvasElement, p: CanvasRenderingContext2D;
    jobs.push(() => {
      pc = document.createElement('canvas'); pc.width = litEl.width; pc.height = Math.max(1, Math.round(gH * dpr)); p = pc.getContext('2d')!;
      const gy = (gTop - loy) * ms; p.imageSmoothingQuality = 'high'; p.drawImage(gm, 0, gy, mw, mh - gy, 0, 0, pc.width, pc.height); gm.width = gm.height = 0;
      p.setTransform(dpr, 0, 0, dpr, -lox * dpr, -gTop * dpr);
      // grain: specks of earth and grit, only seen where the light falls (the dark ones bite into the light, the light ones catch it)
      const r = rng(seed + 7), dark = new Path2D(); p.fillStyle = 'rgba(255,206,150,0.22)';
      for (let i = 0; i < 1100; i++) {
        const a = r() * 6.283, rho = REACH * (0.1 + 0.9 * Math.sqrt(r())), x = cgx + Math.cos(a) * rho, y = cgy + Math.sin(a) * rho * E;
        const gl = groundLight(x, y), isDark = r() < 0.6, sw = 0.5 + r() * 1.1, sh2 = 0.4 + r() * 0.6; if (gl < 0.02) continue;
        if (isDark) dark.rect(x, y, sw, sh2); else { p.globalAlpha = Math.min(1, gl * 1.4); p.fillRect(x, y, sw, sh2); }
      }
      p.globalAlpha = 0.45; p.globalCompositeOperation = 'destination-out'; p.fillStyle = '#000'; p.fill(dark); p.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 30; i++) { // fallen leaves lying flat, lit as the ground is
        const a = r() * 6.283, rho = REACH * (0.15 + 0.6 * r()), x = cgx + Math.cos(a) * rho, y = cgy + Math.sin(a) * rho * E;
        const gl = groundLight(x, y); if (gl < 0.04) continue;
        const ang = r() * 6.283, c = Math.cos(ang), s = Math.sin(ang), z = leafPx * (0.8 + r() * 0.35), lv = Math.round(clamp01(0.22 + 0.45 * gl) * (LEVELS - 1)), row = 1 + VARIANTS + Math.floor(r() * VARIANTS);
        p.globalAlpha = Math.min(1, gl * 1.5); p.setTransform(dpr * c, dpr * s * E, -dpr * s, dpr * c * E, (x - lox) * dpr, (y - gTop) * dpr);
        p.drawImage(atlas!.c, lv * atlas!.cw, row * atlas!.ch, atlas!.cw, atlas!.ch, -z * 0.34, -z * 0.5, z * 0.68, z * 1.06);
      }
      p.globalAlpha = 1;
      return 700;
    });
    jobs.push(() => {
      // the roots' shadows: each point along a root, at the height of its back, cast along the ground away from the flame
      // (at half resolution: they are soft anyway, and blurring at full size was the slowest part of the painting)
      const sh = document.createElement('canvas'); sh.width = Math.ceil(pc.width / 2); sh.height = Math.ceil(pc.height / 2); const s = sh.getContext('2d')!; s.setTransform(dpr / 2, 0, 0, dpr / 2, -lox * dpr / 2, -gTop * dpr / 2); s.fillStyle = '#000';
      const cast = (x: number, y: number, h: number) => {
        const gz = y > oy ? rT0 + (y - oy) / E : rT0, hh = y > oy ? h : h + (oy - y), f = Math.min(5, hh / Math.max(1, LH - hh));
        const gx = x + (x - cgx) * f, gzz = gz + (gz - LZ) * f; return [gx, oy + (gzz - rT0) * E];
      };
      for (const rt of T.roots) {
        const { A, B, C } = rootEdges(rt), A2 = A.map((q, i) => cast(q[0], q[1], C[i][2] * 1.1)), B2 = B.map((q, i) => cast(q[0], q[1], C[i][2] * 1.1));
        outline(s, A, B); outline(s, A2, B2);
        for (let i = 0; i < A.length - 1; i++) for (const [P, Q] of [[A, A2], [B, B2]]) { s.beginPath(); s.moveTo(P[i][0], P[i][1]); s.lineTo(P[i + 1][0], P[i + 1][1]); s.lineTo(Q[i + 1][0], Q[i + 1][1]); s.lineTo(Q[i][0], Q[i][1]); s.closePath(); s.fill(); }
      }
      s.setTransform(1, 0, 0, 1, 0, 0); s.filter = `blur(${(Math.max(1, sc * 0.004) * dpr).toFixed(1)}px)`; s.globalCompositeOperation = 'copy'; s.drawImage(sh, 0, 0); s.filter = 'none';
      p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'destination-out'; p.globalAlpha = 0.9; p.imageSmoothingQuality = 'high'; p.drawImage(sh, 0, 0, pc.width, pc.height); p.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-over'; g.drawImage(pc, 0, Math.round((gTop - loy) * dpr)); g.globalCompositeOperation = 'source-over';
      pc.width = pc.height = sh.width = sh.height = 0;
      return 700;
    });
    // and the leaves as the light finds them: every leaf over this part of the scene, so the lit layer covers what the dark one does
    const inLit = (l: Leaf) => l.px > lox - leafPx * 1.5 && l.px < lox + lw + leafPx * 1.5 && l.py > loy - leafPx * 1.5 && l.py < loy + lh + leafPx * 0.5;
    slices(order.filter(inLit), 700, l => drawLeaf(g, l, l.px - lox, l.py - loy, l.a, Math.round(l.lb * (LEVELS - 1)), near(l)));
    jobs.push(() => { still = false; cv.dataset.readyMs = (performance.now() - bakeStart).toFixed(0); return 0; });
  };
  /** The baking runs between frames, while the page is idle (or after 120 ms at the latest), a few slices at a time, so no
   * frame of the breath ever waits on it. */
  let idle = 0;
  const ric = 'requestIdleCallback' in window ? window.requestIdleCallback.bind(window) : null; // (not in older Safari)
  const schedule = () => { if (idle || destroyed || !jobs.length) return; idle = ric ? ric(bake, { timeout: 120 }) : window.setTimeout(bake, 16); };
  const unschedule = () => { if (!idle) return; if (ric) window.cancelIdleCallback(idle); else window.clearTimeout(idle); idle = 0; };
  const bake = (dl?: IdleDeadline) => {
    idle = 0; if (destroyed) return;
    const t0 = performance.now(), more = () => (dl && !dl.didTimeout ? dl.timeRemaining() > 2 : performance.now() - t0 < 6);
    do jobs.shift()!(); while (jobs.length && more());
    slowest = Math.max(slowest, performance.now() - t0); cv.dataset.buildMs = slowest.toFixed(1);
    schedule();
  };

  // a leaf that lets go, about once every two or three breaths, and a few fireflies
  let fall: Falling | null = null, lastOut = -1, cycles = 0, nextFall = 1, lastLight = -1;
  const fr = rng(seed + 99), flies = Array.from({ length: 7 }, () => ({ x: (fr() - 0.5) * 1.5, y: -0.22 - fr() * 0.5, ph: fr() * 6.283, sp: 0.6 + fr() * 0.8 }));
  const fallLeaf: Leaf = { x: 0, y: 0, s: 1, a: 0, f: 1, layer: 2, v: 1, ph: 0, wx: 1, px: 0, py: 0, d: 0, lb: 0 };

  const update = (t: number, _k: number, _sway: number, outp: number, dt: number, light: number) => {
    if (dirty) { relayout(); return; }
    // the candle's light: the lit layer, painted at the flame's brightest, shows as strongly as the flame burns now
    const Ln = clamp01(light / LMAX), op = Ln.toFixed(3); if (op !== lastOp && !jobs.length) { litEl.style.opacity = op; lastOp = op; }
    const breeze = outp >= 0 && !o.reduce ? Math.sin(Math.PI * Math.min(1, outp * 1.35)) : 0, front = -1.2 + 2.4 * Math.max(0, outp);
    if (outp >= 0 && lastOut < 0 && !o.reduce) { cycles++; if (!fall && cycles >= nextFall) { fall = { x: (fr() - 0.5) * 1.2, y: -0.44 - fr() * 0.2, spin: (fr() - 0.5) * 2, s: 1 + fr() * 0.3, v: 26 + fr() * 12, ph: fr() * 6.283, age: 0 }; nextFall = cycles + 2 + (fr() < 0.5 ? 1 : 0); } }
    lastOut = outp;

    // the moving layer, once the tree is painted: clear what was drawn last time, then the trembling leaves, the fireflies
    // (only while the candle burns) and the falling leaf
    if (!treeReady) return;
    const g = lc; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(clr[0], clr[1], clr[2] - clr[0], clr[3] - clr[1]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const grow = (x: number, y: number, r: number) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const l of live) {
      const size = leafPx * l.s * 1.12; let ang = l.a, off = 0;
      if (!o.reduce) {
        ang += 0.07 * Math.sin(t * 1.6 + l.ph) + 0.035 * Math.sin(t * 3.3 + l.ph * 1.7);
        if (breeze > 0) { const e = l.x - front, env = Math.exp(-e * e * 5) * breeze; ang += env * (0.25 * Math.sin(t * 6 + l.ph) + 0.08); off = env * 2; }
      }
      drawLeaf(g, l, l.px + off - lox, l.py + off * 0.3 - loy, ang, Math.round(clamp01(l.lb * Ln) * (LEVELS - 1)), size); grow(l.px - lox, l.py - loy + size * 0.5, size * 1.1);
    }
    if (!o.reduce && Ln > 0.01) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const x = X(f.x) + Math.sin(t * 0.21 * f.sp + f.ph) * sy * 0.12 - lox, y = Y(f.y) + Math.sin(t * 0.17 * f.sp + f.ph * 2) * sy * 0.07 - loy;
        const a = Math.max(0, Math.sin(t * 0.9 * f.sp + f.ph)) ** 3 * 0.7 * clamp01(Math.min(x, y, lw - x, lh - y) / 30) * Math.min(1, Ln * 2); if (a < 0.03) continue;
        const rg = g.createRadialGradient(x, y, 0, x, y, 4.5); rg.addColorStop(0, `rgba(236,240,170,${a.toFixed(3)})`); rg.addColorStop(0.35, `rgba(220,230,130,${(a * 0.4).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,220,120,0)');
        g.fillStyle = rg; g.fillRect(x - 5, y - 5, 10, 10); grow(x, y, 6);
      }
      g.globalCompositeOperation = 'source-over';
    }
    // the falling leaf: it rocks as it drifts down past the flame and catches the light as it turns
    if (fall && !o.reduce) {
      fall.age += dt; const sw = Math.sin(fall.age * 2.1 + fall.ph);
      const px = X(fall.x) + Math.sin(fall.age * 0.8 + fall.ph) * 40 + sw * 16, py = Y(fall.y) + fall.age * fall.v * Math.max(1, sy / 500);
      const ang = sw * 0.9 + fall.spin * fall.age * 0.5, face = 0.55 + 0.45 * Math.abs(Math.cos(ang));
      const I = clamp01(leafLight(px, py, fall.x, 0) * face * 1.2 * Ln), fade = clamp01((oy + 24 - py) / 50), size = leafPx * 1.2 * fall.s;
      if (fade > 0) { g.globalAlpha = fade; drawLeaf(g, fallLeaf, px - lox, py - loy, ang, Math.round(I * (LEVELS - 1)), size); g.globalAlpha = 1; grow(px - lox, py - loy + size * 0.5, size * 1.2); }
      if (fade <= 0 || py > H + 40) fall = null;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    clr = x1 > x0 ? [Math.max(0, Math.floor(x0 * dpr) - 2), Math.max(0, Math.floor(y0 * dpr) - 2), Math.min(liveEl.width, Math.ceil(x1 * dpr) + 2), Math.min(liveEl.height, Math.ceil(y1 * dpr) + 2)] : [0, 0, 0, 0];
    // with reduced motion nothing moves, so once all is painted the tree is left alone until the light changes
    if (o.reduce && !jobs.length) { still = true; lastLight = light; }
  };
  const ro = new ResizeObserver(() => { dirty = true; still = false; }); ro.observe(cv);
  return {
    update(t, k, sway, outp, dt, light) {
      if (destroyed) return;
      if (still && light !== lastLight) still = false; // reduced motion: lighting the candle still lights the tree
      if (!still) update(t, k, sway, outp, dt, light);
    },
    layout() { dirty = true; still = false; },
    destroy() {
      // stop at once; let the tree fade out with the pause, then hand back the canvases' memory
      destroyed = true; ro.disconnect(); unschedule(); live = []; order = []; jobs = [];
      window.setTimeout(() => { for (const c of [litEl, liveEl, cv]) { c.width = 0; c.height = 0; } litEl.remove(); liveEl.remove(); }, o.reduce ? 0 : 450);
    },
  };
}
