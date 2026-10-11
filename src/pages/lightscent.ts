import { MOMENTS, MOODS, SCENT_MOOD, type Mood, type Moment } from '../config';
import { esc, toast } from '../ui';
import { loadCatalogue, findLive, money, hasClient, type Item } from '../wix';
import { add } from '../cart';
import '../lightscent.css';

// ======================================================================
// Light & Scent: the one-minute breathing pause.
// The candle brings the light, the diffuser brings the scent, and the breath moves between them. A night sky; two gold-framed
// arches low on the screen with a real candle photograph (public/img/studio) on the left and the diffuser of the hour on the
// right. You hold to light the candle (a match-spark travels to the wick, the flame catches, warm light floods the arch and
// then the sky). Then six breaths of 4 in / 6 out: breathing in, a ribbon of scent rises from the reeds and flows in a long
// S-curve across the sky towards you (a canvas particle field in the colour of the hour's mood, moved by curl noise along a
// bezier path); breathing out, it carries on into the flame, which swells and brightens, the whole scene warms, and the
// scent that reaches the flame rises again as gold embers. Each breath leaves one new star; after six they join as a
// constellation. The ending lifts both arches and offers the pair from the live catalogue (never a past pour).
// One rAF loop drives everything (canvas, three custom properties, the words); it pauses when the tab is hidden.
// Test hooks kept from the earlier pauses: .jbreathe(.open), role=dialog, #jbWord, .jb-close, "?breath=fast" (10x speed).
// Styles: src/lightscent.css. Tests: e2e/lightscent.mjs.
// ======================================================================

/** DRAFT FOR CLAIRE: every word on the screen. The rhythm is only ever described as "4 in, 6 out". */
const COPY = {
  title: 'Light & Scent',
  startWord: 'Hold to light', startSub: 'the candle', startHint: 'Press and hold anywhere, or tap once.',
  startPill: 'Hold to light',
  inWord: 'Breathe in', inSub: 'the scent',
  outWord: 'Breathe out', outSub: 'into the light',
  endEyebrow: 'One minute, kept', endTitle: 'Light & scent', endLine: 'One for the light, one for the scent.',
  endNote: 'The minute you just had, whenever you need it.',
  again: 'Breathe again', reset: 'Or try Claire’s free 7-day reset', candles: 'See the candles', ariaLabel: 'Light & Scent: a one-minute pause',
};
const BREATHS = 6;

/** Real studio photographs of lit candles. wick: where the wooden wick sits in the picture (fractions); tip: how high its own flame reaches; pos: object-position of the crop in the arch. */
interface CandlePhoto { src: string; wick: [number, number]; tip: number; pos: [number, number] }
const CANDLE_PHOTOS: Record<'forest' | 'cabana' | 'verdant', CandlePhoto> = {
  forest: { src: '/img/studio/midnight-forest-lit.jpg', wick: [0.405, 0.392], tip: 0.245, pos: [0.19, 0.45] },
  cabana: { src: '/img/studio/cabana-candles.jpg', wick: [0.666, 0.35], tip: 0.262, pos: [1, 0.22] },
  verdant: { src: '/img/studio/verdant-candles.jpg', wick: [0.748, 0.36], tip: 0.272, pos: [1, 0.22] },
};
const CANDLE_BY_MOOD: Record<Mood, keyof typeof CANDLE_PHOTOS> = { woody: 'forest', floral: 'forest', sunny: 'cabana', fresh: 'cabana', grounding: 'verdant' };
/** The diffuser render: reeds rise from the bottle at (0.5, 0.68) to their tips near the top of the picture. */
const DIFFUSER = { pos: [0.5, 0.18] as [number, number], reeds: { x0: 0.45, x1: 0.6, y0: 0.03, y1: 0.42 } };
const diffuserSrc = (scent: string) => `/img/diffuser-${scent.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.jpg`;
/** The ribbon's colours per mood (config MOODS swatches lifted to luminous, plus the celestial --star-* tokens as the highlight). */
const RIBBON: Record<Mood, [string, string]> = { woody: ['#E9B27A', '#FFE0B8'], grounding: ['#9FC49A', '#DCEFD2'], fresh: ['#8CC9BF', '#D6F0EA'], sunny: ['#F0B65C', '#FFE6AE'], floral: ['#DA8F80', '#FFD8CC'] };

const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const sineInOut = (t: number) => { t = Math.min(1, Math.max(0, t)); return 0.5 - 0.5 * Math.cos(Math.PI * t); };
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- value noise (1D for the flicker, 3D for the curl field): small, seeded, no dependencies
const hash = (x: number, y: number, z: number) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000; };
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c00 = l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), c10 = l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u);
  const c01 = l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), c11 = l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u);
  return l(l(c00, c10, v), l(c01, c11, v), w) * 2 - 1;
}
const noise1 = (t: number, seed = 0) => noise3(t, seed * 7.31, 0.5);
/** The curl of the noise field: a divergence-free flow, so the scent swirls like smoke instead of scattering. */
function curl(x: number, y: number, z: number, out: [number, number]) {
  const e = 0.35, s = 1 / 110;
  const dy = noise3(x * s, (y + e) * s, z) - noise3(x * s, (y - e) * s, z), dx = noise3((x + e) * s, y * s, z) - noise3((x - e) * s, y * s, z);
  out[0] = dy / (2 * e * s); out[1] = -dx / (2 * e * s);
}

// ---- a cubic bezier path in two segments: reeds -> the centre of the sky (in-breath), centre -> the flame (out-breath)
type Pt = { x: number; y: number };
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => { const m = 1 - t; return { x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x, y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y }; };
const bezTan = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => { const m = 1 - t; return { x: 3 * m * m * (p1.x - p0.x) + 6 * m * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x), y: 3 * m * m * (p1.y - p0.y) + 6 * m * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y) }; };

/** A soft round sprite in one colour, drawn once and reused for every particle. */
function sprite(color: string, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!;
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const at = (a: number) => color.replace(/[\d.]+\)$/, `${a})`);
  r.addColorStop(0, at(1)); r.addColorStop(0.22, at(0.6)); r.addColorStop(0.5, at(0.18)); r.addColorStop(0.8, at(0.03)); r.addColorStop(1, at(0));
  g.fillStyle = r; g.fillRect(0, 0, size, size); return c;
}
const rgba = (hex: string, a = 1) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** The twinkling sky: three star layers, each one slow opacity animation, deterministic so screenshots compare. */
function starfield() {
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const layers: string[][] = [[], [], []];
  for (let i = 0; i < 96; i++) { const x = rnd() * 1000, y = rnd() * 1000, r = (0.45 + rnd() * 1.25).toFixed(2); layers[i % 3].push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}"/>`); }
  return layers.map((l, i) => `<svg class="tw tw${i + 1}" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${l.join('')}</svg>`).join('');
}
/** Six stars, one per breath, which join as a small constellation at the end. Coordinates in the sky band (0..100 x 0..60). */
const CONST: [number, number][] = [[20, 36], [33, 22], [50, 30], [64, 17], [80, 29], [47, 47]];
const constellation = () => `<svg class="ls-const" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <path class="ls-lines" d="M${CONST.map(p => p.join(' ')).join(' L')}" pathLength="1"/>
  ${CONST.map(([x, y], i) => `<g class="ls-star" data-i="${i}"><circle class="h" cx="${x}" cy="${y}" r="1.7"/><circle class="c" cx="${x}" cy="${y}" r=".8"/></g>`).join('')}</svg>`;

const momentNow = (q: URLSearchParams): Moment => {
  const forced = MOMENTS.find(m => m.key === q.get('moment')); if (forced) return forced;
  const h = new Date().getHours() + new Date().getMinutes() / 60, dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  return MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
};

/** The one-minute breathing pause. Opened by the breathing orb on every page and by [data-breathe] buttons. */
export function openBreathe(opener: HTMLElement) {
  const q = new URLSearchParams(location.search.replace(/^\?/, '') + '&' + (location.hash.split('?')[1] ?? ''));
  const speed = q.get('breath') === 'fast' ? 0.1 : 1;
  const IN = 4000 * speed, OUT = 6000 * speed, BREATH = IN + OUT, HOLD = 1200 * speed, IGNITE = 900 * speed, LEAD = 1500 * speed;
  const reduce = reduceMotion();
  const m = momentNow(q);
  const scent = m.pair.diffuser, mood: Mood = SCENT_MOOD[scent] ?? m.mood, moodLabel = MOODS[mood].label;
  const photo = CANDLE_PHOTOS[CANDLE_BY_MOOD[mood]], [ribbonA, ribbonB] = RIBBON[mood];

  const el = document.createElement('div'); el.className = 'jbreathe ls'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', COPY.ariaLabel);
  el.dataset.state = 'unlit'; el.dataset.mood = mood; el.style.setProperty('--ribbon', ribbonA);
  el.innerHTML = `<div class="ls-sky" aria-hidden="true">${starfield()}${constellation()}</div>
    <div class="ls-warm" aria-hidden="true"></div>
    <div class="ls-top" aria-hidden="true"><span>${esc(COPY.title)}</span><i></i><span>${esc(moodLabel)}</span></div>
    <div class="ls-say"><p class="ls-eyebrow" id="lsEyebrow">One minute</p>
      <p class="ls-words" aria-live="polite"><span class="ls-w" id="jbWord">${esc(COPY.startWord)}</span><em class="ls-sub" id="lsSub">${esc(COPY.startSub)}</em></p>
      <p class="ls-hint" id="lsHint">${esc(COPY.startHint)}</p></div>
    <div class="ls-stage" aria-hidden="true">
      <figure class="ls-arch candle"><img class="ls-img" alt="" decoding="async" draggable="false"><span class="ls-shade"></span><span class="ls-lit"></span></figure>
      <figure class="ls-arch diffuser"><img class="ls-img" alt="" decoding="async" draggable="false"><span class="ls-shade"></span><span class="ls-lit"></span></figure>
      <i class="ls-shelf"></i>
    </div>
    <canvas class="ls-fx" aria-hidden="true"></canvas>
    <div class="ls-foot">
      <button type="button" class="ls-light">${esc(COPY.startPill)}</button>
      <div class="ls-ring" aria-hidden="true"><svg viewBox="0 0 60 60" focusable="false"><circle class="bg" cx="30" cy="30" r="27"/><circle class="fg" cx="30" cy="30" r="27" pathLength="1"/></svg><b id="lsRingN"></b></div>
      <span class="ls-rhythm" aria-hidden="true">4 in · 6 out</span>
      <button type="button" class="jb-close">Close</button>
    </div>
    <p class="ls-sr" id="lsProgress" aria-live="polite"></p>
    <div class="ls-end" hidden></div>`;
  document.body.append(el); requestAnimationFrame(() => el.classList.add('open'));
  document.documentElement.classList.add('ls-lock');

  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const word = $('#jbWord'), sub = $('#lsSub'), hint = $('#lsHint'), eyebrow = $('#lsEyebrow'), progress = $('#lsProgress'), end = $('.ls-end'), stage = $('.ls-stage');
  const candleFig = $('.ls-arch.candle'), diffFig = $('.ls-arch.diffuser'), candleImg = $<HTMLImageElement>('.ls-arch.candle img'), diffImg = $<HTMLImageElement>('.ls-arch.diffuser img');
  const ringFg = el.querySelector<SVGCircleElement>('.ls-ring .fg')!, ringN = $('#lsRingN'), lightBtn = $<HTMLButtonElement>('.ls-light'), canvas = $<HTMLCanvasElement>('.ls-fx');
  const stars = [...el.querySelectorAll<SVGElement>('.ls-star')], constSvg = el.querySelector<SVGElement>('.ls-const')!;
  const ctx = canvas.getContext('2d')!;

  // ---- the pictures: the mood's candle photograph and the diffuser of the hour (one request each; a render falls back to Campfire Stories)
  candleImg.src = photo.src; diffImg.src = diffuserSrc(scent);
  diffImg.addEventListener('error', () => { if (!diffImg.src.endsWith('campfire-stories.jpg')) diffImg.src = '/img/diffuser-campfire-stories.jpg'; }, { once: true });
  candleImg.style.objectPosition = `${photo.pos[0] * 100}% ${photo.pos[1] * 100}%`; diffImg.style.objectPosition = `${DIFFUSER.pos[0] * 100}% ${DIFFUSER.pos[1] * 100}%`;
  for (const im of [candleImg, diffImg]) { const show = () => { if (el.isConnected) im.classList.add('ok'); }; im.decode().then(show, show); }
  /** A point given in picture fractions, on screen, for an object-fit: cover crop. */
  const mapPt = (im: HTMLImageElement, box: DOMRect, pos: [number, number], W: number, H: number, fx: number, fy: number) => {
    const w0 = im.naturalWidth || W, h0 = im.naturalHeight || H, s = Math.max(box.width / w0, box.height / h0), w = w0 * s, h = h0 * s;
    return { x: box.left + (box.width - w) * pos[0] + fx * w, y: box.top + (box.height - h) * pos[1] + fy * h, s: h / h0, w, h };
  };

  // ---- the catalogue, for the ending: the hour's diffuser and a real candle of the mood (same scent first), if the live store has them
  let items: Item[] | null = null;
  if (hasClient()) loadCatalogue().then(c => { items = c; }).catch(() => { items = null; });
  const livePair = () => {
    if (!items) return { diffuser: undefined, candle: undefined };
    const diffuser = findLive(items, scent, 'diffuser');
    const candle = findLive(items, scent, 'candle') ?? items.find(i => i.format === 'candle' && i.mood === mood && i.inStock);
    return { diffuser: diffuser?.inStock ? diffuser : undefined, candle };
  };

  // ---- geometry (recomputed on resize and every frame while the stage moves): the wick, the reed tips, the path of the scent
  let W = 0, H = 0, dpr = 1;
  const G = { wick: { x: 0, y: 0 }, flameH: 40, reed: { x: 0, y: 0, w: 10, h: 40 }, D: 200, p: [] as Pt[], s0: { x: 0, y: 0 } };
  const measure = () => {
    const cb = candleImg.getBoundingClientRect(), db = diffImg.getBoundingClientRect(); if (!cb.width || !db.width) return;
    const wk = mapPt(candleImg, cb, photo.pos, 1184, 1200, photo.wick[0], photo.wick[1]);
    G.wick = { x: wk.x, y: wk.y }; G.flameH = Math.max(14, (photo.wick[1] - photo.tip) * wk.h * 1.02);
    const r0 = mapPt(diffImg, db, DIFFUSER.pos, 800, 1000, DIFFUSER.reeds.x0, DIFFUSER.reeds.y0), r1 = mapPt(diffImg, db, DIFFUSER.pos, 800, 1000, DIFFUSER.reeds.x1, DIFFUSER.reeds.y1);
    G.reed = { x: r0.x, y: Math.max(db.top + 6, r0.y), w: r1.x - r0.x, h: r1.y - r0.y };
    G.D = Math.max(120, (db.left + db.width / 2) - (cb.left + cb.width / 2));
    const A = { x: G.reed.x + G.reed.w * 0.5, y: G.reed.y + G.reed.h * 0.08 }, F = { x: G.wick.x, y: G.wick.y - G.flameH * 0.9 };
    // the apex of the arc: high in the sky between the arches (on a short screen it rises behind the words), never above the top strip
    const topBottom = $('.ls-top').getBoundingClientRect().bottom, arcH = Math.max(0.62 * G.D, 0.46 * (cb.top - topBottom));
    const C = { x: (A.x + F.x) / 2, y: Math.max(topBottom + G.D * 0.12, cb.top - arcH) }, h = Math.max(1, A.y - C.y);
    G.p = [A, { x: A.x + G.D * 0.2, y: A.y - h * 0.62 }, { x: C.x + G.D * 0.5, y: C.y - h * 0.04 }, C,
      { x: C.x - G.D * 0.5, y: C.y + h * 0.04 }, { x: F.x - G.D * 0.26, y: F.y - (F.y - C.y) * 0.56 }, F];
    G.s0 = { x: G.wick.x - G.D * 0.52, y: G.wick.y + G.D * 0.5 };
    // the warm light inside the candle arch sits on the wick; the diffuser's on its reeds
    candleFig.style.setProperty('--wx', `${((G.wick.x - cb.left) / cb.width * 100).toFixed(1)}%`); candleFig.style.setProperty('--wy', `${((G.wick.y - cb.top) / cb.height * 100).toFixed(1)}%`);
    candleFig.style.setProperty('--fh', `${(G.flameH / cb.height * 100).toFixed(1)}%`);
    diffFig.style.setProperty('--wx', `${((A.x - db.left) / db.width * 100).toFixed(1)}%`); diffFig.style.setProperty('--wy', `${((A.y + G.reed.h * 0.3 - db.top) / db.height * 100).toFixed(1)}%`);
    el.style.setProperty('--fx', `${(G.wick.x / W * 100).toFixed(1)}%`); el.style.setProperty('--fy', `${((G.wick.y - G.flameH * 0.5) / H * 100).toFixed(1)}%`);
  };
  const resize = () => {
    W = el.clientWidth; H = el.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    measure();
  };
  const pathAt = (s: number): Pt => (s < 1 ? bez(G.p[0], G.p[1], G.p[2], G.p[3], s) : bez(G.p[3], G.p[4], G.p[5], G.p[6], Math.min(1, s - 1)));
  const tanAt = (s: number): Pt => (s < 1 ? bezTan(G.p[0], G.p[1], G.p[2], G.p[3], s) : bezTan(G.p[3], G.p[4], G.p[5], G.p[6], Math.min(1, s - 1)));

  // ---- the ribbon: a band of fine particles between a tail and a head that travel the path (reeds -> sky -> flame), wisps that peel
  // off its edges, embers where it meets the flame, and the match sparks of the hold
  interface Wisp { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; light: boolean }
  interface Ember { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hot: boolean }
  const wisps: Wisp[] = [], embers: Ember[] = [];
  const deep = (hex: string) => { const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.round(v * 0.78); return `rgba(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)},1)`; };
  const spBase = sprite(rgba(ribbonA, 1)), spDeep = sprite(deep(ribbonA)), spLight = sprite(rgba(ribbonB, 1)), spGold = sprite('rgba(255,214,150,1)'), spWhite = sprite('rgba(255,250,240,1)');
  let head = 0, tail = 0, lastTail = 0, wispAcc = 0, idleAcc = 0; const tmp: [number, number] = [0, 0];
  const bandW = (s: number) => { const sh = Math.sin(Math.PI * s / 2), near = Math.exp(-Math.pow((s - 1) / 0.36, 2)); return { w: G.D * 0.07 * (0.3 + 0.7 * Math.pow(sh, 0.9)) * (1 + 0.6 * near), near }; };
  const spawnWisp = (x: number, y: number, nx: number, ny: number, w: number, light = false) => { if (wisps.length < 320) { const side = Math.random() < 0.5 ? -1 : 1; wisps.push({ x, y, vx: nx * side * G.D * (0.04 + Math.random() * 0.1), vy: ny * side * G.D * 0.05 - G.D * (0.03 + Math.random() * 0.05), life: 0, max: 1.2 + Math.random() * 1.4, size: w * (0.8 + Math.random() * 1.2), light }); } };
  const spawnEmber = (x: number, y: number, hot = false, up = 1) => { if (embers.length < 160) embers.push({ x, y, vx: (Math.random() - 0.5) * G.D * 0.12, vy: -(0.25 + Math.random() * 0.45) * G.D * up, life: 0, max: (hot ? 0.5 : 1.3) + Math.random() * (hot ? 0.5 : 1.4), size: 0.8 + Math.random() * 1.6, hot }); };

  // ---- the state machine: unlit (hold or tap) -> lit (the flame catches, a short lead) -> breathing (six breaths) -> done
  let state: 'unlit' | 'lit' | 'done' = 'unlit';
  let holding = false, holdStart = 0, holdBase = 0, auto = false, hold = 0, tLit = 0, lastNow = 0, raf = 0, hiddenAt = 0, breathN = -1, phase = '';
  let frames = 0, warm = 0, lit = 0, flameK = 1, inh = 0, born = 0, lastRing = -1;
  const setState = (s: typeof state) => { state = s; el.dataset.state = s === 'lit' ? 'lighting' : s; };
  let said = '';
  const say = (w: string, s: string, h = '') => {
    if (said === w + s) return; said = w + s;
    const dur = reduce ? 0 : 320 * Math.max(speed, 0.4);
    el.style.setProperty('--swap', `${dur}ms`); el.classList.add('swap');
    window.setTimeout(() => { word.textContent = w; sub.textContent = s; hint.textContent = h; el.classList.remove('swap'); }, dur);
  };
  const ring = (k: number, n: string) => { const v = Math.round(k * 200) / 200; if (v !== lastRing) { lastRing = v; ringFg.style.strokeDashoffset = String(1 - v); } if (ringN.textContent !== n) ringN.textContent = n; };

  // ---- drawing
  const drawSprite = (sp: HTMLCanvasElement, x: number, y: number, size: number, a: number) => { if (a <= 0.002) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(sp, x - size / 2, y - size / 2, size, size); };
  const teardrop = (x: number, y: number, w: number, h: number, lean: number) => {
    ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    ctx.bezierCurveTo(x - w / 2, y - h * 0.42, x - w * 0.1 + lean * 0.7, y - h * 0.86, x + lean, y - h);
    ctx.bezierCurveTo(x + w * 0.1 + lean * 0.7, y - h * 0.86, x + w / 2, y - h * 0.42, x + w / 2, y);
    ctx.bezierCurveTo(x + w / 2, y + w * 0.38, x - w / 2, y + w * 0.38, x - w / 2, y); ctx.closePath();
  };
  /** The flame: a halo, a blurred outer flame, the gold body, the white-hot core low down and a blue base, all noise-driven. */
  const drawFlame = (t: number, strength: number, swell: number) => {
    if (strength <= 0.01) return;
    const { x, y } = G.wick, n1 = reduce ? 0 : noise1(t * 2.2, 1), n2 = reduce ? 0 : noise1(t * 6.5, 2), n3 = reduce ? 0 : noise1(t * 1.4, 3);
    const h = G.flameH * strength * (1 + swell * 0.6) * (1 + 0.1 * n1 + 0.05 * n2), w = h * 0.4 * (1 - 0.08 * n2), lean = w * (0.35 * n3 + 0.12 * n2) * (1 + swell * 0.6);
    ctx.globalCompositeOperation = 'lighter';
    // halo: the light of the flame in the air around it
    const hr = h * (2.6 + swell * 1.2), hg = ctx.createRadialGradient(x, y - h * 0.4, 0, x, y - h * 0.4, hr);
    hg.addColorStop(0, `rgba(255,178,96,${0.42 * strength * (0.8 + 0.4 * swell)})`); hg.addColorStop(0.35, `rgba(255,150,70,${0.14 * strength})`); hg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(x - hr, y - h * 0.4 - hr, hr * 2, hr * 2);
    // outer flame: soft orange, blurred
    ctx.save(); ctx.filter = `blur(${(h * 0.07).toFixed(1)}px)`;
    const og = ctx.createLinearGradient(0, y, 0, y - h * 1.15); og.addColorStop(0, 'rgba(255,120,40,0.1)'); og.addColorStop(0.5, 'rgba(255,150,60,0.5)'); og.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = og; teardrop(x, y, w * 1.5, h * 1.15, lean * 1.1); ctx.globalAlpha = strength; ctx.fill(); ctx.restore();
    // body: gold, brightest two-thirds down
    const bg = ctx.createLinearGradient(0, y, 0, y - h); bg.addColorStop(0, 'rgba(255,170,80,0.55)'); bg.addColorStop(0.25, '#FFCF72'); bg.addColorStop(0.55, '#FFE9B4'); bg.addColorStop(0.85, 'rgba(255,186,90,0.9)'); bg.addColorStop(1, 'rgba(255,120,40,0.35)');
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, strength * 1.1); ctx.fillStyle = bg; teardrop(x, y, w, h, lean); ctx.fill();
    // core: white-hot, low down
    const cg = ctx.createLinearGradient(0, y, 0, y - h * 0.6); cg.addColorStop(0, 'rgba(255,255,255,0.85)'); cg.addColorStop(0.45, 'rgba(255,250,235,0.9)'); cg.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = cg; teardrop(x, y + h * 0.02, w * 0.5, h * 0.6, lean * 0.5); ctx.fill();
    // the blue at the very base, around the wick
    ctx.globalAlpha = 0.42 * strength; ctx.fillStyle = 'rgba(96,140,255,0.7)'; teardrop(x, y + h * 0.05, w * 0.52, h * 0.17, lean * 0.2); ctx.fill();
    ctx.globalAlpha = 1;
  };
  const drawSpark = (k: number, t: number) => {
    const s0 = G.s0, c = { x: G.wick.x - G.D * 0.42, y: G.wick.y - G.D * 0.3 }, wk = { x: G.wick.x, y: G.wick.y - 2 };
    const at = (u: number) => { const m = 1 - u; return { x: m * m * s0.x + 2 * m * u * c.x + u * u * wk.x, y: m * m * s0.y + 2 * m * u * c.y + u * u * wk.y }; };
    const kk = smooth(k), p = at(kk);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 16; i++) { const q = at(Math.max(0, kk - i * 0.022)); drawSprite(spGold, q.x, q.y, 12 - i * 0.5, 0.3 * (1 - i / 17)); }
    drawSprite(spGold, p.x, p.y, 34, 0.9); drawSprite(spWhite, p.x, p.y, 10 + 3 * noise1(t * 20, 9), 1);
    if (Math.random() < 0.6) { const e: Ember = { x: p.x, y: p.y, vx: (Math.random() - 0.5) * G.D * 0.5, vy: (Math.random() - 0.7) * G.D * 0.5, life: 0, max: 0.25 + Math.random() * 0.35, size: 0.6 + Math.random(), hot: true }; if (embers.length < 160) embers.push(e); }
    // the wick warms as the spark nears
    drawSprite(spGold, wk.x, wk.y, 16 + 20 * kk, 0.5 * kk * kk);
  };

  // ---- one frame
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now; const t = now / 1000;
    if (el.classList.contains('moving') || (++frames % 40) === 0) measure();
    // the hold: progress while held (or on its own after a tap); it ebbs if you let go early
    if (state === 'unlit') {
      if (holding || auto) hold = Math.min(1, holdBase + (now - holdStart) / HOLD); else hold = Math.max(0, hold - (dt * 1000) / (HOLD * 0.5));
      if (reduce && (holding || auto)) hold = 1;
      el.style.setProperty('--hold', hold.toFixed(3)); ring(hold, '');
      if (hold >= 1) { setState('lit'); tLit = now; holding = false; auto = false; el.classList.add('is-lit'); lightBtn.disabled = true; progress.textContent = 'The candle is lit.'; }
    }
    let swell = 0, strength = 0; inh = 0;
    if (state !== 'unlit') {
      const since = now - tLit, ig = clamp01(since / IGNITE);
      // the flame catches with a flare, then settles; the light floods the arch first and then the sky
      lit = reduce ? 1 : smooth(ig); const flare = reduce ? 0 : Math.sin(Math.PI * clamp01(since / (IGNITE * 1.6))) * 0.5;
      strength = lit * (1 + flare) * flameK;
      if (state === 'lit') {
        const tb = since - LEAD;
        if (tb >= 0) {
          const n = Math.floor(tb / BREATH);
          if (n >= BREATHS) { finish(); strength = lit * flameK; }
          else {
            if (el.dataset.state !== 'breathing') el.dataset.state = 'breathing';
            const u = tb - n * BREATH, inhale = u < IN, k = inhale ? sineInOut(u / IN) : sineInOut((u - IN) / OUT);
            if (n !== breathN) { breathN = n; eyebrow.textContent = `Breath ${n + 1} of ${BREATHS}`; progress.textContent = `Breath ${n + 1} of ${BREATHS}`; el.dataset.breath = String(n + 1); if (n > born) { born = n; stars[n - 1]?.classList.add('on'); el.dataset.stars = String(born); } }
            const ph = inhale ? 'in' : 'out'; if (ph !== phase) { phase = ph; el.dataset.phase = ph; if (inhale) say(COPY.inWord, COPY.inSub); else say(COPY.outWord, COPY.outSub); }
            ring(inhale ? k : 1 - k, String(n + 1));
            // the ribbon: on the in-breath its head climbs from the reeds to the top of the arc while its tail stays on the reeds;
            // on the out-breath the head comes down into the flame and the tail follows, so the whole band drains into the light
            if (inhale) { head = k; tail = 0; } else { head = 1 + Math.min(1, k / 0.58); tail = 2 * smooth((k - 0.2) / 0.8); }
            inh = inhale ? k : 1 - k;
            swell = inhale ? 0 : Math.pow(Math.sin(Math.PI * clamp01((u - IN) / OUT)), 0.8); warm = swell;
            strength = lit * flameK * (0.92 + 0.08 * (inhale ? k : 1));
          }
        } else { say(COPY.inWord, COPY.inSub); head = tail = 0; ring(0, '1'); }
      } else { // done: the flame breathes slowly on its own, a thread of scent keeps rising
        warm = 0.25 + 0.2 * Math.sin(t * 0.8); strength = lit * flameK * (0.95 + 0.05 * Math.sin(t * 0.8)); head = tail = 0;
      }
      el.style.setProperty('--lit', lit.toFixed(3)); el.style.setProperty('--warm', warm.toFixed(3)); el.style.setProperty('--inh', inh.toFixed(3));
    }

    // ---- the canvas
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    if (!reduce) {
      if (state === 'unlit' && hold > 0) drawSpark(hold, t);
      const z = t * 0.22;
      ctx.globalCompositeOperation = 'lighter';
      // a hairline of the whole journey, dotted gold, so a still frame reads reeds -> sky -> flame
      if (lit > 0.5 && state === 'lit') {
        ctx.save(); ctx.globalAlpha = 0.14 * lit; ctx.strokeStyle = '#E9D4A1'; ctx.lineWidth = 1; ctx.setLineDash([1.5, 7]); ctx.beginPath();
        for (let i = 0; i <= 64; i++) { const q = pathAt(i / 32); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); } ctx.stroke(); ctx.restore();
      }
      // the band: fine particles packed along the path from the tail to the head; a wide haze, a body, a bright core, all waving gently
      if (state === 'lit' && head - tail > 0.015) {
        const n = Math.ceil((head - tail) * 170);
        for (let i = 0; i <= n; i++) {
          const sPos = tail + (head - tail) * (i / n), b = pathAt(sPos), tg = tanAt(sPos), tl = Math.hypot(tg.x, tg.y) || 1, nx = -tg.y / tl, ny = tg.x / tl;
          const { w, near } = bandW(sPos), env = smooth((sPos - tail) / 0.1) * smooth((head - sPos) / 0.06) * (0.7 + 0.5 * near);
          const wob = noise1(sPos * 2.4 + t * 0.3, 11) * w * 0.5, g1 = noise1(sPos * 17 + t * 0.7, 12) * w * 0.45, g2 = noise1(sPos * 31 - t * 0.5, 13) * w * 0.25;
          drawSprite(spDeep, b.x + nx * (wob + g1), b.y + ny * (wob + g1), w * 3.6, 0.014 * env);
          drawSprite(spBase, b.x + nx * (wob + g2), b.y + ny * (wob + g2), w * 1.7, 0.05 * env);
          drawSprite(spLight, b.x + nx * (wob + g2 * 0.5), b.y + ny * (wob + g2 * 0.5), w * 0.7, 0.09 * env);
          if (sPos > 1.7) drawSprite(spGold, b.x + nx * wob, b.y + ny * wob, w * 1.2, 0.06 * env * smooth((sPos - 1.7) / 0.3));
        }
        // wisps peel off the edges of the band
        wispAcc += dt * 55; while (wispAcc >= 1) { wispAcc--; const sPos = tail + (head - tail) * Math.random(), b = pathAt(sPos), tg = tanAt(sPos), tl = Math.hypot(tg.x, tg.y) || 1; const { w } = bandW(sPos); const wob = noise1(sPos * 2.4 + t * 0.3, 11) * w * 0.5; spawnWisp(b.x - tg.y / tl * wob, b.y + tg.x / tl * wob, -tg.y / tl, tg.x / tl, w, Math.random() < 0.25); }
        // what reaches the flame rises again as embers
        if (head >= 2 && tail > lastTail) { let k = (tail - lastTail) * 60; while (k > 0) { if (Math.random() < k) spawnEmber(G.wick.x + (Math.random() - 0.5) * 6, G.wick.y - G.flameH * 0.85); k--; } }
      }
      lastTail = tail;
      // after the minute a thin thread of scent keeps rising from the reeds
      if (state === 'done') { idleAcc += dt * 7; while (idleAcc >= 1) { idleAcc--; const { w } = bandW(0.15); spawnWisp(G.reed.x + G.reed.w * (0.3 + Math.random() * 0.4), G.reed.y + G.reed.h * 0.1, 1, 0, w * 1.2, Math.random() < 0.3); } }
      for (let i = wisps.length - 1; i >= 0; i--) {
        const p = wisps[i]; p.life += dt; if (p.life >= p.max) { wisps.splice(i, 1); continue; }
        const k = p.life / p.max; curl(p.x, p.y, z, tmp);
        p.vx += tmp[0] * dt * G.D * 0.05 - p.vx * dt * 0.6; p.vy += tmp[1] * dt * G.D * 0.05 - p.vy * dt * 0.6; p.x += p.vx * dt; p.y += p.vy * dt;
        drawSprite(p.light ? spLight : spBase, p.x, p.y, p.size * (1 + k * 0.8), 0.045 * Math.sin(Math.PI * k));
      }
      // embers: the scent that reaches the flame rises again as gold sparks and fades into the sky
      if (state === 'lit' && swell > 0.2 && Math.random() < swell * 0.08) spawnEmber(G.wick.x + (Math.random() - 0.5) * 8, G.wick.y - G.flameH * (0.9 + swell * 0.5), false, 0.8);
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]; e.life += dt; if (e.life >= e.max) { embers.splice(i, 1); continue; }
        const k = e.life / e.max; curl(e.x, e.y, z + 3, tmp);
        e.vx += tmp[0] * dt * G.D * 0.08 - e.vx * dt * 0.8; e.vy += tmp[1] * dt * G.D * 0.05 - e.vy * dt * 0.35;
        e.x += e.vx * dt; e.y += e.vy * dt;
        const a = Math.pow(1 - k, 1.4) * (e.hot ? 1 : 0.8), sz = e.size * (e.hot ? 1 : 0.8 + k * 0.3);
        drawSprite(e.hot ? spWhite : spGold, e.x, e.y, sz * 6, a * (e.hot ? 0.5 : 0.3)); drawSprite(e.hot ? spWhite : spGold, e.x, e.y, sz * 2, a * 0.9);
      }
      ctx.globalAlpha = 1;
    }
    drawFlame(t, strength, swell);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  };

  // ---- the ending: both arches lift, and the pair is offered from the live catalogue (the diffuser of the hour and a real candle of the mood)
  const finish = () => {
    if (state === 'done') return; setState('done'); flameK = 1;
    stars.forEach(s => s.classList.add('on')); el.dataset.stars = String(BREATHS); constSvg.classList.add('drawn'); born = BREATHS;
    const { diffuser, candle } = livePair();
    const thumb = (src: string) => `<span class="ls-th"><img src="${esc(src)}" alt="" decoding="async"></span>`;
    const names = [candle ? `${candle.name} candle` : '', diffuser ? diffuser.name : ''].filter(Boolean).join(' + ');
    const price = (diffuser?.priceMin ?? 0) + (candle?.priceMin ?? 0);
    const cta = diffuser
      ? `<button type="button" class="ls-primary ls-add">${candle ? 'Add the pair' : 'Add the diffuser'} · ${money(price)}</button>${candle ? '' : `<a class="ls-link" href="#/shop?f=candle">${esc(COPY.candles)}</a>`}`
      : `<a class="ls-primary" href="#/shop?m=${mood}">See the scents</a><a class="ls-link" href="#/shop?f=candle">${esc(COPY.candles)}</a>`;
    end.innerHTML = `<div class="ls-card">
      <div class="ls-pair">${thumb(candle?.thumb || photo.src)}${thumb(diffuser?.thumb || diffImg.src)}</div>
      <p class="ls-eyebrow"><span class="d">${esc(COPY.endEyebrow)} · ${esc(moodLabel)}</span></p>
      <h2>${esc(COPY.endTitle)}</h2>
      <p class="ls-line"><span class="d">${esc(COPY.endLine)}</span></p>
      ${names ? `<p class="ls-names">${esc(names)}</p>` : `<p class="ls-names"><span class="d">${esc(COPY.endNote)}</span></p>`}
      <div class="ls-links">${cta}<a class="ls-link quiet" href="#/reset">${esc(COPY.reset)} →</a><button type="button" class="ls-again">${esc(COPY.again)}</button></div></div>`;
    // the arches lift to the top of the screen and the card takes the room beneath them
    const sr = stage.getBoundingClientRect(), top = Math.max(H * 0.1, 44), k = 0.68;
    el.style.setProperty('--up', `${(top - sr.top).toFixed(0)}px`); el.style.setProperty('--card-top', `${(top + sr.height * k + 14).toFixed(0)}px`);
    end.hidden = false; el.classList.add('done', 'moving'); window.setTimeout(() => el.classList.remove('moving'), 1400);
    word.textContent = ''; sub.textContent = ''; hint.textContent = ''; eyebrow.textContent = ''; progress.textContent = 'Six breaths. The pause is over.';
    end.querySelector<HTMLButtonElement>('.ls-add')?.addEventListener('click', async function () {
      this.disabled = true;
      for (const p of [candle, diffuser]) if (p) await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
      this.textContent = candle ? 'The pair is in your cart' : 'The diffuser is in your cart'; toast(`${names} added to your cart`);
    });
    end.querySelector<HTMLElement>('.ls-again')!.addEventListener('click', again);
    end.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
    end.querySelector<HTMLElement>('.ls-primary')!.focus();
  };
  const again = () => {
    setState('lit'); tLit = performance.now(); breathN = -1; phase = ''; born = 0; head = tail = lastTail = 0; warm = 0; wisps.length = 0;
    stars.forEach(s => s.classList.remove('on')); constSvg.classList.remove('drawn'); el.dataset.stars = '0'; delete el.dataset.breath;
    end.hidden = true; end.innerHTML = ''; el.classList.remove('done'); el.classList.add('moving'); window.setTimeout(() => el.classList.remove('moving'), 1400);
    say(COPY.inWord, COPY.inSub); eyebrow.textContent = 'One minute'; $('.jb-close').focus();
  };

  // ---- the hold: pointer anywhere (not on the buttons), Space or Enter; a short tap lights it on its own
  const startHold = () => { if (state !== 'unlit' || holding || auto) return; holding = true; holdStart = performance.now(); holdBase = hold; };
  const endHold = () => { if (!holding) return; holding = false; if (performance.now() - holdStart < 260 && hold < 1) { auto = true; holdStart = performance.now(); holdBase = hold; } };
  const lightNow = () => { if (state === 'unlit' && !auto) { auto = true; holdStart = performance.now(); holdBase = hold; } };
  const onDown = (e: PointerEvent) => { const tg = e.target as Element; if (tg.closest('.jb-close, .ls-end, a')) return; if (e.button !== 0 && e.pointerType === 'mouse') return; startHold(); };
  el.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', endHold); window.addEventListener('pointercancel', endHold);
  lightBtn.addEventListener('click', e => { if (e.detail === 0) lightNow(); }); // keyboard or assistive activation
  const focusables = () => [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(x => x.getClientRects().length > 0);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if ((e.key === ' ' || e.key === 'Enter') && state === 'unlit' && !(e.target as Element).closest('.jb-close')) { e.preventDefault(); if (!e.repeat) startHold(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !el.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !el.contains(a))) { e.preventDefault(); first.focus(); }
  };
  const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') endHold(); };
  // the tab goes away: the loop stops and the clock pauses with it, so nothing jumps when it comes back
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; hiddenAt = performance.now(); } else if (!raf) { const gap = performance.now() - hiddenAt; tLit += gap; lastNow = 0; raf = requestAnimationFrame(frame); } };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp); document.addEventListener('visibilitychange', onVis); window.addEventListener('resize', resize);

  // ---- close: the button, Escape or a link out. Focus returns to the opener and everything stops.
  const close = () => {
    cancelAnimationFrame(raf); raf = 0;
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', endHold); window.removeEventListener('pointercancel', endHold);
    document.documentElement.classList.remove('ls-lock');
    el.classList.remove('open'); window.setTimeout(() => { el.remove(); opener.focus(); }, reduce ? 0 : 450);
  };
  $('.jb-close').addEventListener('click', close);
  $('.jb-close').focus();
  resize(); window.setTimeout(resize, 60); // once the fonts and the pictures have settled
  raf = requestAnimationFrame(frame);
}
