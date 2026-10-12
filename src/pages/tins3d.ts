// The opening's candle tins: a still life of three of Claire's past pours on a grassy knoll in the foreground, the hills of
// the hero landscape far behind them.
//
// One group at one scale, close to us: near things below the horizon are seen from a little above, so the tops show and the
// sizes read as believable against the far hills (an earlier version stood seven tins across the far ridges, which made them
// look the size of buildings). The knoll is the nearest, darkest layer of the landscape, painted in its colours with grass
// and a few dried sprigs at the tins' own scale; the tins sit just above the sun dial's arc, clear of the words and the offers.
//
// Each tin is drawn once into its own small canvas (a sprite) in the light of its moment: a matte black cylinder, a rolled rim
// with a thin bright highlight, a brushed sheen, a darker core shadow on the side away from the light, the top textured with
// one of Claire's real top-down photographs (public/img/studio/moons) a little below the rim, a flat wooden wick, a crisp dark
// contact shadow with a longer soft shadow away from the sun or moon, grass in front of its foot, and a fine grain like the
// landscape's. The medium tin has its lid leaning beside it. Each frame only composites those sprites and draws the flames
// (golden hour and night), so the cost per frame is tiny, and nothing runs at all when nothing moves, when the hero is off
// screen or when the tab is hidden.
//
// Phone: the picture is a band above the words, with hills of its own behind the knoll.
import { MOMENTS, type Moment } from '../config';
import { drawLandscape } from './landscape';

export type TinSize = 's' | 'm' | 'l';
/** Where a tin stands in the group: at the back (the large one), in front on the left, in front on the right. */
export type TinSpot = 'back' | 'left' | 'right';
export interface Tin {
  /** the photograph on top: a file in /img/studio/moons */
  top: string;
  size: TinSize;
  /** where the toppings should sit on the wax, as a clock angle in degrees (0 = the far side, 90 = right); by default toward the
   *  far side, away from the lid, where the near rim never hides them */
  aim?: number;
  /** its lid leans against it on the left (-1) or right (1) */
  lid?: -1 | 1;
  lit?: boolean;
  at: TinSpot;
}

type RGB = [number, number, number];
type Box = { l: number; t: number; r: number; b: number };
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const addc = (a: RGB, b: RGB, t: number): RGB => [a[0] + b[0] * t, a[1] + b[1] * t, a[2] + b[2] * t];
const mulc = (a: RGB, t: number): RGB => [a[0] * t, a[1] * t, a[2] * t];
const css = (c: RGB, a = 1) => `rgba(${Math.round(Math.max(0, Math.min(255, c[0])))},${Math.round(Math.max(0, Math.min(255, c[1])))},${Math.round(Math.max(0, Math.min(255, c[2])))},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (v: number, a: number, b: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const BLACK: RGB = [0, 0, 0], WHITE: RGB = [255, 255, 255];

/** The light of each moment, as it falls on a black tin: the paint's own colour, how much of the sky the brushed metal
 *  reflects, how strongly the sun (or moon) behind the hills catches the edge facing it, how high it is (short or long
 *  shadows), the light the wax takes (multiplied over the photograph), and how hazy the far hills are. */
interface Light { body: RGB; sheen: number; rim: number; elev: number; shadow: number; shadowA: number; wax: RGB; waxLift: number; haze: number; night: boolean }
const LIGHT: Record<string, Light> = {
  dawn: { body: [12, 11, 15], sheen: 0.07, rim: 0.75, elev: 0.15, shadow: 2.2, shadowA: 0.42, wax: [246, 224, 220], waxLift: 0.03, haze: 1.25, night: false },
  morning: { body: [11, 12, 15], sheen: 0.08, rim: 0.55, elev: 0.45, shadow: 1.3, shadowA: 0.5, wax: [250, 246, 238], waxLift: 0.04, haze: 1, night: false },
  midday: { body: [12, 12, 15], sheen: 0.09, rim: 0.35, elev: 0.85, shadow: 0.5, shadowA: 0.65, wax: [255, 254, 250], waxLift: 0.05, haze: 0.85, night: false },
  golden: { body: [13, 11, 13], sheen: 0.05, rim: 1, elev: 0.12, shadow: 2.8, shadowA: 0.5, wax: [252, 214, 178], waxLift: 0, haze: 1, night: false },
  night: { body: [9, 9, 14], sheen: 0.05, rim: 0.5, elev: 0.3, shadow: 1.1, shadowA: 0.36, wax: [92, 88, 120], waxLift: 0, haze: 0.7, night: true },
};
/** where the wick sits in each photograph, as a fraction of the picture from its centre (read off the photographs) */
/** where the toppings lie in each photograph, as a clock angle in degrees (0 = top of the picture) */
const TOP_AT: Record<string, number> = {
  'apple-cider': 315, 'black-crescent': 90, 'candy-cane-lane': 80, 'christmas-eve': 10, 'easter-bread': 0, 'hello-cupcake': 90, 'irish-coffee': 90, jarrah: 100,
  'lavender-haze': 130, 'mothers-garden': 0, 'mulled-wine': 0, 'sea-salt-sage': 260, 'spring-blooms': 75, 'sweet-romance': 180, 'tuscan-sandalwood': 60,
};
const WICK: Record<string, [number, number]> = {
  'apple-cider': [-0.02, -0.01], 'black-crescent': [0.02, -0.06], 'candy-cane-lane': [-0.03, 0.04], 'christmas-eve': [-0.02, -0.06],
  'easter-bread': [0.03, -0.01], 'hello-cupcake': [0.02, -0.01], 'irish-coffee': [0, -0.03], jarrah: [-0.04, -0.02], 'lavender-haze': [-0.02, -0.04],
  'mothers-garden': [0.02, -0.02], 'mulled-wine': [-0.02, 0.01], 'sea-salt-sage': [-0.02, -0.04], 'spring-blooms': [0, 0], 'sweet-romance': [-0.02, 0.01],
  'tuscan-sandalwood': [-0.01, -0.01],
};
/** sizes: the radius against a large tin, and the height against the radius (small tins are squatter) */
const SIZE: Record<TinSize, number> = { s: 0.54, m: 0.74, l: 1 };
const TALL: Record<TinSize, number> = { s: 1.02, m: 1.18, l: 1.3 };

interface Placed {
  tin: Tin; key: string; x: number; y: number; R: number; H: number; k: number; depth: number; haze: number;
  /** -1..1: where the sun is, seen from this tin (1: far to its right) */
  sun: number;
  ground: RGB;
  sprite?: HTMLCanvasElement; glow?: HTMLCanvasElement; ox: number; oy: number; textured: boolean;
  wick: [number, number]; seed: number;
  /** transitions: when it starts to rise, when it started to leave */
  born: number; gone: number;
}

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneMQ = () => window.matchMedia('(max-width: 820px)');

// ---------- film grain, made once ----------
let grain: HTMLCanvasElement | null = null;
function rand(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function grainTex() {
  if (grain) return grain;
  grain = document.createElement('canvas'); grain.width = grain.height = 96;
  const x = grain.getContext('2d')!, img = x.createImageData(96, 96), r = rand(31);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 3 + r() * 10; }
  x.putImageData(img, 0, 0);
  return grain;
}

// ---------- one tin, drawn once ----------
function ellipsePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2); }

interface Env { L: Light; sky: RGB; sky2: RGB; orb: RGB; ground: RGB; sun: number }
/** The colour of the black wall across its width (p: 0 = left edge, 1 = right edge). */
function wallColor(p: number, e: Env): RGB {
  const { L } = e, s = p * 2 - 1, nz = Math.sqrt(Math.max(0, 1 - s * s));
  const side = Math.sign(e.sun) || 1, lat = clamp(Math.abs(e.sun) * 1.2, 0.35, 1);
  let c: RGB = [...L.body];
  // the bright sky behind the camera, reflected as a broad soft band down the brushed metal
  const sheen = Math.exp(-((s + side * 0.18) ** 2) / 0.1) * L.sheen + nz * L.sheen * 0.25;
  c = addc(c, mixc(e.sky2, WHITE, 0.25), sheen);
  // the sun (or moon) behind the hills lights only the edge that faces it: a soft glow then a narrow specular line
  const face = Math.max(0, s * side);
  c = addc(c, e.orb, (Math.pow(face, 4) * 0.3 + Math.pow(face, 22) * 1.1) * L.rim * lat);
  // the core shadow on the far side, and a little light bounced up from the ground at its very edge
  const far = Math.max(0, -s * side);
  c = mulc(c, 1 - 0.6 * smooth(far, 0.25, 0.75));
  c = addc(c, e.ground, 0.06 * Math.pow(far, 10));
  return c;
}
function wallGradient(ctx: CanvasRenderingContext2D, R: number, e: Env, lift = 0) {
  const g = ctx.createLinearGradient(-R, 0, R, 0);
  for (let i = 0; i <= 32; i++) { const p = i / 32; g.addColorStop(p, css(mixc(wallColor(p, e), WHITE, lift))); }
  return g;
}

function renderTin(p: Placed, m: Moment, img: HTMLImageElement | null, dpr: number) {
  const L = LIGHT[m.key], sky = hex(m.sky[1]), sky2 = hex(m.sky[2]), orb = hex(m.orb), haze = mixc(sky, sky2, 0.5);
  const e: Env = { L, sky, sky2, orb, ground: p.ground, sun: p.sun };
  const { R, H, k } = p, ck = Math.sqrt(1 - k * k), Hs = H * ck, Ry = R * k;
  const side = Math.sign(p.sun) || 1;
  // the cast shadow runs away from the light, on the ground: toward us (the light is beyond the hills) and to the side
  const sdx = -clamp(p.sun * 0.9, -0.85, 0.85), sdz = Math.sqrt(1 - sdx * sdx), len = H * L.shadow;
  const lidW = p.tin.lid ? R * 2 : 0;
  const left = R * 1.6 + Math.max(sdx < 0 ? len * -sdx : 0, p.tin.lid === -1 ? lidW : 0);
  const right = R * 1.6 + Math.max(sdx > 0 ? len * sdx : 0, p.tin.lid === 1 ? lidW : 0);
  const top = Math.max(Hs + Ry, p.tin.lid ? R * 2.05 : 0) + R * 0.2, bottom = (R * 1.6 + len * sdz) * k + R * 0.2;
  const c = document.createElement('canvas');
  c.width = Math.ceil((left + right) * dpr); c.height = Math.ceil((top + bottom) * dpr);
  const ctx = c.getContext('2d')!;
  const origin = () => ctx.setTransform(dpr, 0, 0, dpr, left * dpr, top * dpr); // the centre of the tin's base, on the ground
  origin();
  p.ox = left; p.oy = top;
  const shade: RGB = mixc([6, 4, 10], p.ground, 0.18);

  // ---- on the ground (drawn in the ground's own plane: a circle there is an ellipse here) ----
  ctx.save(); ctx.scale(1, k);
  if (len > 1) {
    // a long shadow: sharp near the foot, softer and paler as it runs out
    const n = 9;
    for (let i = n - 1; i >= 0; i--) {
      const t = i / (n - 1), cx = sdx * len * t * 0.9, cz = sdz * len * t * 0.9, r = R * (1 + 0.55 * t);
      const g = ctx.createRadialGradient(cx, cz, r * (0.85 - 0.6 * t), cx, cz, r);
      const a = L.shadowA * 0.32 * Math.pow(1 - t, 1.2);
      g.addColorStop(0, css(shade, a)); g.addColorStop(1, css(shade, 0));
      ctx.fillStyle = g; ellipsePath(ctx, cx, cz, r, r); ctx.fill();
    }
  }
  // where the tin meets the ground: dark and tight, then a soft ring of occlusion
  let g = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.5);
  g.addColorStop(0, css(shade, 0.8)); g.addColorStop(0.12, css(shade, 0.55)); g.addColorStop(0.4, css(shade, 0.18)); g.addColorStop(1, css(shade, 0));
  ctx.fillStyle = g; ellipsePath(ctx, 0, 0, R * 1.5, R * 1.5); ctx.fill();
  ctx.restore();

  // ---- the wall ----
  const wall = new Path2D();
  wall.moveTo(-R, -Hs); wall.lineTo(-R, 0); wall.ellipse(0, 0, R, Ry, 0, Math.PI, 0, true); wall.lineTo(R, -Hs); wall.ellipse(0, -Hs, R, Ry, 0, 0, Math.PI, false); wall.closePath();
  ctx.fillStyle = wallGradient(ctx, R, e); ctx.fill(wall);
  ctx.save(); ctx.clip(wall);
  // up the wall: a shadow tucked under the rolled rim, the ground's colour bounced onto the foot, darkest where it meets the ground
  g = ctx.createLinearGradient(0, -Hs, 0, Ry);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.06, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, css(p.ground, 0)); g.addColorStop(0.93, css(p.ground, L.night ? 0.04 : 0.1)); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g; ctx.fillRect(-R, -Hs - Ry, R * 2, Hs + Ry * 2);
  ctx.restore();
  // the rolled rim: a rounded band standing a hair proud of the wall, a crisp highlight along its crown, a crease beneath
  const lip = Math.max(1.4, R * 0.07), RR = R * 1.012;
  ctx.beginPath(); ctx.ellipse(0, -Hs, RR, RR * k, 0, 0, Math.PI, false); ctx.lineTo(-RR, -Hs + lip); ctx.ellipse(0, -Hs + lip, RR, RR * k, 0, Math.PI, 0, true); ctx.closePath();
  ctx.fillStyle = wallGradient(ctx, RR, e, L.night ? 0.03 : 0.06); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -Hs + lip, RR, RR * k, 0, 0.04, Math.PI - 0.04, false);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(0.6, R * 0.016); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -Hs + lip * 0.3, RR, RR * k, 0, 0.03, Math.PI - 0.03, false);
  g = ctx.createLinearGradient(-RR, 0, RR, 0);
  const hi = mixc(orb, WHITE, 0.35), hiA = L.night ? 0.32 : 0.6;
  for (let i = 0; i <= 16; i++) {
    const s = (i / 16) * 2 - 1, face = Math.max(0, s * side);
    g.addColorStop(i / 16, css(hi, hiA * (0.12 + 0.5 * Math.exp(-((s + side * 0.18) ** 2) / 0.05) * L.sheen * 6 + Math.pow(face, 6) * L.rim)));
  }
  ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.7, R * 0.022); ctx.stroke();

  // ---- the top of the rim: a narrow dark ring; backlit, its far edge glints ----
  ellipsePath(ctx, 0, -Hs, RR, RR * k);
  g = ctx.createLinearGradient(0, -Hs - Ry, 0, -Hs + Ry);
  g.addColorStop(0, css(mixc(L.body, sky2, L.night ? 0.1 : 0.22))); g.addColorStop(0.5, css(mixc(L.body, sky2, 0.06))); g.addColorStop(1, css(mixc(L.body, BLACK, 0.3)));
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -Hs, RR * 0.985, RR * k * 0.97, 0, Math.PI + 0.12, Math.PI * 2 - 0.12, false);
  g = ctx.createLinearGradient(-R, 0, R, 0);
  g.addColorStop(0, css(hi, (side < 0 ? 0.75 : 0.25) * L.rim * (1 - L.elev * 0.5))); g.addColorStop(0.5, css(hi, 0.35 * L.rim * (1 - L.elev * 0.5)));
  g.addColorStop(1, css(hi, (side > 0 ? 0.75 : 0.25) * L.rim * (1 - L.elev * 0.5)));
  ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.6, R * 0.018); ctx.stroke();

  // ---- inside: the far inner wall, then the wax a little below the rim (its near edge hidden by the near wall) ----
  const ri = 0.935, dW = R * 0.16 * ck, wy = -Hs + dW;
  ctx.save(); ellipsePath(ctx, 0, -Hs, R * ri, Ry * ri); ctx.clip();
  g = ctx.createLinearGradient(0, -Hs - Ry, 0, -Hs + Ry * 0.3);
  g.addColorStop(0, css(mixc(L.body, BLACK, 0.5))); g.addColorStop(0.7, css(mixc(L.body, sky2, 0.05))); g.addColorStop(1, css(mixc(L.body, sky2, 0.09)));
  ctx.fillStyle = g; ctx.fillRect(-R, -Hs - Ry, R * 2, Ry * 2);
  ctx.save(); ellipsePath(ctx, 0, wy, R * ri, Ry * ri); ctx.clip();
  const rot = (((p.tin.aim ?? (p.tin.lid === 1 ? 305 : 55)) - (TOP_AT[p.tin.top] ?? 0)) * Math.PI) / 180, crop = 0.95, sx = (R * ri) / (260 * crop), sy = (Ry * ri) / (260 * crop);
  if (img) {
    ctx.save(); ctx.translate(0, wy); ctx.scale(sx, sy); ctx.rotate(rot); ctx.drawImage(img, -260, -260, 520, 520); ctx.restore();
  } else {
    // while the photograph loads: plain cream wax
    ctx.fillStyle = '#F2EBDF'; ctx.fillRect(-R, wy - Ry, R * 2, Ry * 2);
  }
  // the wax takes the light of the hour
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = css(L.wax); ctx.fillRect(-R, wy - Ry, R * 2, Ry * 2);
  ctx.globalCompositeOperation = 'source-over';
  if (L.waxLift) { ctx.fillStyle = css(sky2, L.waxLift); ctx.fillRect(-R, wy - Ry, R * 2, Ry * 2); }
  // darker toward the far rim, where the wall shades it (more when the light is low), and a soft edge all round
  g = ctx.createLinearGradient(0, wy - Ry * ri, 0, wy + Ry * ri);
  g.addColorStop(0, `rgba(10,6,12,${(0.46 - L.elev * 0.24).toFixed(3)})`); g.addColorStop(0.22, `rgba(10,6,12,${(0.22 - L.elev * 0.1).toFixed(3)})`); g.addColorStop(0.6, 'rgba(10,6,12,0)'); g.addColorStop(1, 'rgba(10,6,12,0.12)');
  ctx.fillStyle = g; ctx.fillRect(-R, wy - Ry, R * 2, Ry * 2);
  ctx.save(); ctx.translate(0, wy); ctx.scale(1, k);
  g = ctx.createRadialGradient(0, 0, R * ri * 0.6, 0, 0, R * ri);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(14,8,16,0.26)');
  ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
  ctx.restore();
  ctx.restore();
  // the inner edge of the near rim: a fine bright line, and its thickness just below
  ctx.beginPath(); ctx.ellipse(0, -Hs, R * ri, Ry * ri, 0, 0.08, Math.PI - 0.08, false);
  ctx.strokeStyle = css(mixc(sky2, orb, 0.4), L.night ? 0.14 : 0.32); ctx.lineWidth = Math.max(0.5, R * 0.012); ctx.stroke();

  // ---- the flat wooden wick, standing where it sits in the photograph ----
  const [wxf, wyf] = WICK[p.tin.top] ?? [0, 0];
  const ix = wxf * 520 * Math.cos(rot) - wyf * 520 * Math.sin(rot), iy = wxf * 520 * Math.sin(rot) + wyf * 520 * Math.cos(rot);
  const bx = ix * sx, by = wy + iy * sy;
  const bw = R * 0.3, bh = R * (p.tin.lit ? 0.08 : 0.11) * ck, hx = Math.cos(rot) * bw * 0.5, hy = Math.sin(rot) * bw * 0.5 * k;
  ctx.save(); ctx.translate(bx, by); ctx.scale(1, k);
  g = ctx.createRadialGradient(R * 0.04, 0, 0, R * 0.04, 0, bw * 0.7); g.addColorStop(0, 'rgba(30,18,12,0.35)'); g.addColorStop(1, 'rgba(30,18,12,0)');
  ctx.fillStyle = g; ellipsePath(ctx, R * 0.04, 0, bw * 0.7, bw * 0.7); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(bx - hx, by - hy); ctx.lineTo(bx + hx, by + hy); ctx.lineTo(bx + hx, by + hy - bh); ctx.lineTo(bx - hx, by - hy - bh); ctx.closePath();
  const wood = mixc([168, 124, 86], L.wax, L.night ? 0.5 : 0), woodDark: RGB = mixc([96, 64, 42], L.wax, L.night ? 0.4 : 0);
  g = ctx.createLinearGradient(0, by - bh, 0, by);
  if (p.tin.lit) { g.addColorStop(0, '#120B08'); g.addColorStop(0.4, '#2E1C12'); g.addColorStop(0.55, css(wood)); g.addColorStop(1, css(woodDark)); }
  else { g.addColorStop(0, css(mixc(wood, WHITE, 0.12))); g.addColorStop(1, css(woodDark)); }
  ctx.fillStyle = g; ctx.fill();
  // the top edge of the thin board catches the light
  ctx.beginPath(); ctx.moveTo(bx - hx, by - hy - bh); ctx.lineTo(bx + hx, by + hy - bh); ctx.strokeStyle = p.tin.lit ? "rgba(40,24,16,0.9)" : css(mixc([226, 196, 160], L.wax, L.night ? 0.5 : 0), 0.9); ctx.lineWidth = Math.max(0.5, R * 0.025); ctx.stroke();
  p.wick = [bx, by - bh];

  // ---- the lid, leaning against the tin, its face toward us and a little outward ----
  let lidShape: ((x: CanvasRenderingContext2D) => void) | null = null;
  if (p.tin.lid) {
    const s = p.tin.lid, RL = R * 1.02, yaw = 0.9, lean = 0.95, a = RL * Math.cos(yaw), b = RL * (Math.cos(lean) * ck + Math.sin(lean) * k), T = R * 0.2;
    const cx = s * (R + a * 0.5), cy = -b + Ry * 0.5, tilt = -s * 0.12;
    ctx.save(); ctx.translate(cx + s * a * 0.15, Ry * 0.6); ctx.scale(1, k * 0.8);
    g = ctx.createRadialGradient(0, 0, a * 0.5, 0, 0, a * 1.35); g.addColorStop(0, css(shade, 0.6)); g.addColorStop(1, css(shade, 0));
    ctx.fillStyle = g; ellipsePath(ctx, 0, 0, a * 1.35, a * 1.35); ctx.fill(); ctx.restore();
    // the lid's outline (face and skirt), so a lit tin's glow is kept off it
    lidShape = x => { x.save(); x.translate(cx, cy); x.rotate(tilt); for (let i = 6; i >= 0; i--) { ellipsePath(x, -s * T * Math.sin(yaw) * (i / 6), 0, a * 1.01, b * 1.01); x.fill(); } x.restore(); };
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
    // the skirt, running back toward the tin
    const skirt = mixc(L.body, BLACK, 0.35);
    for (let i = 6; i >= 1; i--) { ellipsePath(ctx, -s * T * Math.sin(yaw) * (i / 6), 0, a, b); ctx.fillStyle = css(skirt); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(-s * T * Math.sin(yaw), 0, a, b, 0, -Math.PI * 0.5, Math.PI * 0.5, s < 0);
    ctx.strokeStyle = css(hi, (L.night ? 0.1 : 0.2) * L.rim); ctx.lineWidth = Math.max(0.5, R * 0.014); ctx.stroke();
    // the face: matte black with a broad soft sheen of the sky
    ellipsePath(ctx, 0, 0, a, b);
    const face = L.body;
    g = ctx.createLinearGradient(-a * 0.8, -b, a * 0.5, b);
    g.addColorStop(0, css(addc(face, mixc(sky2, WHITE, 0.2), L.sheen * 0.9))); g.addColorStop(0.45, css(addc(face, sky2, L.sheen * 0.35))); g.addColorStop(1, css(mixc(face, BLACK, 0.35)));
    ctx.fillStyle = g; ctx.fill();
    // its rolled edge: a crisp line on top toward the light, darker underneath; a pressed ring inside
    ctx.beginPath(); ctx.ellipse(0, 0, a * 0.975, b * 0.975, 0, Math.PI * 1.05, Math.PI * 1.95, false);
    g = ctx.createLinearGradient(-a, 0, a, 0);
    g.addColorStop(0, css(hi, (side < 0 ? 0.7 : 0.25) * (L.night ? 0.5 : 1))); g.addColorStop(1, css(hi, (side > 0 ? 0.7 : 0.25) * (L.night ? 0.5 : 1)));
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.7, R * 0.024); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, a * 0.975, b * 0.975, 0, Math.PI * 0.05, Math.PI * 0.95, false);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
    ellipsePath(ctx, 0, 0, a * 0.86, b * 0.86); ctx.strokeStyle = css(mixc(sky2, WHITE, 0.3), L.night ? 0.04 : 0.07); ctx.lineWidth = Math.max(0.5, R * 0.012); ctx.stroke();
    ctx.restore();
  }

  // ---- grass in front of its foot, so it stands in the knoll rather than on it ----
  {
    const r = rand(Math.round(p.seed * 1000) + 7), gs = clamp(R / 50, 0.5, 1.4), blade = mixc(p.ground, BLACK, 0.32), tipC = mixc(p.ground, orb, L.night ? 0.2 : 0.3);
    ctx.lineCap = 'round';
    for (let i = 0; i < 54; i++) {
      const u = r() * 2.4 - 1.2, bx = u * R, by = Ry * Math.sqrt(Math.max(0, 1 - u * u)) + r() * Ry * 0.22;
      const hh = (2.5 + Math.pow(r(), 1.5) * 7) * gs, lean = (r() - 0.5) * hh * 0.9;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + lean * 0.3, by - hh * 0.6, bx + lean, by - hh);
      ctx.strokeStyle = css(r() < 0.22 ? tipC : blade, 0.9); ctx.lineWidth = Math.max(0.6, 0.85 * gs); ctx.stroke();
    }
  }

  // ---- the haze of distance (far tins only) and a fine grain, so the tin sits in the painting instead of on it ----
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop';
  const hz = clamp(p.haze * L.haze, 0, 0.55);
  if (hz > 0.005) { ctx.fillStyle = css(haze, hz); ctx.fillRect(0, 0, c.width, c.height); }
  ctx.fillStyle = ctx.createPattern(grainTex(), 'repeat')!; ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
  p.sprite = c; p.textured = !!img;

  // ---- a lit tin: the flame's warm light on the wax, the far inner wall and the rim (drawn with 'lighter' each frame) ----
  if (p.tin.lit) {
    const gl = document.createElement('canvas'); gl.width = c.width; gl.height = c.height;
    const x = gl.getContext('2d')!; x.setTransform(dpr, 0, 0, dpr, left * dpr, top * dpr);
    x.save(); ellipsePath(x, 0, -Hs, R * ri, Ry * ri); x.clip();
    x.translate(bx, by - bh * 0.5); x.scale(1, 0.62);
    const gg = x.createRadialGradient(0, 0, 0, 0, 0, R * 1.1);
    gg.addColorStop(0, 'rgba(255,200,130,0.85)'); gg.addColorStop(0.18, 'rgba(255,170,90,0.55)'); gg.addColorStop(0.5, 'rgba(230,120,50,0.22)'); gg.addColorStop(1, 'rgba(200,90,30,0)');
    x.fillStyle = gg; x.fillRect(-R * 1.2, -R * 1.8, R * 2.4, R * 3.6); x.restore();
    x.beginPath(); x.ellipse(0, -Hs, R * 0.99, Ry * 0.99, 0, Math.PI + 0.25, Math.PI * 2 - 0.25, false);
    x.strokeStyle = 'rgba(255,170,90,0.4)'; x.lineWidth = Math.max(0.6, R * 0.02); x.stroke();
    if (lidShape) { x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; lidShape(x); x.globalCompositeOperation = 'source-over'; }
    p.glow = gl;
  }
}

// soft round glows, drawn once and stretched where needed (cheaper each frame than a fresh gradient over a large area)
const glows: Record<string, HTMLCanvasElement> = {};
function glowTex(kind: 'halo' | 'pool') {
  if (glows[kind]) return glows[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (kind === 'halo') { g.addColorStop(0, 'rgba(255,200,130,0.42)'); g.addColorStop(0.18, 'rgba(255,160,80,0.16)'); g.addColorStop(0.5, 'rgba(255,140,60,0.05)'); g.addColorStop(1, 'rgba(255,140,60,0)'); }
  else { g.addColorStop(0, 'rgba(255,172,96,0.34)'); g.addColorStop(0.25, 'rgba(255,172,96,0.34)'); g.addColorStop(0.55, 'rgba(255,150,80,0.12)'); g.addColorStop(1, 'rgba(255,140,70,0)'); }
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (glows[kind] = c);
}

// ---------- flames: a bright core, a warm body that thins to a tip, a soft bloom ----------
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number) {
  const sway = Math.sin(t * 2.1 + seed) * 0.6 + Math.sin(t * 5.3 + seed * 1.7) * 0.3 + Math.sin(t * 12.7 + seed * 3.1) * 0.1;
  const h = s * (1 + 0.07 * Math.sin(t * 3.7 + seed) + 0.04 * Math.sin(t * 9.2 + seed * 2));
  const w = s * 0.25, tip = sway * s * 0.09;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowTex('halo'), x - s * 3, y - h * 0.42 - s * 3, s * 6, s * 6);
  let g: CanvasGradient;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.06);
  ctx.bezierCurveTo(x - w * 1.2, y - h * 0.08, x - w * 0.85 + tip * 0.4, y - h * 0.62, x + tip, y - h);
  ctx.bezierCurveTo(x + w * 0.85 + tip * 0.4, y - h * 0.62, x + w * 1.2, y - h * 0.08, x, y + s * 0.06);
  g = ctx.createLinearGradient(0, y + s * 0.06, 0, y - h);
  g.addColorStop(0, 'rgba(120,130,255,0.45)'); g.addColorStop(0.12, 'rgba(255,236,196,0.97)'); g.addColorStop(0.45, 'rgba(255,214,140,0.96)'); g.addColorStop(0.8, 'rgba(255,150,60,0.72)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + tip * 0.15, y - h * 0.3, w * 0.45, h * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,246,0.92)'; ctx.fill();
}

// ---------- the knoll: the nearest layer of the landscape, the group's ground ----------
interface Knoll {
  /** its outline (the top edge) at x, and its colour at a height */
  y: (x: number) => number; color: (y: number) => RGB;
  crest: number; top: RGB; foot: RGB;
  /** the tins' size against a large tin of 90 px, for the grass */
  scale: number;
  /** where the group stands: no dried sprigs there (they would poke out between the tins) */
  avoid: [number, number];
}
function drawKnoll(ctx: CanvasRenderingContext2D, kn: Knoll, w: number, h: number, dpr: number, m: Moment) {
  const orb = hex(m.orb), r = rand(97), gs = clamp(kn.scale, 0.5, 1.2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const outline = () => { ctx.beginPath(); ctx.moveTo(-4, h + 4); for (let x = -4; x <= w + 4; x += 3) ctx.lineTo(x, kn.y(x)); ctx.lineTo(w + 4, h + 4); ctx.closePath(); };
  // the body: lit at the crest, darker toward us; no haze (it is the nearest thing in the picture)
  outline();
  const g = ctx.createLinearGradient(0, kn.crest, 0, h);
  g.addColorStop(0, css(kn.top)); g.addColorStop(0.35, css(mixc(kn.top, kn.foot, 0.45))); g.addColorStop(1, css(kn.foot));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // a soft band of light just inside the crest, and the grass texture over the face, thinning toward us
  ctx.lineCap = 'round';
  for (let i = 0; i < w * 0.9; i++) {
    const x = r() * w, y0 = kn.y(x), y = y0 + 4 + Math.pow(r(), 1.8) * (h - y0), d = (y - y0) / Math.max(1, h - y0);
    const len = (2 + r() * 4) * gs * (1 + d * 0.6);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * len * 0.8, y - len);
    ctx.strokeStyle = css(r() < 0.5 ? mixc(kn.color(y), BLACK, 0.22) : mixc(kn.color(y), orb, 0.18), 0.35 * (1 - d * 0.5)); ctx.lineWidth = 0.8 * gs; ctx.stroke();
  }
  ctx.restore();
  // the rim of light along its edge, from the sun or moon behind
  ctx.beginPath(); for (let x = -4; x <= w + 4; x += 3) (x < -3 ? ctx.moveTo(x, kn.y(x)) : ctx.lineTo(x, kn.y(x)));
  ctx.strokeStyle = css(mixc(orb, WHITE, 0.2), m.dark ? 0.22 : 0.4); ctx.lineWidth = 1.3; ctx.stroke();
  // grass along the crest, at the tins' scale: fine blades, some catching the light at their tips
  const blade = mixc(kn.top, BLACK, 0.3), tip = mixc(kn.top, orb, m.dark ? 0.22 : 0.32);
  for (let x = -4; x < w + 4; x += 1.1 + r() * 1.6) {
    const y = kn.y(x) + 1 + r() * 2.5, hh = (3 + Math.pow(r(), 1.6) * 10) * gs, lean = (r() - 0.45) * hh * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.25, y - hh * 0.6, x + lean, y - hh);
    ctx.strokeStyle = css(r() < 0.22 ? tip : blade, 0.9); ctx.lineWidth = Math.max(0.6, (0.7 + r() * 0.6) * gs); ctx.stroke();
  }
  // a few dried sprigs (like the lavender and seed heads on Claire's tops), only away from the group
  const head = m.dark ? mixc(kn.top, orb, 0.2) : mixc(kn.top, [196, 168, 120], 0.55), lav = m.dark ? head : mixc(kn.top, [146, 120, 170], 0.6);
  for (let n = 0; n < 9; n++) {
    const x = r() * w;
    if (x > kn.avoid[0] - 20 && x < kn.avoid[1] + 20) continue;
    const y = kn.y(x) + 2, hh = (16 + r() * 16) * gs, lean = (r() - 0.5) * hh * 0.5, c = n % 2 ? lav : head;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - hh * 0.6, x + lean, y - hh);
    ctx.strokeStyle = css(blade, 0.95); ctx.lineWidth = 0.8 * gs; ctx.stroke();
    for (let b = 0; b < 6; b++) {
      const t = 0.62 + b * 0.065, bx = x + lean * t * t, by = y - hh * t;
      ctx.beginPath(); ctx.ellipse(bx + (b % 2 ? 1 : -1) * 1.1 * gs, by, 1.1 * gs, 2.2 * gs, (b % 2 ? 0.5 : -0.5), 0, Math.PI * 2);
      ctx.fillStyle = css(c, 0.95); ctx.fill();
    }
  }
  // the landscape's fine grain
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = ctx.createPattern(grainTex(), 'repeat')!; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- the hero ----------
export interface TinsHero { show(key: string): void; destroy(): void }

/** Mount the tins on the opening. `stack` is #dStack: it holds the photographs (hidden <img data-top>) that texture the tops. */
export function mountTins(app: HTMLElement, stack: HTMLElement, sets: Record<string, Tin[]>): TinsHero {
  const hero = app.querySelector<HTMLElement>('#day')!;
  const canvas = document.createElement('canvas');
  canvas.className = 'tins3d'; canvas.setAttribute('aria-hidden', 'true');
  const grounds = [0, 1].map(() => { const g = document.createElement('canvas'); g.className = 'tins-ground'; g.setAttribute('aria-hidden', 'true'); return g; });
  const knolls = [0, 1].map(() => { const g = document.createElement('canvas'); g.className = 'tins-knoll'; g.setAttribute('aria-hidden', 'true'); return g; });
  let ctx = canvas.getContext('2d')!;
  let key = '', placed: Placed[] = [], leaving: Placed[] = [], phone = false, W = 0, Hc = 0, dpr = DPR();
  let raf = 0, visible = true, alive = true, lastT = 0, groundFront = 0, groundKey = '', knollFront = 0;
  let laidKey = '', lastBox: Box | null = null;
  const imgs = new Map<string, HTMLImageElement>(); // top -> loaded image

  /** the photograph for a top, loading it if it was left for later */
  const imgFor = (top: string): HTMLImageElement | null => {
    const el = stack.querySelector<HTMLImageElement>(`img[data-top="${top}"]`);
    if (!el) return null;
    if (el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; }
    if (el.complete && el.naturalWidth > 0) { imgs.set(top, el); return el; }
    if (!el.dataset.wait) { el.dataset.wait = '1'; el.addEventListener('load', () => { imgs.set(top, el); retexture(top); }, { once: true }); }
    return null;
  };
  const retexture = (top: string) => {
    if (!alive) return;
    const m = MOMENTS.find(x => x.key === key);
    if (!m) return;
    placed.filter(p => p.tin.top === top && !p.textured).forEach(p => renderTin(p, m, imgs.get(top) ?? null, dpr));
    markShown(); kick();
  };
  const markShown = () => { if (placed.length && placed.every(p => p.textured)) stack.dataset.shown = key; };

  // ---------- geometry: the knoll and the group on it ----------
  const rel = (el: Element | null, to: DOMRect) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left - to.left, t: r.top - to.top, r: r.right - to.left, b: r.bottom - to.top, w: r.width, h: r.height }; };

  /** the canvas's own box, without the transforms the scene puts on it (parallax, breathing) */
  const layoutBox = (el: HTMLElement) => {
    const parent = el.offsetParent as HTMLElement | null;
    const pr = parent?.getBoundingClientRect() ?? new DOMRect();
    return new DOMRect(pr.left + el.offsetLeft, pr.top + el.offsetTop, el.offsetWidth, el.offsetHeight);
  };

  function mountCanvas() {
    phone = phoneMQ().matches;
    if (phone) {
      // the band above the words: the width of the hero, hills of their own behind the knoll
      grounds.forEach(g => { if (g.parentElement !== stack) stack.prepend(g); });
      knolls.forEach(g => { if (g.parentElement !== stack) stack.append(g); });
      if (canvas.parentElement !== stack) stack.append(canvas);
      // (offsets, not on-screen boxes: the opening and the tilt move the stack while this measures)
      let x = 0; for (let el: HTMLElement | null = stack; el && el !== hero && hero.contains(el); el = el.offsetParent as HTMLElement | null) x += el.offsetLeft;
      const box = { left: `${-x}px`, top: '0px', width: `${hero.clientWidth}px`, height: `${stack.clientHeight}px` };
      [canvas, ...grounds, ...knolls].forEach(c => Object.assign(c.style, box));
    } else {
      grounds.forEach(g => g.remove());
      const lands = app.querySelectorAll('#scene canvas.land');
      const last = lands[lands.length - 1];
      if (last && canvas.previousElementSibling !== knolls[1]) { last.after(knolls[0], knolls[1], canvas); }
      [canvas, ...knolls].forEach(c => ['left', 'top', 'width', 'height'].forEach(p => c.style.removeProperty(p)));
    }
    stack.dataset.mode = phone ? 'phone' : 'desktop';
  }

  function size() {
    dpr = DPR();
    W = canvas.clientWidth; Hc = canvas.clientHeight;
    const bw = Math.round(W * dpr), bh = Math.round(Hc * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; ctx = canvas.getContext('2d')!; }
  }

  function paintGround(m: Moment) {
    if (!phone || groundKey === m.key) return;
    const back = grounds[1 - groundFront];
    drawLandscape(back, { sky: m.sky, land: m.land, orb: m.orb, dark: m.dark }, 5);
    groundFront = 1 - groundFront; groundKey = m.key;
    grounds.forEach((g, i) => g.classList.toggle('on', i === groundFront));
  }

  /** The sun dial's arc, as a height on this canvas at x (its path is M40,140 Q500,-60 960,140 in a 1000 x 150 box: x runs
   *  evenly along it, so the height is a simple function of x). null where there is no arc. */
  function arcAt(box: DOMRect): ((x: number) => number) | null {
    const svg = app.querySelector<SVGSVGElement>('#arc');
    if (!svg || phone) return null;
    const r = svg.getBoundingClientRect();
    if (!r.width) return null;
    return x => {
      const t = clamp((((x + box.left - r.left) / r.width) * 1000 - 40) / 920, 0, 1);
      return r.top - box.top + ((140 - 400 * t + 400 * t * t) / 150) * r.height;
    };
  }

  /** Place a moment's group: the knoll's shape and the three tins on it, in the room the words and the offers leave. */
  function place(m: Moment): { tins: Placed[]; knoll: Knoll } | null {
    if (!W || !Hc) return null;
    const box = layoutBox(canvas);
    const k = 0.42; // seen from a little above, as near things below the horizon are
    let R: number, cx: number, fb: number;
    if (phone) {
      // the whole group fits the width (the lid on the left included), centred
      R = clamp(Math.min(W * 0.19, (W - 32) / 5.75), 40, 82);
      cx = W / 2 + 0.88 * R; fb = Hc - R * 0.62;
    } else {
      const copy = rel(app.querySelector('.day-copy'), box), cards = rel(app.querySelector('#dProducts'), box);
      const a = (copy ? copy.r : W * 0.5) + 36, vis = Math.min(hero.getBoundingClientRect().height, window.innerHeight);
      // the large tin: about a quarter of the opening's visible height, smaller when the room beside the words is narrow
      R = clamp(Math.min(vis * 0.105, (W - a - 150) / 5.9), 40, 92);
      cx = clamp(W * 0.75, a + 3.8 * R, W - 2.05 * R - 150);
      // the front of the group sits just above the dial's arc (so the sun never passes behind a tin), within the canvas
      const arc = arcAt(box);
      fb = Hc - 24;
      if (arc) for (let x = cx - 3.8 * R; x <= cx + 2.1 * R; x += 8) fb = Math.min(fb, arc(x) - 16);
      // and on the first screen
      fb = Math.min(fb, window.innerHeight - (box.top + window.scrollY) - 26);
      // and the large tin's top stays clear of the offers
      if (cards) { const top = fb - 0.95 * R * k - R * TALL.l * 0.91 - R * k - R * 0.9; if (top < cards.b + 12) fb += cards.b + 12 - top; }
    }
    // three tins: [spot, x, how far back their foot is (in units of R * k)]
    const AT: Record<TinSpot, [number, number]> = { back: [0.12, 0.95], left: [-1.5, 0.35], right: [1.42, 0] };
    const backFoot = fb - AT.back[1] * R * k;
    const crest = backFoot - R * k * 1.3, kc = cx - 0.3 * R;
    // a broad, gently rounded knoll: its left flank runs down well past the group, its right one off the edge
    const spanL = Math.max(R * 3, kc - (phone ? -W * 0.25 : cx - 7.4 * R)), spanR = (phone ? W * 1.2 - kc : (W - kc) / 0.6);
    const sky = hex(m.land[2]), orb = hex(m.orb);
    const top = mixc(mulc(sky, m.dark ? 0.94 : 0.9), orb, m.dark ? 0.06 : 0.1), foot = mulc(sky, m.dark ? 0.74 : 0.68);
    const drop = Hc + 30 - crest;
    const knoll: Knoll = {
      crest, top, foot, scale: R / 90,
      y: x => { const u = x < kc ? (kc - x) / spanL : (x - kc) / spanR; return crest + drop * Math.pow(Math.min(u, 1.4), 2.1) + 1.6 * Math.sin(x * 0.031 + 1.3) + 1.1 * Math.sin(x * 0.083); },
      color: y => mixc(top, foot, clamp((y - crest) / Math.max(1, Hc - crest), 0, 1)),
      avoid: [cx - 3.8 * R, cx + 2.1 * R],
    };
    const sunX = (sunAt(m) / 1000) * W;
    const out: Placed[] = (sets[m.key] ?? []).map((tin, i) => {
      const [u, back] = AT[tin.at], Ri = R * SIZE[tin.size], x = cx + u * R, y = fb - back * R * k;
      return { tin, key: m.key, x, y, R: Ri, H: Ri * TALL[tin.size], k, depth: 0, haze: 0, sun: clamp((sunX - x) / (W * 0.3), -1, 1), ground: knoll.color(y), ox: 0, oy: 0, textured: false, wick: [0, 0], seed: i * 1.7 + 0.37, born: 0, gone: 0 };
    });
    return { tins: out.sort((p, q) => p.y - q.y), knoll };
  }

  /** Paint the knoll for a moment into the back knoll canvas, then cross-fade to it. */
  function paintKnoll(m: Moment, kn: Knoll) {
    const back = knolls[1 - knollFront];
    const bw = Math.round(W * dpr), bh = Math.round(Hc * dpr);
    back.width = bw; back.height = bh;
    drawKnoll(back.getContext('2d')!, kn, W, Hc, dpr, m);
    knollFront = 1 - knollFront;
    knolls.forEach((g, i) => g.classList.toggle('on', i === knollFront));
  }

  // where the sun is across the dial for a moment (the same curve as the dial in home.ts), in 0..1000
  const sunAt = (m: Moment) => 40 + 920 * clamp((m.hour - 6) / 16, 0, 1);

  function arrange(m: Moment, animate: boolean) {
    const laid = place(m);
    if (!laid) { laidKey = ''; return false; }
    const next = laid.tins;
    paintKnoll(m, laid.knoll);
    const now = performance.now();
    next.forEach((p, i) => { renderTin(p, m, imgFor(p.tin.top), dpr); p.born = animate ? now + 140 + i * 90 : -1e9; });
    if (animate) placed.forEach((p, i) => { p.gone = now + i * 40; leaving.push(p); });
    placed = next; laidKey = m.key;
    stack.dataset.tins = String(next.length);
    // the group's outline on the canvas (left, top, right, bottom, and the large tin's height), for the tests of its layout
    const big = next.find(p => p.tin.at === 'back');
    canvas.dataset.group = [Math.min(...next.map(p => p.x - p.R * (p.tin.lid ? 3 : 1))), Math.min(...next.map(p => p.y - p.H - p.R * p.k)), Math.max(...next.map(p => p.x + p.R)), Math.max(...next.map(p => p.y + p.R * p.k)), big ? big.H + big.R * big.k * 2 : 0].map(v => Math.round(v)).join(',');
    delete stack.dataset.shown; markShown();
    return true;
  }

  // ---------- drawing ----------
  function draw(now: number) {
    const t = now / 1000, still = reduce();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // clear only where tins were or will be drawn (their sprites, glows and flames, with room for the rise and the lean)
    const all = [...leaving, ...placed];
    let box: Box | null = null;
    for (const p of all) {
      if (!p.sprite) continue;
      // the sprite, the flame above it and, for a lit tin, its pool of light on the ground
      const pool = p.tin.lit ? p.R * 3.3 : 0;
      const l = Math.min(p.x - p.ox - 10, p.x - pool), tp = p.y - p.oy - p.R * 1.6 - 4, r = Math.max(p.x - p.ox + p.sprite.width / dpr + 10, p.x + pool), bt = Math.max(p.y - p.oy + p.sprite.height / dpr + p.R + 30, p.y + pool * p.k + 4); box = box ? { l: Math.min(box.l, l), t: Math.min(box.t, tp), r: Math.max(box.r, r), b: Math.max(box.b, bt) } : { l, t: tp, r, b: bt }; }
    const dirty = [box, lastBox].filter(Boolean) as Box[];
    if (dirty.length) { const u = dirty.reduce((a, q) => ({ l: Math.min(a.l, q.l), t: Math.min(a.t, q.t), r: Math.max(a.r, q.r), b: Math.max(a.b, q.b) })); ctx.clearRect(Math.floor(u.l * dpr), Math.floor(u.t * dpr), Math.ceil((u.r - u.l) * dpr) + 2, Math.ceil((u.b - u.t) * dpr) + 2); }
    lastBox = box;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let busy = false;
    all.sort((p, q) => p.y - q.y);
    for (const p of all) {
      if (!p.sprite) continue;
      let a = 1, dy = 0;
      if (p.gone) { const k = clamp((now - p.gone) / 520, 0, 1); a = 1 - k; dy = k * 6; if (k < 1) busy = true; }
      else if (p.born > now - 1100) { const k = clamp((now - p.born) / 1000, 0, 1); a = easeOut(clamp(k * 1.4, 0, 1)); dy = (1 - easeOut(k)) * (12 + p.R * 0.35); busy = true; }
      if (a <= 0.003) continue;
      // nearer tins lean a few pixels more with the pointer than the hills do
      const x = p.x, y = p.y + dy;
      ctx.globalAlpha = a;
      if (p.tin.lit) {
        // the flame's warm pool of light on the ground around the tin
        const fl = still ? 0.9 : 0.86 + 0.09 * Math.sin(t * 2.3 + p.seed) + 0.05 * Math.sin(t * 7.1 + p.seed * 1.3);
        ctx.globalAlpha = a * fl; ctx.drawImage(glowTex('pool'), x - p.R * 3.2, y - p.R * 3.2 * p.k, p.R * 6.4, p.R * 6.4 * p.k); ctx.globalAlpha = a;
      }
      ctx.drawImage(p.sprite, x - p.ox, y - p.oy, p.sprite.width / dpr, p.sprite.height / dpr);
      if (p.tin.lit && p.glow) {
        const fl = still ? 0.9 : 0.82 + 0.12 * Math.sin(t * 2.3 + p.seed) + 0.06 * Math.sin(t * 7.1 + p.seed * 1.3);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * fl;
        ctx.drawImage(p.glow, x - p.ox, y - p.oy, p.glow.width / dpr, p.glow.height / dpr);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
        flame(ctx, x + p.wick[0], y + p.wick[1] - p.R * 0.01, p.R * 0.48, still ? 0 : t, p.seed);
        if (!still) busy = true;
      }
    }
    ctx.globalAlpha = 1;
    leaving = leaving.filter(p => now - p.gone < 520);
    return busy;
  }

  const loop = (now: number) => {
    raf = 0;
    if (!alive) return;
    if (!canvas.isConnected) { destroy(); return; }
    // flames alone are drawn at about 30 frames a second
    const onlyFlames = !leaving.length && placed.every(p => p.born < now - 1100);
    if (onlyFlames && now - lastT < 30) { raf = requestAnimationFrame(loop); return; }
    lastT = now;
    const busy = draw(now);
    if (busy && visible && !document.hidden && !reduce()) raf = requestAnimationFrame(loop);
  };
  function kick() { if (!raf && alive) raf = requestAnimationFrame(loop); }

  function relayout() {
    if (!alive) return;
    if (!hero.isConnected) { destroy(); return; }
    mountCanvas(); size();
    const m = MOMENTS.find(x => x.key === key);
    if (!m) return;
    groundKey = '';
    paintGround(m);
    if (arrange(m, false)) leaving = [];
    kick();
  }

  // ---------- events ----------
  let rt = 0;
  const onResize = () => { window.clearTimeout(rt); rt = window.setTimeout(relayout, 320); };
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(() => onResize());
  const prods = app.querySelector('#dProducts'); if (prods) ro.observe(prods);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) kick(); });
  io.observe(hero);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  function destroy() {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf); raf = 0; window.clearTimeout(rt);
    window.removeEventListener('resize', onResize); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
    canvas.remove(); grounds.forEach(g => g.remove()); knolls.forEach(g => g.remove());
  }

  mountCanvas(); size();
  return {
    show(k: string) {
      if (!alive) return;
      const m = MOMENTS.find(x => x.key === k);
      if (!m) return;
      if (k === key && laidKey === k) return;
      const first = !key;
      key = k;
      if (!W || !Hc) size();
      paintGround(m);
      // the hills may not be painted yet (or the hero not laid out): try again shortly
      if (!arrange(m, !first && !reduce())) { window.clearTimeout(rt); rt = window.setTimeout(relayout, 200); }
      if (first) placed.forEach(p => { p.born = -1e9; });
      // every other moment's photographs load when the page is idle, so changing the time never waits on the network
      if (first) {
        const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
        idle(() => { if (alive) Object.values(sets).flat().forEach(t => imgFor(t.top)); });
      }
      kick();
    },
    destroy,
  };
}
