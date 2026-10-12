// A procedurally generated mountain landscape, drawn on a canvas. It looks natural because it uses the same ideas a
// landscape painter or photographer relies on: ridgelines from fractal noise (not hand-drawn curves), five layers that fade
// into haze with distance, rim light from the sun or moon along each ridge, pine forests on the near ridges, and fine grain.

export interface ScenePalette { sky: [string, string, string]; land: [string, string, string]; orb: string; dark: boolean }

const rgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const rgba = (h: string, a: number) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const toHex = (css: string) => { const m = css.match(/\d+/g)!.map(Number); return '#' + m.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); };

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Midpoint displacement: a jagged, natural-looking profile with values in about -1 to 1. */
function profile(power: number, rough: number, rand: () => number): number[] {
  const n = 2 ** power, h = new Array(n + 1).fill(0);
  h[0] = rand() * 2 - 1; h[n] = rand() * 2 - 1;
  let step = n, scale = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) h[i] = (h[i - half] + h[i + half]) / 2 + (rand() * 2 - 1) * scale;
    step = half; scale *= rough;
  }
  const max = Math.max(...h.map(Math.abs)) || 1;
  return h.map(v => v / max);
}

const LAYERS = [
  { base: 0.34, amp: 0.2, rough: 0.58, haze: 0.8 },
  { base: 0.5, amp: 0.19, rough: 0.58, haze: 0.58 },
  { base: 0.65, amp: 0.17, rough: 0.6, haze: 0.38 },
  { base: 0.8, amp: 0.15, rough: 0.62, haze: 0.18 },
  { base: 0.95, amp: 0.1, rough: 0.64, haze: 0 },
];

let grain: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas'); grain.width = grain.height = 160;
  const g = grain.getContext('2d')!, img = g.createImageData(160, 160), r = rng(99);
  // half the specks are light, half dark, so grain adds texture without shifting the overall colour
  for (let i = 0; i < img.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 2 + r() * 12; }
  g.putImageData(img, 0, 0);
  return grain;
}

export function drawLandscape(canvas: HTMLCanvasElement, pal: ScenePalette, seed = 11) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.round(canvas.clientWidth * dpr)), h = Math.max(160, Math.round(canvas.clientHeight * dpr));
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const haze = toHex(mix(pal.sky[1], pal.sky[2], 0.5));
  const layerColor = [
    mix(pal.land[0], haze, 0.4), mix(pal.land[0], pal.land[1], 0.55), pal.land[1], mix(pal.land[1], pal.land[2], 0.6), pal.land[2],
  ].map(c => (c.startsWith('#') ? c : toHex(c)));
  const rand = rng(seed);

  LAYERS.forEach((L, i) => {
    let prof = profile(9, L.rough, rand);
    for (let pass = 0; pass < [5, 4, 2, 1, 0][i]; pass++) prof = prof.map((v, k) => (prof[Math.max(0, k - 2)] + prof[Math.max(0, k - 1)] + v + prof[Math.min(prof.length - 1, k + 1)] + prof[Math.min(prof.length - 1, k + 2)]) / 5); // distant ranges are softer
    const n = prof.length - 1;
    const phase = rand() * 6.28, phase2 = rand() * 6.28, freq = 1.1 + rand() * 1.4;
    const yAt = (x: number) => {
      const t = x / w, k = Math.min(n, Math.max(0, Math.round(t * n)));
      const hill = 0.55 * Math.sin(t * freq * 6.28 + phase) + 0.45 * Math.sin(t * freq * 2.7 * 6.28 + phase2);
      return h * (L.base - L.amp * (0.55 * prof[k] + 0.6 * hill * 0.5));
    };
    // body: lit at the ridge, fading into haze at the foot (atmospheric perspective)
    const top = h * (L.base - L.amp * 0.9);
    const grad = ctx.createLinearGradient(0, top, 0, h * (L.base + 0.22));
    grad.addColorStop(0, mix(layerColor[i], pal.orb, pal.dark ? 0.1 : 0.14));
    grad.addColorStop(1, mix(layerColor[i], haze, L.haze * (pal.dark ? 0.5 : 0.85) + 0.05));
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 2) ctx.lineTo(x, yAt(x));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    // rim light along the ridge
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)));
    ctx.strokeStyle = rgba(pal.orb, pal.dark ? 0.22 : 0.3 - i * 0.04); ctx.lineWidth = 1.4 * dpr; ctx.stroke();
    // pine forest on the two near ridges
    if (i >= 3) {
      const tree = mix(layerColor[i], '#000000', i === 4 ? 0.34 : 0.22);
      ctx.fillStyle = tree;
      for (let x = rand() * 8; x < w; x += (i === 4 ? 7 : 5) * dpr * (0.6 + rand() * 0.9)) {
        const th = (i === 4 ? 30 : 18) * dpr * (0.55 + rand() * 0.8), tw = th * 0.34, y0 = yAt(x) + th * 0.18;
        for (let tier = 0; tier < 3; tier++) {
          const ty = y0 - th * (0.28 * tier), tt = th * (1 - tier * 0.26), ww = tw * (1 - tier * 0.2) + 2 * dpr;
          ctx.beginPath(); ctx.moveTo(x, ty - tt * 0.5); ctx.lineTo(x - ww, ty + tt * 0.1); ctx.lineTo(x + ww, ty + tt * 0.1); ctx.closePath(); ctx.fill();
        }
      }
    }
    // a band of haze settles between this ridge and the next
    if (i < LAYERS.length - 1) {
      const y0 = h * (L.base - 0.02), y1 = h * (L.base + 0.16);
      const hg = ctx.createLinearGradient(0, y0, 0, y1);
      hg.addColorStop(0, rgba(haze, 0)); hg.addColorStop(1, rgba(haze, (pal.dark ? 0.2 : 0.34) * (1 - i * 0.18)));
      ctx.fillStyle = hg; ctx.fillRect(0, y0, w, y1 - y0);
    }
  });

  // fine film grain keeps it from looking like flat vector art
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = pal.dark ? 0.9 : 1; // only where land has been drawn
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat')!; ctx.fillRect(0, 0, w, h); ctx.restore();
}
