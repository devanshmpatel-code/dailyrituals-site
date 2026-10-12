// The flame of a wooden wick, drawn on a canvas over Claire's candle photographs (the breathing pause and the coaching page).
//
// A candle flame seen in a dim room is a slim teardrop: round at the foot, widest about a third of the way up, drawn out to
// a point. Where the wax vapour first burns, around the foot, it is a faint blue and nearly see-through (the wick shows
// through); above that the soot glows: a yellow-white core low in the flame, yellow around it, orange at the edges, and an
// orange tip that fades to nothing. Each layer is light added to the night behind it, so the sprite is built from emitted
// light per colour channel and a soft camera-like response (1 - e^-light), which keeps the core near white without
// flattening the whole flame into a white blob. It is painted once per size, then drawn every frame in strips, so it can
// lean, ripple, catch, breathe and flicker (slow value noise, never a keyframe wobble).

export interface FlameWick {
  /** the flame's base, as fractions of the photo's width and height */
  x: number; y: number;
  /** the photographed flame's height and width, as fractions of the photo's width */
  h: number; w: number;
  /** 0: a round dome, 1: a gently pointed tip */
  tip?: number;
  /** the flame's foot is hidden behind a glass rim: nothing is drawn below its base */
  rim?: boolean;
}

// a small seeded value noise
const hash = (x: number) => { let h = (x * 374761393) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000; };
export const noise1 = (t: number, seed = 0) => { const x = t + seed * 31.7, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i) + (hash(i + 1) - hash(i)) * u) * 2 - 1; };
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** a flame stands this many times taller than the photographed one measured (its foot, low and dim, was lost in the glare) */
const TALL = 1.3;

const offscreen = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d')!] as const; };

export interface Sprite { c: HTMLCanvasElement; /** row of the flame's base */ by: number; /** the flame's height in sprite px */ hpx: number }

/**
 * The flame painted at height hpx (device px), aspect = width / height, tip 0 (fuller shoulders) to 1 (drawn out to a point);
 * base: the flame's foot is in view, so it gets its blue cup (behind a glass rim the foot is hidden anyway).
 */
export function flameSprite(hpx: number, aspect: number, tip: number, base: boolean): Sprite {
  const H = Math.max(8, Math.round(hpx)), W = H * aspect, pad = Math.ceil(H * 0.08);
  const by = H + pad, cw = Math.ceil(W * 1.3 + pad * 2), ch = Math.ceil(by + H * 0.08 + pad);
  const [c, g] = offscreen(cw, ch), img = g.createImageData(c.width, c.height), d = img.data, cx = c.width / 2;
  // the outline: half-width ~ s^a (1-s)^b along the flame (s: 0 at its foot, 1 at the tip), widest at a / (a + b)
  const foot = 0.05, a = 0.45, b = 0.85 + 0.55 * tip, peak = a / (a + b), norm = 1 / (peak ** a * (1 - peak) ** b);
  const soft = Math.max(0.55, H * 0.02), sig = (x: number) => 1 / (1 + Math.exp(-x / soft));
  for (let y = 0; y < c.height; y++) {
    const s = ((by - y) / H + foot) / (1 + foot); // the round foot reaches a little below the base, around the top of the wick
    const hw = s <= 0 ? s * H * 2 : s >= 1 ? (1 - s) * H * 2 : (W / 2) * norm * s ** a * (1 - s) ** b;
    // how each layer burns along the height: the blue cup at the foot, the core low down, yellow above it, the tip cooling
    const env = smooth(0.02, 0.16, s) * (1 - 0.8 * smooth(0.55, 1.0, s));
    const body = smooth(0.07, 0.2, s) * (1 - smooth(0.42, 1.02, s));
    const core = smooth(0.11, 0.26, s) * (1 - smooth(0.3, 0.74, s));
    const cup = base ? Math.exp(-(((s - 0.07) / 0.075) ** 2)) : 0;
    for (let x = 0; x < c.width; x++) {
      const dx = Math.abs(x + 0.5 - cx), r = dx / Math.max(0.5, hw);
      const inside = sig(hw - dx), inner = sig(hw * 0.7 - dx), mid = Math.exp(-((dx / (hw * 0.42 + 0.6)) ** 2));
      const blue = cup * inside * smooth(0.25, 0.9, r);
      // the light it gives, per channel: orange mantle, yellow body, yellow-white core, blue cup
      const Ee = 0.75 * env * inside, Eb = 1.5 * body * inner, Ec = 2.3 * core * mid, Eu = 0.65 * blue;
      const R = Ee * 1.0 + Eb * 1.0 + Ec * 1.0 + Eu * 0.28;
      const G = Ee * 0.42 + Eb * 0.76 + Ec * 0.95 + Eu * 0.42;
      const B = Ee * 0.1 + Eb * 0.34 + Ec * 0.8 + Eu * 1.0;
      const rr = 1 - Math.exp(-R * 1.7), gg = 1 - Math.exp(-G * 1.7), bb = 1 - Math.exp(-B * 1.7);
      const al = Math.min(1, Math.max(rr, gg, bb)), i = (y * c.width + x) * 4;
      if (al < 0.003) continue;
      d[i] = Math.min(255, (rr / al) * 255); d[i + 1] = Math.min(255, (gg / al) * 255); d[i + 2] = Math.min(255, (bb / al) * 255); d[i + 3] = al * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { c, by, hpx: H };
}

/** The warm glow of a flame in the air, drawn scaled. */
export function bloomSprite() {
  const [c, g] = offscreen(128, 128), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 16; i++) { const u = i / 16, al = Math.exp(-u * 5.2) * (1 - u) ** 2; r.addColorStop(u, `rgba(255,${(176 - 50 * u) | 0},${(104 - 40 * u) | 0},${al.toFixed(3)})`); }
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c;
}

/** The flicker shared by a candle's flames and their light: slow and small (a still room, not a draught), with now and then
 * a gutter (a pop of the wood) that dips the flame once and lets it recover. */
export function createFlicker(reduce: boolean) {
  let gutAt = -10, nextGut = 5 + Math.random() * 6, gutS = 1;
  return {
    /** external pops (the crackle's sound) set their own gutters */
    pop(t: number, s: number) { gutAt = t; gutS = s; },
    at(t: number, auto = true): [number, number] {
      if (reduce) return [1, 0];
      if (auto && t > nextGut) { gutAt = t; gutS = 0.7; nextGut = t + 6 + Math.random() * 10; }
      const a = t - gutAt, gut = a >= 0 && a < 0.7 ? gutS * Math.sin((Math.PI * a) / 0.7) ** 2 : 0;
      return [1 + 0.045 * noise1(t * 1.1, 5) + 0.022 * noise1(t * 2.9, 6) + 0.006 * noise1(t * 6.5, 7) - 0.1 * gut, gut];
    },
  };
}

/** k: the breath (0 to 1); f, gut: the flicker; grow: how far the wick has caught (0 to 1); sway: a breath out; size: how big the flame has grown (1: as photographed) */
export interface FlameState { k: number; f: number; gut: number; grow: number; sway: number; size?: number }

/**
 * The flames of one photographed candle: a small canvas over each wick (class cls, with data-base: the flame's base in the
 * canvas's CSS px) and, optionally, a soft warm halo element (class haloCls) whose opacity follows the flame.
 * host is the box the photo fills (position: relative or absolute); layout() is given the photo's size in CSS px.
 */
export class PhotoFlames {
  canvases: HTMLCanvasElement[] = [];
  private fl: { w: FlameWick; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; halo?: HTMLElement; href: number; bx: number; by: number; seed: number; spr?: Sprite }[] = [];
  private bloom: HTMLCanvasElement | null = null;
  private host: HTMLElement; private wicks: FlameWick[]; private o: { reduce: boolean; dpr: number; cls: string; haloCls?: string; haloSize?: number };
  constructor(host: HTMLElement, wicks: FlameWick[], o: { reduce: boolean; dpr: number; cls: string; haloCls?: string; haloSize?: number }) { this.host = host; this.wicks = wicks; this.o = o; }
  /** paint the sprites for this size ahead of time */
  layout(pw: number, ph: number) {
    this.destroy();
    const d = this.o.dpr;
    this.bloom ??= bloomSprite();
    this.wicks.forEach((w, i) => {
      const href = w.h * pw, cw = href * 2.6, ch = href * 3, bx = cw / 2, by = ch * 0.76;
      const cv = document.createElement('canvas'); cv.className = this.o.cls; cv.width = Math.round(cw * d); cv.height = Math.round(ch * d);
      Object.assign(cv.style, { position: 'absolute', left: `${(w.x * pw - bx).toFixed(1)}px`, top: `${(w.y * ph - by).toFixed(1)}px`, width: `${cw.toFixed(1)}px`, height: `${ch.toFixed(1)}px`, pointerEvents: 'none' });
      cv.dataset.base = `${bx.toFixed(1)},${by.toFixed(1)}`; cv.setAttribute('aria-hidden', 'true');
      let halo: HTMLElement | undefined;
      if (this.o.haloCls) {
        halo = document.createElement('span'); halo.className = this.o.haloCls; halo.setAttribute('aria-hidden', 'true');
        const s = href * (this.o.haloSize ?? 7);
        Object.assign(halo.style, { left: `${(w.x * pw).toFixed(1)}px`, top: `${(w.y * ph - href * 0.45).toFixed(1)}px`, width: `${s.toFixed(1)}px`, height: `${s.toFixed(1)}px` });
        this.host.append(halo);
      }
      this.host.append(cv); this.canvases.push(cv);
      // painted at the tallest it gets (the breath and the flicker), so it is only ever scaled down; a slim teardrop, a
      // little fuller for the broader flame of a wider wick
      const spr = flameSprite(Math.ceil(href * TALL * 1.12 * d), clamp(0.34 * w.w / w.h, 0.32, 0.42), w.tip ?? 0.3, !w.rim);
      this.fl.push({ w, cv, g: cv.getContext('2d')!, halo, href, bx, by, seed: i * 7 + 3, spr });
    });
  }
  destroy() { this.fl.forEach(f => { f.cv.remove(); f.halo?.remove(); }); this.fl = []; this.canvases = []; }
  /** draw every flame; grow may differ per flame (the wicks catch one after the other) */
  draw(t: number, s: Omit<FlameState, 'grow'> & { grow: number | number[] }) {
    this.fl.forEach((fl, i) => this.one(fl, t + i * 3.1, { ...s, grow: Array.isArray(s.grow) ? s.grow[i] ?? 1 : s.grow }));
  }
  private one(fl: PhotoFlames["fl"][number], t: number, { k, f, gut, grow, sway, size = 1 }: FlameState) {
    const { g, cv, href, bx, by, seed, spr } = fl, d = this.o.dpr, reduce = this.o.reduce, bloom = this.bloom;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (fl.halo) fl.halo.style.opacity = '0';
    if (grow <= 0.001 || !spr || !bloom) return;
    // slow noise only: the flame breathes and leans, it does not shiver
    const n2 = reduce ? 0 : noise1(t * 2.3, seed), n3 = reduce ? 0 : noise1(t * 0.7, seed + 1), n4 = reduce ? 0 : noise1(t * 1.9, seed + 2);
    const catching = grow < 1, ease = 1 - (1 - grow) ** 3;
    const h = href * TALL * size * (0.86 + 0.2 * k) * f * (catching ? 0.18 + 0.82 * ease : 1);
    // the flame keeps its width better than its height (the wick sets the width), and swells a little when it gutters
    const sy = h / spr.hpx, sx = ((href * TALL) / spr.hpx) * Math.pow(h / (href * TALL), 0.5) * (1 + 0.025 * n2 + 0.12 * gut) * (catching ? 0.6 + 0.4 * ease : 1);
    const lean = h * (0.04 * n3 + 0.015 * n4) + sway * h * 0.07, L = clamp((0.6 + 0.4 * k) * f, 0, 1.1) * grow;
    // behind a glass rim the flame's foot sits a little below the rim, inside the glass, and only what rises above it shows
    const base = fl.w.rim ? by + h * 0.14 : by, mid = base - h * 0.42;
    // the warm air around it: a wide soft bloom and a brighter one close in
    g.setTransform(d, 0, 0, d, 0, 0); g.globalCompositeOperation = 'lighter';
    const B = href * 1.15; g.globalAlpha = 0.2 * L; g.drawImage(bloom, bx + lean * 0.3 - B, mid - B, B * 2, B * 2);
    const b2 = h * 0.42; g.globalAlpha = 0.22 * L; g.drawImage(bloom, bx + lean * 0.4 - b2, mid - b2 * 1.25, b2 * 2, b2 * 2.5);
    g.globalAlpha = catching ? Math.min(1, 0.4 + grow) : 1; g.globalCompositeOperation = 'source-over';
    // the flame in strips, each shifted by the lean (more towards the tip) and a slow ripple running up it; behind a rim,
    // nothing below the rim
    const fw = spr.c.width * sx, Nst = 20, sd = sy * d, top = Math.round((base - spr.by * sy) * d), Hd = spr.c.height * sd;
    const ripple = reduce ? 0 : h * (0.006 + 0.012 * sway + 0.03 * gut), cut = fl.w.rim ? Math.round(by * d) : Infinity;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = 0; j < Nst; j++) {
      const y0 = top + Math.round((j * Hd) / Nst); let y1 = top + Math.round(((j + 1) * Hd) / Nst); if (y0 >= cut) break; y1 = Math.min(y1, cut); if (y1 <= y0) continue;
      const s0 = (y0 - top) / sd, s1 = Math.min(spr.c.height, (y1 - top) / sd), u = Math.max(0, (spr.by - (s0 + s1) / 2) / spr.hpx);
      const off = lean * Math.pow(u, 1.7) + ripple * Math.pow(u, 1.3) * Math.sin(u * 6 - t * 5.5);
      g.drawImage(spr.c, 0, s0, spr.c.width, s1 - s0, (bx - fw / 2 + off) * d, y0, fw * d, y1 - y0);
    }
    g.globalAlpha = 1;
    if (catching) { // the wood catching: a bright ember at the wick
      g.setTransform(d, 0, 0, d, 0, 0); g.globalCompositeOperation = 'lighter'; const e = (1 - grow) * 0.8;
      g.globalAlpha = e; g.drawImage(bloom, bx - href * 0.3, by - href * 0.25, href * 0.6, href * 0.4); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (fl.halo) fl.halo.style.opacity = clamp(L, 0, 1).toFixed(2);
  }
}
