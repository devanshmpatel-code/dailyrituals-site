import { MOMENTS, type Moment } from '../config';
import { createBodhi } from './bodhi';
import '../flamebreath.css';

// The breathing pause, opened by the breathing orb on every page and by [data-breathe] buttons.
// The original pause (the sky of the hour, the tree, "Take a moment", then in, hold, out for as long as you like) with a
// candle at its heart: the brand's candle, a matte black tin with a white wax top and a flat wooden wick, stands on the
// ground at the foot of a Bodhi tree (src/pages/bodhi.ts) at night. Its flame grows a little as you breathe in, rests while
// you hold and settles as you breathe out, and its light, on the ground, the roots, the bark and the underside of the crown,
// grows and recedes with it. No products and no claims: the rhythm is described only as in, hold, out.
//
// How it is drawn: the tin, the wax and the flame are painted once per size into small offscreen sprites; a frame is a
// handful of drawImage calls (the tin in the night, the same tin as the flame lights it at that frame's strength, the flame
// in horizontal strips so it can bend and ripple, its bloom) on a canvas no bigger than the stage. The light on the tree and
// the ground is one pre-lit layer in bodhi.ts whose opacity follows the same flicker value as the flame.

const IN = 4000, HOLD = 2000, OUT = 6000, CYCLE = IN + HOLD + OUT, LEAD = 1200;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sineInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
/** The strength of the candle's light that the lit layers are painted at; the flicker can briefly reach it. */
const LIGHT_MAX = 1.12;

// a small seeded value noise, so the flicker is organic rather than a keyframe wobble
const hash = (x: number) => { let h = (x * 374761393) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000; };
const noise1 = (t: number, seed = 0) => { const x = t + seed * 31.7, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i) + (hash(i + 1) - hash(i)) * u) * 2 - 1; };

const momentNow = (q: URLSearchParams): Moment => {
  const forced = MOMENTS.find(m => m.key === q.get('moment')); if (forced) return forced;
  const h = new Date().getHours() + new Date().getMinutes() / 60, dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  return MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
};

/** Faint stars, deterministic so screenshots compare; brighter after dark. */
function stars(dark: boolean) {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let s = ''; for (let i = 0; i < 70; i++) { const y = rnd() * 620; s += `<circle cx="${(rnd() * 1000).toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.5 + rnd() * 1.2).toFixed(2)}" opacity="${((dark ? 0.5 : 0.22) * (1 - y / 700) + rnd() * 0.25).toFixed(2)}"/>`; }
  return `<svg class="fb-stars" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${s}</svg>`;
}

/**
 * Where everything stands, in CSS px of the stage. The tree's foot is where the flame used to be (so the tree keeps its
 * place); the candle stands on the ground a little in front of it. Seen slightly from above: a circle on the ground, or the
 * candle's top, is an ellipse e times as tall as it is wide.
 */
type Geo = { W: number; H: number; cx: number; oy: number; R: number; e: number; gy: number; rimY: number; waxY: number; wickY: number; href: number; lightY: number };
const geometry = (W: number, H: number, top: number): Geo => {
  // the candle is small beside the trunk: its size follows the stage, but never more than a fraction of the tree's width
  // (bodhi.ts lays the tree out the same way: sy from the height of its foot, sx from that and the window's width)
  const treeSx = Math.min(Math.max(140, (top + H * 0.74 + 2) * 0.86) * 0.92, window.innerWidth * 0.43);
  const R = Math.max(9, Math.min(Math.min(W, H) * 0.07, treeSx * 0.09)), e = 0.3, oy = H * 0.74, cx = W / 2;
  const gy = oy + R * 1.05; // the middle of the tin's foot: seen at this angle, about three and a half tin radii in front of the trunk
  const rimY = gy - R * 1.22, waxY = rimY + R * 0.16, wickY = waxY - R * 0.2, href = R * 2.5; // a tin 2R wide and 1.2R tall, burnt a little down
  return { W, H, cx, oy, R, e, gy, rimY, waxY, wickY, href, lightY: wickY - href * 0.36 };
};

/** A flame's outline, its base at (x, y) and its tip h above: round at the bottom, widest a quarter of the way up, a long taper. */
const tear = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  g.beginPath(); g.moveTo(x, y + w * 0.1);
  g.bezierCurveTo(x + w * 0.66, y + w * 0.08, x + w * 0.6, y - h * 0.34, x + w * 0.26, y - h * 0.64);
  g.bezierCurveTo(x + w * 0.1, y - h * 0.82, x + w * 0.02, y - h * 0.93, x, y - h);
  g.bezierCurveTo(x - w * 0.02, y - h * 0.93, x - w * 0.1, y - h * 0.82, x - w * 0.26, y - h * 0.64);
  g.bezierCurveTo(x - w * 0.6, y - h * 0.34, x - w * 0.66, y + w * 0.08, x, y + w * 0.1); g.closePath();
};
const offscreen = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d')!] as const; };
const linear = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const l = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) l.addColorStop(o, c); return l; };

/**
 * The flame, painted once at its tallest in device px: an orange envelope, the yellow body, a near-white core low down and
 * the faint blue cup where it meets the wick, each softened with a blur. Returns the sprite and the row of the flame's base.
 */
function flameSprite(hpx: number) {
  const [c, g] = offscreen(hpx * 0.7, hpx * 1.24), x = c.width / 2, by = hpx * 1.12;
  g.filter = `blur(${(hpx * 0.05).toFixed(1)}px)`; // the faint outer mantle
  g.fillStyle = linear(g, 0, by, 0, by - hpx * 1.08, [[0, 'rgba(255,120,40,0)'], [0.1, 'rgba(255,128,48,0.42)'], [0.45, 'rgba(255,140,56,0.5)'], [0.8, 'rgba(250,110,40,0.3)'], [1, 'rgba(240,90,30,0)']]);
  tear(g, x, by, hpx * 0.38, hpx * 1.06); g.fill();
  g.filter = `blur(${(hpx * 0.009).toFixed(1)}px)`; // the luminous body: soot glowing yellow, deepening to orange at the tip
  g.fillStyle = linear(g, 0, by, 0, by - hpx, [[0, 'rgba(255,170,80,0)'], [0.1, 'rgba(255,186,96,0.62)'], [0.22, 'rgba(255,222,146,0.98)'], [0.55, 'rgba(255,204,108,1)'], [0.8, 'rgba(255,156,62,0.86)'], [0.96, 'rgba(255,120,44,0.2)'], [1, 'rgba(255,110,40,0)']]);
  tear(g, x, by, hpx * 0.29, hpx); g.fill();
  g.filter = `blur(${(hpx * 0.028).toFixed(1)}px)`; // the hottest part, almost white, low in the flame
  g.fillStyle = linear(g, 0, by - hpx * 0.07, 0, by - hpx * 0.7, [[0, 'rgba(255,255,250,0)'], [0.12, 'rgba(255,255,250,0.95)'], [0.5, 'rgba(255,254,244,1)'], [0.78, 'rgba(255,240,200,0.55)'], [1, 'rgba(255,228,170,0)']]);
  tear(g, x, by - hpx * 0.07, hpx * 0.18, hpx * 0.6); g.fill();
  // the dark heart just above the wick, where the wax vapour has not caught yet, and the blue cup around it
  g.filter = `blur(${(hpx * 0.02).toFixed(1)}px)`; g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath(); g.ellipse(x, by - hpx * 0.06, hpx * 0.07, hpx * 0.07, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'lighter'; g.filter = `blur(${(hpx * 0.012).toFixed(1)}px)`;
  g.strokeStyle = 'rgba(96,128,236,0.5)'; g.lineWidth = hpx * 0.03;
  g.beginPath(); g.ellipse(x, by - hpx * 0.06, hpx * 0.125, hpx * 0.085, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  g.fillStyle = 'rgba(80,110,230,0.14)'; g.beginPath(); g.ellipse(x, by - hpx * 0.05, hpx * 0.11, hpx * 0.06, 0, 0, Math.PI * 2); g.fill();
  g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  return { c, by, hpx };
}

/** The glow of the flame in the air (and the eye): a soft warm radial falloff, drawn scaled. */
function bloomSprite() {
  const [c, g] = offscreen(128, 128), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 16; i++) { const u = i / 16, a = Math.exp(-u * 5.2) * (1 - u) ** 2; r.addColorStop(u, `rgba(255,${(176 - 50 * u) | 0},${(104 - 40 * u) | 0},${a.toFixed(3)})`); }
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c;
}

/**
 * The candle, once in the night and once as its own flame lights it (the frame mixes the two by the light's strength).
 * A matte black tin seen slightly from above, its rolled rim, the creamy wax a little below the rim with a translucent
 * pool of melt around the wick, and a soft contact shadow on the ground.
 */
function candleSprite(G: Geo, d: number, lit: boolean) {
  const { cx, R, e, gy, rimY, waxY } = G, x0 = cx - R * 1.8, y0 = rimY - R * e - R * 0.25, w = R * 3.6, h = gy + R * e + R * 0.6 - y0;
  const [c, g] = offscreen(w * d, h * d); g.setTransform(d, 0, 0, d, -x0 * d, -y0 * d);
  const E = (x: number, y: number, rx: number, ry: number) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
  if (!lit) { // where the tin meets the ground: a soft contact shadow, darkest right under the edge
    g.filter = `blur(${(R * 0.22 * d).toFixed(1)}px)`; g.fillStyle = 'rgba(4,2,8,0.7)'; E(cx, gy + R * 0.04, R * 1.3, R * e * 1.5); g.fill();
    g.filter = `blur(${(R * 0.06 * d).toFixed(1)}px)`; g.fillStyle = 'rgba(0,0,0,0.85)'; E(cx, gy + R * 0.02, R * 1.04, R * e * 1.12); g.fill(); g.filter = 'none';
  }
  // the tin's side: matte black, rounding away at the edges; a cool sheen of the night sky on the left
  g.beginPath(); g.moveTo(cx - R, rimY); g.lineTo(cx - R, gy); g.ellipse(cx, gy, R, R * e, 0, Math.PI, 0, true); g.lineTo(cx + R, rimY); g.ellipse(cx, rimY, R, R * e, 0, 0, Math.PI, false); g.closePath();
  g.fillStyle = linear(g, cx - R, 0, cx + R, 0, [[0, '#08070b'], [0.1, '#1b1a21'], [0.22, '#18171c'], [0.5, '#111014'], [0.85, '#0d0c10'], [1, '#060509']]); g.fill();
  if (lit) { // the lit ground around it bounces a little warmth back onto the lower tin
    g.save(); g.clip(); g.fillStyle = linear(g, 0, gy + R * e, 0, gy - R * 0.7, [[0, 'rgba(255,150,80,0.16)'], [0.5, 'rgba(255,140,70,0.05)'], [1, 'rgba(255,140,70,0)']]); g.fillRect(x0, y0, w, h); g.restore();
  } else { // the faintest grain of the powder coat
    g.save(); g.clip(); let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(cx - R + rnd() * 2 * R, rimY - R * e + rnd() * (gy - rimY + 2 * R * e), 0.6, 0.6); }
    g.restore();
  }
  // the rim, rolled: a darker lip around the top
  g.lineWidth = R * 0.07; g.strokeStyle = lit ? '#1d1714' : '#16151a'; E(cx, rimY, R * 0.965, R * e * 0.965); g.stroke();
  // inside: the far wall of the tin above the wax, then the wax itself
  const ri = R * 0.93; g.save(); E(cx, rimY, ri, ri * e); g.clip();
  g.fillStyle = lit ? linear(g, 0, rimY - ri * e, 0, waxY - ri * e, [[0, '#4a3020'], [1, '#a8683a']]) : '#16141a'; g.fillRect(x0, y0, w, h);
  E(cx, waxY, ri, ri * e);
  if (lit) { // warm cream, brightest by the wick and falling away towards the rim
    g.save(); g.translate(cx, waxY); g.scale(1, e); const r = g.createRadialGradient(0, 0, 0, 0, 0, ri);
    r.addColorStop(0, '#fff7e8'); r.addColorStop(0.3, '#fcebd0'); r.addColorStop(0.6, '#f3dab4'); r.addColorStop(0.85, '#e2c299'); r.addColorStop(1, '#c9a47c'); g.restore();
    g.fillStyle = r; g.fill();
    // the melt pool: clear, deeper and more golden, its edge a faint bright line where liquid meets solid wax
    g.save(); g.translate(cx, waxY); g.scale(1, e); const p = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.56);
    p.addColorStop(0, 'rgba(255,214,140,0.55)'); p.addColorStop(0.7, 'rgba(236,170,92,0.5)'); p.addColorStop(0.93, 'rgba(226,150,80,0.38)'); p.addColorStop(1, 'rgba(255,236,200,0)'); g.restore();
    g.fillStyle = p; E(cx, waxY, R * 0.56, R * 0.56 * e); g.fill();
    g.strokeStyle = 'rgba(255,224,176,0.3)'; g.lineWidth = R * 0.025; E(cx, waxY, R * 0.55, R * 0.55 * e); g.stroke();
  } else { g.fillStyle = '#58534f'; g.fill(); }
  // the wax meets the wall in a thin shadow
  g.strokeStyle = lit ? 'rgba(90,50,30,0.5)' : 'rgba(0,0,0,0.4)'; g.lineWidth = R * 0.04; E(cx, waxY, ri, ri * e); g.stroke();
  g.restore();
  if (lit) { // the inner lip of the rim catches the flame: a thin warm line, brightest at the back where it faces the light
    g.lineCap = 'round'; g.strokeStyle = 'rgba(255,196,128,0.85)'; g.lineWidth = R * 0.03;
    g.beginPath(); g.ellipse(cx, rimY, R * 0.935, R * e * 0.935, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.strokeStyle = 'rgba(255,170,100,0.45)'; g.lineWidth = R * 0.022;
    g.beginPath(); g.ellipse(cx, rimY, R * 0.99, R * e * 0.99, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  } else { // the sky's faint sheen on the outer lip
    g.strokeStyle = 'rgba(170,170,200,0.14)'; g.lineWidth = R * 0.02; g.beginPath(); g.ellipse(cx, rimY, R, R * e, 0, Math.PI * 0.55, Math.PI * 0.95); g.stroke();
  }
  return { c, x0, y0, w, h };
}

export function openBreathe(opener: HTMLElement) {
  document.querySelectorAll('.jbreathe').forEach(n => n.remove());
  const q = new URLSearchParams(location.search + (location.hash.includes('?') ? '&' + location.hash.split('?')[1] : ''));
  const speed = q.has('breath') && q.get('breath') === 'fast' ? 10 : 1;
  const m = momentNow(q), reduce = reduceMotion();

  const el = document.createElement('div');
  el.className = 'jbreathe fb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'A moment to breathe');
  // the sky of the hour fades down into a candlelit dusk, so the flame always has a dark place to glow in
  el.style.setProperty('--s0', m.sky[0]); el.style.setProperty('--s1', m.sky[1]); el.style.setProperty('--s2', m.sky[2]);
  el.innerHTML = `<div class="fb-sky" aria-hidden="true"></div>${stars(m.dark)}<div class="fb-glow" aria-hidden="true"></div>
    <div class="jb-tree fb-tree" aria-hidden="true"><canvas class="fb-bodhi"></canvas></div>
    <div class="fb-stage" aria-hidden="true"><canvas class="fb-flame"></canvas></div>
    <p class="jb-word" id="jbWord" aria-live="polite">Take a moment</p><p class="jb-sub">Breathe in, hold, breathe out. Stay as long as you like.</p>
    <button class="btn jb-close" type="button">Done</button>`;
  document.body.append(el); requestAnimationFrame(() => el.classList.add('open'));

  const word = el.querySelector<HTMLElement>('#jbWord')!, glow = el.querySelector<HTMLElement>('.fb-glow')!;
  const cv = el.querySelector<HTMLCanvasElement>('.fb-flame')!, ctx = cv.getContext('2d')!;
  const stage = el.querySelector<HTMLElement>('.fb-stage')!;
  let G = geometry(1, 1, 0), d = 1, drawn = false;
  let flame: ReturnType<typeof flameSprite> | null = null, bloom: HTMLCanvasElement | null = null, dark: ReturnType<typeof candleSprite> | null = null, lit: ReturnType<typeof candleSprite> | null = null;
  const size = () => {
    const r = cv.getBoundingClientRect(); d = Math.min(2, window.devicePixelRatio || 1); if (!r.width || !r.height) return;
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); G = geometry(r.width, r.height, r.top);
    flame = flameSprite(Math.ceil(G.href * 1.3 * d)); bloom ??= bloomSprite(); dark = candleSprite(G, d, false); lit = candleSprite(G, d, true); drawn = false;
    // for the tests: where the wick and the tin are, in CSS px of the canvas
    cv.dataset.wick = `${G.cx.toFixed(1)},${G.wickY.toFixed(1)}`; cv.dataset.candle = `${G.cx.toFixed(1)},${G.rimY.toFixed(1)},${G.gy.toFixed(1)},${G.R.toFixed(1)}`;
    // the light the flame throws into the air sits on the flame
    glow.style.left = `${(r.left + G.cx).toFixed(1)}px`; glow.style.top = `${(r.top + G.lightY).toFixed(1)}px`;
  };
  size(); const ro = new ResizeObserver(size); ro.observe(cv); window.addEventListener('resize', size); // the window too: the candle's size follows the tree's
  // the tree is laid out from the stage: its trunk rises behind the candle, and it is lit from the flame
  const tree = createBodhi({ canvas: el.querySelector<HTMLCanvasElement>('.fb-bodhi')!, sky: m.sky, reduce, lightMax: LIGHT_MAX,
    anchor: () => { const r = stage.getBoundingClientRect(), g = geometry(r.width, r.height, r.top);
      return { x: r.left + g.cx, y: r.top + g.oy, light: { x: r.left + g.cx, y: r.top + g.lightY, gx: r.left + g.cx, gy: r.top + g.gy, r: g.R, rimH: g.gy - g.rimY, e: g.e } }; } });

  type Spark = { x: number; y: number; vx: number; vy: number; life: number; age: number };
  const sparks: Spark[] = [];

  /** k is how full the breath is (0 resting, 1 full), sway the push of the out-breath, f the flicker shared with the light. */
  const draw = (t: number, k: number, sway: number, dt: number, f: number, gut: number) => {
    if (!flame || !bloom || !dark || !lit) return;
    const { cx, R, e, waxY, wickY, href } = G, L = clamp((0.52 + 0.48 * k) * f / LIGHT_MAX, 0, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(d, 0, 0, d, 0, 0);
    // the flame: its height follows the breath and the flicker; it narrows as it stretches and leans on the air
    const n2 = reduce ? 0 : noise1(t * 6.1, 2), n3 = reduce ? 0 : noise1(t * 0.9, 3), n4 = reduce ? 0 : noise1(t * 2.7, 4);
    const h = href * (0.68 + 0.36 * k) * f, sy = h / flame.hpx, sx = sy * Math.pow(href / h, 0.3) * (1 + 0.05 * n2 + 0.25 * gut);
    const lean = h * (0.07 * n3 + 0.035 * n4) + sway * h * 0.16, base = wickY + R * 0.05;
    // the candle in the night, then as its flame lights it now
    ctx.drawImage(dark.c, dark.x0, dark.y0, dark.w, dark.h);
    ctx.globalAlpha = L; ctx.drawImage(lit.c, lit.x0, lit.y0, lit.w, lit.h);
    const fw = flame.c.width * sx, fh = flame.c.height * sy;
    // the flame mirrored in the glossy pool of melted wax, squashed by the angle we see it at
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, waxY, R * 0.55, R * 0.55 * e, 0, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.5 * L; ctx.translate(cx + lean * 0.15, waxY + R * 0.02); ctx.scale(1, -e * 0.55);
    ctx.drawImage(flame.c, -fw / 2, -flame.by * sy, fw, fh); ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
    // the glow of the flame in the air, wide and faint, then close and warm
    const gx = cx + lean * 0.35, gy = base - h * 0.42, B1 = href * 4.6 * (0.85 + 0.15 * L), B2 = href * 1.15;
    ctx.globalAlpha = 0.3 * L; ctx.drawImage(bloom, gx - B1, gy - B1, B1 * 2, B1 * 2);
    ctx.globalAlpha = 0.36 * L; ctx.drawImage(bloom, gx - B2, gy - B2 * 1.1, B2 * 2, B2 * 2.2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the flame itself, in strips: each one shifted by the lean (more towards the tip) and by a ripple running up it. The
    // strips meet on whole device pixels, so no seam shows between them
    const N = 22, sd = sy * d, top = Math.round((base - flame.by * sy) * d), Hd = flame.c.height * sd, ripple = reduce ? 0 : h * (0.012 + 0.02 * sway + 0.05 * gut);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = 0; j < N; j++) {
      const y0 = top + Math.round((j * Hd) / N), y1 = top + Math.round(((j + 1) * Hd) / N); if (y1 <= y0) continue;
      const s0 = (y0 - top) / sd, s1 = Math.min(flame.c.height, (y1 - top) / sd), u = Math.max(0, (flame.by - (s0 + s1) / 2) / flame.hpx);
      const off = lean * Math.pow(u, 1.7) + ripple * Math.pow(u, 1.3) * Math.sin(u * 7.5 - t * 8.5);
      ctx.drawImage(flame.c, 0, s0, flame.c.width, s1 - s0, (cx - fw / 2 + off) * d, y0, fw * d, y1 - y0);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // the wooden wick in the clear heart of the flame: a thin flat strip of wood standing in the wax, charred black at the
    // top, its burning edge glowing
    const ww = R * 0.26, wb = waxY + R * 0.03, wt = wickY;
    ctx.fillStyle = linear(ctx, 0, wb, 0, wt, [[0, '#8a6442'], [0.3, '#5a3e28'], [0.5, '#1d1511'], [1, '#0d0a09']]);
    ctx.beginPath(); ctx.moveTo(cx - ww / 2, wb + R * 0.015); ctx.lineTo(cx - ww / 2 + R * 0.01, wt + R * 0.025); ctx.lineTo(cx + ww / 2 - R * 0.01, wt); ctx.lineTo(cx + ww / 2, wb - R * 0.01); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0a0807'; ctx.fillRect(cx + ww / 2 - R * 0.012, wt + R * 0.002, R * 0.03, wb - wt - R * 0.012); // its edge, turned a little away
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,${(96 + 50 * L) | 0},36,${(0.5 + 0.45 * L).toFixed(3)})`; ctx.lineWidth = Math.max(0.7, R * 0.032);
    ctx.beginPath(); ctx.moveTo(cx - ww / 2 + R * 0.02, wt + R * 0.03); ctx.lineTo(cx + ww / 2 - R * 0.02, wt + R * 0.006); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // now and then on the out-breath a tiny ember lifts off the wooden wick and goes out
    if (!reduce && sway > 0.3 && Math.random() < dt * 0.3 * sway) sparks.push({ x: cx + lean * 0.3 + (Math.random() - 0.5) * R * 0.2, y: base - h * 0.5, vx: (Math.random() - 0.5) * 10 + lean * 0.4, vy: -26 - Math.random() * 22, life: 0.5 + Math.random() * 0.6, age: 0 });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; }
      s.vx += noise1(t * 3 + i, 9) * 30 * dt; s.x += s.vx * dt; s.y += s.vy * dt; const a = (1 - s.age / s.life) ** 2;
      ctx.fillStyle = `rgba(255,${(200 - 60 * s.age / s.life) | 0},120,${(0.8 * a).toFixed(3)})`; ctx.fillRect(s.x - 0.6, s.y - 0.6, 1.2, 1.2);
    }
  };

  // the flicker, shared by the flame and its light: slow and quick noise, and now and then a short gutter, when the wooden
  // wick crackles and the flame ducks and wavers for a moment
  let gutAt = -10, nextGut = 5 + Math.random() * 6;
  const flicker = (t: number) => {
    if (reduce) return [1, 0];
    if (t > nextGut) { gutAt = t; nextGut = t + 6 + Math.random() * 10; }
    const a = t - gutAt, gut = a >= 0 && a < 0.55 ? Math.sin((Math.PI * a) / 0.55) * (0.75 + 0.25 * Math.sin(a * 47)) : 0;
    return [1 + 0.05 * noise1(t * 1.7, 5) + 0.03 * noise1(t * 4.9, 6) + 0.015 * noise1(t * 12.5, 7) - 0.16 * gut, gut];
  };

  const t0 = performance.now(); let raf = 0, last = '', prev = t0, hidden = 0, hiddenAt = 0, lastGlow = '';
  const loop = (now: number) => {
    const el2 = (now - t0 - hidden) * speed, dt = Math.min(0.05, (now - prev) / 1000 * speed); prev = now;
    let k = 0.15, sway = 0, outp = -1, w = 'Take a moment';
    if (el2 >= LEAD) {
      const c = (el2 - LEAD) % CYCLE;
      if (c < IN) { w = 'Breathe in'; k = 0.15 + 0.85 * sineInOut(c / IN); }
      else if (c < IN + HOLD) { w = 'Hold'; k = 1; }
      else { w = 'Breathe out'; outp = (c - IN - HOLD) / OUT; k = 1 - 0.85 * sineInOut(outp); sway = Math.sin(Math.PI * Math.min(1, outp * 1.4)) * 0.9; }
    } else k = 0.15 * (el2 / LEAD) + 0.05;
    if (reduce) { k = 0.75; sway = 0; }
    if (w !== last) { word.textContent = w; word.classList.remove('fb-in'); void word.offsetWidth; word.classList.add('fb-in'); last = w; el.dataset.phase = w; }
    const t = (now - t0) / 1000, [f, gut] = flicker(t), light = (0.52 + 0.48 * k) * f;
    const go = (0.35 + 0.6 * Math.min(1, light / LIGHT_MAX)).toFixed(2); if (go !== lastGlow) { glow.style.opacity = go; lastGlow = go; }
    el.style.setProperty('--k', (Math.round(k * 50) / 50).toFixed(2));
    tree.update(t, k, sway, outp, dt, light);
    if (!(reduce && drawn)) { draw(t, k, sway, dt, f, gut); drawn = true; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); hiddenAt = performance.now(); } else { hidden += performance.now() - hiddenAt; prev = performance.now(); raf = requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', onVis);

  const close = () => {
    cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', size); tree.destroy(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
    el.classList.remove('open'); window.setTimeout(() => { el.remove(); opener.focus(); }, reduce ? 0 : 400);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { e.preventDefault(); el.querySelector<HTMLElement>('.jb-close')!.focus(); } // the only control: focus stays on it
  };
  document.addEventListener('keydown', onKey); el.querySelector('.jb-close')!.addEventListener('click', close);
  el.querySelector<HTMLElement>('.jb-close')!.focus();
}
