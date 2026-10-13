// The opening's candle moons: five of Claire's past pours, seen from above, as moons on one ring across the sky.
//
// Seen from above, each candle is a small moon: a round face of wax with its toppings along the rim. One candle stands for
// each time of day (moons.ts, HERO). They sit on a ring in 3D, one every 72 degrees, seen from in front and a little below,
// so it reads as an arch across the sky like the moon's path: the moment being shown faces us at the top of the arch, the
// full moon, the largest, glowing; the two either side are gibbous, lower and further; the two at the ends are crescents,
// smallest and hazier, low in the sky but always clear of the hills. Choosing another time of day turns the ring (the
// shorter way round), so the new moment's candle rises to the top and fills; a moon carried past the end of the arch sinks
// out of sight there and rises again at the other end, as the moon sets and rises.
//
// Each face is shaded here, per pixel, on a small canvas: a slightly domed disc lit from where the sun (or the moon) of the
// moment really is in the sky, a soft lit rim on that side, ambient occlusion where the wax meets the edge, and a phase:
// a soft, realistic terminator as if a sphere of that face were lit from the front of the ring, so moons before the full
// one wax and moons after it wane. A soft shadow falls on the sky haze away from the light. The faces are Claire's own
// photographs (public/img/studio/moons: clean round crops made by tools/photo/moon_faces.py).
//
// The shading is only recomputed when something changes (the ring turning, the light moving, the hour's colours), so
// nothing runs while the opening is still; reduced motion turns the ring without the glide and stills the drift.
import { MOMENTS } from '../config';
import { getSky } from './sky';

export interface MoonArc {
  show(key: string): void;
  /** the hour's colours: the sky (top, middle, horizon), the sun or moon colour, how much it is night */
  look(sky: [string, string, string], orb: [number, number, number], night: number): void;
  /** the sun or moon moved: relight the faces */
  light(): void;
  destroy(): void;
}

type RGB = [number, number, number];
const STEP = (Math.PI * 2) / 5;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const parse = (c: string): RGB => {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/\d+(\.\d+)?/g); return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [200, 200, 220];
};
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneMQ = () => window.matchMedia('(max-width: 820px)');
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** the phase's name for a place on the ring: in front full, then gibbous, then crescent; before the front waxing, after it waning */
export function phaseName(off: number): string {
  const a = Math.abs(off);
  if (a < 0.5) return 'full moon';
  return `${off < 0 ? 'waxing' : 'waning'} ${a < 1.5 ? 'gibbous' : 'crescent'}`;
}

interface Face {
  key: string; i: number; el: HTMLElement; cv: HTMLCanvasElement; cap: HTMLElement; img: HTMLImageElement;
  /** the photograph's pixels at the canvas's size (null until loaded) */
  px: Uint8ClampedArray | null; out: ImageData | null;
  /** where it is now: angle on the ring, centre on screen, scale */
  th: number; x: number; y: number; s: number;
  /** what it was last shaded with, to skip work when nothing changed */
  sig: string;
  /** its average colour as last shaded */
  avg?: RGB;
}

export function mountMoonArc(hero: HTMLElement, stack: HTMLElement, imgFor: (key: string) => HTMLImageElement | null): MoonArc {
  const scene = hero.querySelector<HTMLElement>('#scene')!;
  const arc = document.createElement('div');
  arc.className = 'moonarc'; arc.setAttribute('aria-hidden', 'true');
  const keys = MOMENTS.map(m => m.key);
  const faces: Face[] = keys.map((key, i) => {
    const el = document.createElement('span'); el.className = 'cm'; el.dataset.k = key;
    el.innerHTML = '<span class="cm-sh"></span><span class="cm-in"><span class="cm-glow"></span><canvas></canvas></span><span class="cm-cap"></span>';
    arc.append(el);
    return { key, i, el, cv: el.querySelector('canvas')!, cap: el.querySelector('.cm-cap')!, img: null as unknown as HTMLImageElement, px: null, out: null, th: 0, x: 0, y: 0, s: 1, sig: '' };
  });
  // the moons are in the sky: behind the hills, in front of the sky and its clouds
  const firstLand = scene.querySelector('canvas.land');
  if (firstLand) scene.insertBefore(arc, firstLand); else scene.append(arc);

  let alive = true, key = '', phi = 0, raf = 0, tween: { from: number; to: number; t0: number; ms: number } | null = null;
  let D = 140, N = 280, dpr = 1, phone = false;
  let cx = 0, top = 0, RX = 200, RY = 90, arcW = 0;
  let sky: RGB[] = [[120, 150, 200], [180, 200, 230], [230, 220, 210]], orb: RGB = [255, 240, 200], night = 0;

  // ---------- the shared geometry of a face at N x N: its radius, the sphere's normal (phase) and the dome's (light) ----------
  let geo: { r: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; dx: Float32Array; dy: Float32Array; dz: Float32Array; ao: Float32Array; rim: Float32Array } | null = null;
  function buildGeo() {
    const n = N * N, r = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n), dx = new Float32Array(n), dy = new Float32Array(n), dz = new Float32Array(n), ao = new Float32Array(n), rim = new Float32Array(n);
    const R = N / 2, DOME = 0.42; // a gentle dome: the wax's surface rises a little to the middle
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = (i + 0.5 - R) / R, y = (j + 0.5 - R) / R, rr = Math.hypot(x, y);
      r[k] = rr;
      const z = Math.sqrt(Math.max(0, 1 - Math.min(1, rr * rr)));
      nx[k] = x; ny[k] = y; nz[k] = z;
      const l = Math.hypot(x * DOME, y * DOME, 1);
      dx[k] = (x * DOME) / l; dy[k] = (y * DOME) / l; dz[k] = 1 / l;
      // ambient occlusion at the edge, where the wax met the tin; how much of the lit rim a pixel carries
      ao[k] = 1 - 0.34 * Math.pow(smooth(0.78, 1, rr), 1.3);
      rim[k] = (smooth(0.9, 0.995, rr) * 0.42) / Math.max(rr, 1e-3);
    }
    geo = { r, nx, ny, nz, dx, dy, dz, ao, rim };
  }

  /** the photograph, drawn once at the canvas's size */
  function grab(f: Face) {
    const img = imgFor(f.key);
    if (!img) return false;
    f.img = img;
    if (!(img.complete && img.naturalWidth > 0)) {
      if (!img.dataset.wait) { img.dataset.wait = '1'; img.addEventListener('load', () => { if (alive) { f.px = null; f.sig = ''; kick(); } }, { once: true }); }
      return false;
    }
    // the photograph is decoded off the main thread first, so drawing it here never stalls a frame
    if (img.dataset.dec !== '1') {
      if (!img.dataset.dec) { img.dataset.dec = '0'; img.decode().catch(() => {}).then(() => { img.dataset.dec = '1'; if (alive) { f.px = null; f.sig = ''; kick(); } }); }
      return false;
    }
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, N, N);
    f.px = x.getImageData(0, 0, N, N).data;
    f.out = new ImageData(N, N);
    return true;
  }

  // ---------- layout: the ring's place on screen ----------
  const rel = (el: Element | null, to: DOMRect) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left - to.left, t: r.top - to.top, r: r.right - to.left, b: r.bottom - to.top }; };
  /** The highest point of the far hills between x0 and x1 (in the ring's own box): the moons all stay above it, fully in
   *  the sky. Read off the landscape canvas itself (every moment's hills have the same shape), by its layout box, not its
   *  on-screen one (the opening and the parallax move it while this measures). */
  function ridge(x0: number, x1: number): number {
    const c = [...scene.querySelectorAll<HTMLCanvasElement>('canvas.land')].find(x => x.width > 2 && x.offsetHeight > 0);
    if (!c) return Infinity;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return Infinity;
    let best = Infinity;
    for (let i = 0; i <= 16; i++) {
      const px = x0 + ((x1 - x0) * i) / 16, cx = Math.round(((px - c.offsetLeft) / c.offsetWidth) * c.width);
      if (cx < 0 || cx >= c.width) continue;
      const col = x.getImageData(cx, 0, 1, c.height).data;
      for (let j = 0; j < c.height; j++) if (col[j * 4 + 3] > 200) { best = Math.min(best, c.offsetTop + (j / c.height) * c.offsetHeight); break; }
    }
    return best;
  }
  function layout() {
    phone = phoneMQ().matches;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = arc.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    arcW = arc.clientWidth; // (kept for each frame's captions and glint, so a frame never forces a layout to read it)
    let W: number, H: number, left: number;
    if (phone) {
      // the band above the words: the whole ring inside it, inside the screen
      const band = rel(stack, box);
      if (!band) return false;
      W = box.width - 24; left = 12; H = band.b - band.t; top = band.t + 6;
      D = clamp(Math.min(H * 0.42, W * 0.25), 76, 120);
      RX = W / 2 - Math.max(D * 0.27, 42); // room for the end moons' captions
      RY = H - 24 - D * 0.77; // the ends low in the band, with their captions
    } else {
      // beside the words, in the sky above the offers: the front moon near the top, the two round the back no lower than
      // the far ridges (where they may set a little behind them), all clear of the words and the offers
      const copy = rel(hero.querySelector('.day-copy'), box), offers = rel(hero.querySelector('#dProducts'), box);
      const vis = Math.min(box.height, window.innerHeight - Math.max(0, box.top));
      // (a long headline can run past its column: the moons keep clear of the words as they are set)
      const words = [...hero.querySelectorAll('.day-copy > *')].map(e => rel(e, box)!.r);
      left = Math.max(copy ? copy.r : box.width * 0.5, ...words) + 40;
      W = box.width - 40 - left;
      // the birds keep to a high band of the sky (studio.css): the ring starts below it
      const birds = [...scene.querySelectorAll<HTMLElement>('.bird')].map(b => b.offsetTop + b.offsetHeight);
      top = Math.max(28, vis * 0.06, (birds.length ? Math.max(...birds) : 0) + 16);
      // the lowest any moon's foot may reach: the two round the back stand on the far ridges, half set behind them
      const low = Math.min(box.height * 0.54, (offers ? offers.t : vis * 0.7) - 12, ridge(left, left + W) - 40); // (with the captions under the ends)
      H = low - top;
      D = clamp(Math.min(vis * 0.22, W * 0.21, H * 0.62), 84, 190);
      RX = Math.min(W / 2 - Math.max(D * 0.3, 56), D * 2.4);
      RY = Math.max(20, Math.min(H - D * 0.5 - D * 0.27, D * 1.15)); // how far the ends of the arch fall
    }
    cx = left + W / 2;
    const n = Math.round(D * dpr);
    if (n !== N || !geo) { N = n; buildGeo(); faces.forEach(f => { f.px = null; f.sig = ''; f.cv.width = f.cv.height = N; }); }
    faces.forEach(f => { f.cv.style.width = f.cv.style.height = `${D}px`; });
    arc.style.setProperty('--d', `${D}px`);
    arc.dataset.mode = phone ? 'phone' : 'desktop';
    // a narrow sky (tablets): only the full moon keeps its caption, so no name is crowded by the moons below it
    arc.classList.toggle('tight', !phone && RX < D * 1.95);
    return true;
  }

  // ---------- each frame: where every moon is on the ring, then its shading if anything about it changed ----------
  function place() {
    const ci = Math.round(((phi % 5) + 5) % 5);
    faces.forEach(f => {
      let off = f.i - phi; off = ((off % 5) + 7.5) % 5 - 2.5; // -2.5..2.5: its place on the ring from the front
      const th = off * STEP, c = Math.cos(th), depth = (1 + c) / 2;
      f.th = th;
      f.s = 0.47 + 0.53 * Math.pow(depth, 1.25);
      // along the arch: evenly out to the ends, falling away more steeply the further from the top
      const u = off * 0.7;
      f.x = cx + (RX * Math.sin(u)) / Math.sin(1.4);
      f.y = top + D * 0.5 + (RY * (1 - Math.cos(u))) / (1 - Math.cos(1.4));
      const el = f.el;
      // past the ends of the arch (only while the ring turns) a moon sinks out of sight, and rises at the other end
      const a = Math.abs(off), gone = smooth(2.06, 2.45, a);
      f.y += gone * D * 0.22;
      el.style.opacity = (1 - gone).toFixed(3);
      el.style.transform = `translate3d(${(f.x - D / 2).toFixed(1)}px, ${(f.y - D / 2).toFixed(1)}px, 0) scale(${f.s.toFixed(4)})`;
      el.style.zIndex = String(Math.round(depth * 100));
      el.style.setProperty('--dz', depth.toFixed(3));
      el.style.setProperty('--inv', (1 / f.s).toFixed(4)); // the caption keeps one size whatever the moon's
      el.style.setProperty('--glow', smooth(0.55, 1, c).toFixed(3));
      // captions: full under the front three, softer under the crescents at the ends
      el.style.setProperty('--cap', (1 - 0.35 * smooth(1.2, 2, a)).toFixed(3));
      el.classList.toggle('full', Math.abs(off) < 0.5);
      const name = MOMENTS[f.i].name;
      const ph = phaseName(Math.round(off));
      const txt = `${name}|${ph}`;
      if (f.cap.dataset.t !== txt) { f.cap.dataset.t = txt; f.cap.innerHTML = `<b>${name}</b><small>${ph}</small>`; }
      f.el.dataset.off = String(Math.round(off));
    });
    arc.dataset.full = keys[ci];
    captions();
  }

  // ---------- captions: none may crowd a neighbouring moon or another caption ----------
  // Each caption hangs under its moon. Where one would touch another moon (a crescent tucked under a gibbous moon's name, say),
  // it slides sideways a little; if no room is found it keeps only the name, and failing that it steps aside altogether. The
  // full moon's caption is placed first, then the gibbous, then the crescents.
  const widths = new Map<string, number>();
  let meas: CanvasRenderingContext2D | null = null;
  function textW(t: string, size: number, spacing: number) {
    const id = `${t}|${size}`;
    let wv = widths.get(id);
    if (wv == null) {
      meas ??= document.createElement('canvas').getContext('2d');
      const fam = getComputedStyle(faces[0].cap).fontFamily || 'monospace';
      if (meas) meas.font = `500 ${size}px ${fam}`;
      wv = (meas ? meas.measureText(t.toUpperCase()).width : t.length * size * 0.62) + t.length * size * spacing;
      widths.set(id, wv);
    }
    return wv;
  }
  function captions() {
    const box = { w: arcW };
    const tight = arc.classList.contains('tight');
    const discs = faces.map(f => ({ f, x: f.x, y: f.y, r: (D * f.s) / 2 + 3, on: Number(f.el.style.opacity || 1) > 0.3 }));
    const placed: { l: number; t: number; r: number; b: number }[] = [];
    const order = [...faces].sort((a, b) => Math.abs(a.th) - Math.abs(b.th));
    const hitDisc = (q: { l: number; t: number; r: number; b: number }, self: Face) => discs.some(d => {
      if (d.f === self || !d.on) return false;
      const nx = Math.max(q.l, Math.min(d.x, q.r)), ny = Math.max(q.t, Math.min(d.y, q.b));
      return (nx - d.x) ** 2 + (ny - d.y) ** 2 < (d.r + 6) ** 2;
    });
    const hitCap = (q: { l: number; t: number; r: number; b: number }) => placed.some(p => q.l < p.r + 8 && q.r > p.l - 8 && q.t < p.b + 4 && q.b > p.t - 4);
    for (const f of order) {
      const visible = Number(f.el.style.opacity || 1) > 0.3 && !(tight && !f.el.classList.contains('full'));
      let cx = 0, mode = '';
      if (visible) {
        const [name, ph] = (f.cap.dataset.t || '|').split('|');
        const small = !phone;
        const top = f.y + f.s * (D / 2 + (phone ? 6 : 10));
        const wFull = Math.max(textW(name, phone ? 9 : 10, 0.16), small ? textW(ph, 9, 0.14) : 0), hFull = small ? 23 : 10;
        const wName = textW(name, phone ? 9 : 10, 0.16), hName = phone ? 10 : 11;
        const inward = f.x < cx0() ? 1 : -1;
        const tryFit = (wv: number, hv: number) => {
          for (const step of [0, 1, 2, 3, 4, 5, 6]) for (const dir of step ? [inward, -inward] : [1]) {
            const dx = step * 8 * dir, l = f.x + dx - wv / 2;
            const q = { l, t: top, r: l + wv, b: top + hv };
            if (q.l < 2 || q.r > box.w - 2) continue;
            if (!hitDisc(q, f) && !hitCap(q)) { placed.push(q); return dx; }
          }
          return null;
        };
        let dx = tryFit(wFull, hFull);
        if (dx == null && small) { dx = tryFit(wName, hName); if (dx != null) mode = 'mini'; }
        if (dx == null) mode = 'off'; else cx = dx;
      }
      f.el.style.setProperty('--cx', `${(cx / f.s).toFixed(1)}px`);
      f.cap.classList.toggle('mini', mode === 'mini');
      f.cap.classList.toggle('off', mode === 'off');
    }
  }
  const cx0 = () => cx;

  /** the full candle moon's path of light on the lake (the realistic sky draws it) */
  function glint() {
    const sky = getSky(); if (!sky) return;
    const full = faces.reduce((a, b) => (Math.cos(b.th) > Math.cos(a.th) ? b : a));
    const w = arcW || 1;
    const c = full.avg ?? [250, 238, 220];
    sky.set({ glint: [full.x / w, Math.max(0.012, (D * full.s) / w * 0.32), 0.12 + 0.6 * night], glintC: c.map(v => Math.min(255, v * 1.05)) as RGB });
  }

  function orbAt(): [number, number] {
    // the realistic sky's sun (or moon, at night) is where the light really comes from; the CSS sky's orb otherwise
    const l = getSky()?.lightAt();
    if (l) return [l.x, l.y];
    const o = scene.querySelector<HTMLElement>('#sunorb'), box = arc.getBoundingClientRect();
    if (!o) return [box.width * 0.7, -100];
    const r = o.getBoundingClientRect();
    return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
  }

  // Shading is per pixel, so one frame shades only as many faces as fit in a short budget (the full moon first, then the
  // nearest); the rest follow on the next frames. A slow phone never sees one long frame, and the finished picture is the same.
  const BUDGET = 12;
  let pending = false;
  function shadeAll([ox, oy]: [number, number]) {
    pending = false;
    if (!geo) return;
    const front = faces.reduce((a, b) => (Math.cos(b.th) > Math.cos(a.th) ? b : a));
    const haze = sky[1], deep = sky[0];
    const day = 1 - night;
    // the night side of each moon, as a real moon's: it takes on the sky behind it. By day it is the haze, a little deeper
    // (so a daytime moon's dark side almost melts into the sky); by night a deep, cool dusk violet-blue, lifted just enough
    // that the earthshine shows the wax and its toppings faintly
    const NIGHT_SIDE: RGB = [58, 60, 104];
    const daySide: RGB = [0, 1, 2].map(c => (haze[c] * 0.5 + deep[c] * 0.5) * 0.88) as RGB;
    const nightSide: RGB = [0, 1, 2].map(c => deep[c] * 0.45 + NIGHT_SIDE[c] * 0.75) as RGB;
    const shadowTint: RGB = [0, 1, 2].map(c => daySide[c] * day + nightSide[c] * night) as RGB;
    const lit: RGB = [mixc(255, orb[0], 0.18 + 0.12 * night), mixc(255, orb[1], 0.18 + 0.12 * night), mixc(255, orb[2], 0.18 + 0.12 * night)];
    const t0 = performance.now();
    let shaded = 0;
    for (const f of [...faces].sort((a, b) => Math.abs(a.th) - Math.abs(b.th))) {
      if (shaded && performance.now() - t0 > BUDGET) { pending = true; break; }
      if (!f.px && !grab(f)) continue;
      // the light of the sun or moon, from where it is in the sky (a little in front of the faces, so they are never black)
      let lx = ox - f.x, ly = oy - f.y; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
      const L = norm3(lx * 0.78, ly * 0.78, 0.62);
      const Hh = norm3(L[0], L[1], L[2] + 1);
      // the phase: lit from the front of the ring
      const off = f.th / STEP, alpha = Math.abs(f.th) * 0.86;
      let px = front.x - f.x, py = front.y - f.y; const pl = Math.hypot(px, py);
      if (pl < 1) { px = -Math.sign(off) || 1; py = 0; } else { px /= pl; py /= pl; }
      const P = [px * Math.sin(alpha), py * Math.sin(alpha), Math.cos(alpha)];
      const hz = (1 - f.s) * (0.4 * day + 0.2 * night); // the haze of distance
      const sig = [Math.round(L[0] * 60), Math.round(L[1] * 60), Math.round(P[0] * 200), Math.round(P[1] * 200), Math.round(P[2] * 200), Math.round(hz * 100), haze.join(), Math.round(night * 50), N].join(',');
      if (sig === f.sig) continue;
      f.sig = sig;
      shade(f, L, Hh, P, hz, haze, shadowTint, lit); shaded++;
      f.cv.getContext('2d')!.putImageData(f.out!, 0, 0);
      // its shadow on the haze falls away from the light
      f.el.style.setProperty('--shx', (-lx * 0.09).toFixed(3));
      f.el.style.setProperty('--shy', (-ly * 0.09 + 0.05).toFixed(3));
    }
    stack.dataset.moons = String(faces.filter(f => f.px).length);
    if (faces.every(f => f.px) && !tween && !pending) stack.dataset.shown = key;
  }

  function shade(f: Face, L: number[], H: number[], P: number[], hz: number, haze: RGB, dark: RGB, lit: RGB) {
    const g = geo!, src = f.px!, out = f.out!.data, R = N / 2;
    const px3 = [0, 0, 0], KNEE = 210, TOP = 243, sum = [0, 0, 0, 0];
    const night01 = night, spec = 0.2 * (1 - 0.6 * night01), sharp = 26;
    const rimC = [lit[0], lit[1], lit[2]];
    const lxy = Math.hypot(L[0], L[1]) || 1, rlx = L[0] / lxy, rly = L[1] / lxy;
    for (let k = 0, n = N * N; k < n; k++) {
      const r = g.r[k], o = k * 4;
      const a = clamp((1 - r) * R + 0.5, 0, 1);
      if (a <= 0) { out[o + 3] = 0; continue; }
      // the phase: a soft terminator on the sphere of this face
      const pd = g.nx[k] * P[0] + g.ny[k] * P[1] + g.nz[k] * P[2];
      const ph = smooth(-0.16, 0.17, pd);
      // the dome in the light of the sun or moon: diffuse, a broad satin sheen, a lit rim on the light's side
      const nd = g.dx[k] * L[0] + g.dy[k] * L[1] + g.dz[k] * L[2];
      const diff = 0.74 + 0.36 * Math.max(0, nd);
      const hd = Math.max(0, g.dx[k] * H[0] + g.dy[k] * H[1] + g.dz[k] * H[2]);
      const sp = hd > 0.8 ? spec * Math.pow(hd, sharp) : 0;
      const ao = g.ao[k];
      const rim = g.rim[k] * Math.max(0, g.nx[k] * rlx + g.ny[k] * rly);
      // earthshine: the photograph's brightness only (no colour), so the toppings show faintly in the shadow, never brown
      const lum = (src[o] * 0.3 + src[o + 1] * 0.59 + src[o + 2] * 0.11) / 255;
      const shine = (0.58 + 0.5 * lum) * (0.88 + 0.12 * ao);
      for (let c = 0; c < 3; c++) {
        const base = src[o + c];
        const l = base * diff * ao * (lit[c] / 255) + 255 * sp + rimC[c] * rim * ph;
        const d = dark[c] * shine;
        let v = d + (l - d) * ph;
        v = v + (haze[c] - v) * hz;
        px3[c] = v;
      }
      // the brightest wax eases toward a ceiling just under white, all three channels in proportion, so a sunlit candle top
      // keeps its texture and warmth instead of clipping to a flat white patch
      const m = Math.max(px3[0], px3[1], px3[2]);
      const sc = m > KNEE ? (KNEE + (TOP - KNEE) * (1 - Math.exp(-(m - KNEE) / (TOP - KNEE)))) / m : 1;
      out[o] = px3[0] * sc; out[o + 1] = px3[1] * sc; out[o + 2] = px3[2] * sc;
      if (r < 0.5) { sum[0] += out[o]; sum[1] += out[o + 1]; sum[2] += out[o + 2]; sum[3]++; }
      out[o + 3] = 255 * a;
    }
    // the face's average colour, for its glitter path on the lake
    if (sum[3]) f.avg = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
  }

  // ---------- the loop: only while the ring turns, the light moves or a photograph arrives ----------
  function frame(now: number) {
    raf = 0;
    if (!alive) return;
    if (!arc.isConnected) { destroy(); return; }
    if (tween) {
      const k = clamp((now - tween.t0) / tween.ms, 0, 1);
      phi = tween.from + (tween.to - tween.from) * ease(k);
      if (k >= 1) { phi = ((tween.to % 5) + 5) % 5; tween = null; }
    }
    // where the light is, read before this frame moves the moons (their styles would make the read lay the page out again)
    const light: [number, number] = geo ? orbAt() : [0, 0];
    place();
    shadeAll(light);
    glint();
    if (tween || pending || faces.some(f => !f.px && f.img && !f.img.complete)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && alive) raf = requestAnimationFrame(frame); }

  let rt = 0, lastLight = 0, lightT = 0;
  const onSkyLight = () => {
    const now = performance.now();
    if (now - lastLight > 120) { lastLight = now; kick(); }
    else if (!lightT) lightT = window.setTimeout(() => { lightT = 0; lastLight = performance.now(); kick(); }, 130);
  };
  scene.addEventListener('skylight', onSkyLight);
  const onResize = () => { window.clearTimeout(rt); rt = window.setTimeout(() => { if (layout()) { faces.forEach(f => { f.sig = ''; }); kick(); } }, 200); };
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(onResize);
  const prods = hero.querySelector('#dProducts'); if (prods) ro.observe(prods);
  ro.observe(hero);
  function destroy() {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf); window.clearTimeout(rt); window.clearTimeout(lightT); scene.removeEventListener('skylight', onSkyLight); getSky()?.set({ discs: 1, glint: [0.5, 0.04, 0] });
    window.removeEventListener('resize', onResize); ro.disconnect(); arc.remove();
  }

  return {
    show(k: string) {
      if (!alive) return;
      const i = keys.indexOf(k as typeof keys[number]);
      if (i < 0) return;
      const first = !key;
      key = k;
      if (first || !geo) layout();
      // the realistic sky draws its own sun and moon: only their glow stays, so no plain disc competes with the candle moons
      getSky()?.set({ discs: 0 });
      delete stack.dataset.shown;
      if (first || reduce()) { phi = i; tween = null; }
      else {
        // the shorter way round the ring
        let d = i - phi; d = ((d % 5) + 7.5) % 5 - 2.5;
        tween = { from: phi, to: phi + d, t0: performance.now(), ms: 1150 };
      }
      faces.forEach(f => imgFor(f.key)); // make sure every face is on its way
      kick();
    },
    look(s, o, n) {
      const next = s.map(parse) as RGB[];
      if (next.join() === sky.join() && o.join() === orb.join() && Math.abs(n - night) < 0.01) return;
      sky = next; orb = o; night = n; kick();
    },
    light() { kick(); },
    destroy,
  };
  function mixc(a: number, b: number, t: number) { return a + (b - a) * t; }
  function norm3(x: number, y: number, z: number) { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }
}
