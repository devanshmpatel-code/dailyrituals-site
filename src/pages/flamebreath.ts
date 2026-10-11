import { MOMENTS, type Moment } from '../config';
import { createBodhi } from './bodhi';
import '../flamebreath.css';

// The breathing pause, opened by the breathing orb on every page and by [data-breathe] buttons.
// The original pause (the sky of the hour, the tree, "Take a moment", then in, hold, out for as long as you like) with a
// candle flame at its heart in place of the old glowing circle: the flame grows as you breathe in, rests while you hold,
// and softens and sways as you breathe out, sending up a spark now and then. Its light warms the whole sky.
// The candle stands at the foot of a full Bodhi tree (src/pages/bodhi.ts), painted on a canvas and lit by the flame.
// No products and no claims: the rhythm is described only as in, hold, out.

const IN = 4000, HOLD = 2000, OUT = 6000, CYCLE = IN + HOLD + OUT, LEAD = 1200;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sineInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

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

export function openBreathe(opener: HTMLElement) {
  document.querySelectorAll('.jbreathe').forEach(n => n.remove());
  const q = new URLSearchParams(location.search + (location.hash.includes('?') ? '&' + location.hash.split('?')[1] : ''));
  const speed = q.has('breath') && q.get('breath') === 'fast' ? 10 : 1;
  const m = momentNow(q), reduce = reduceMotion();

  const el = document.createElement('div');
  el.className = 'jbreathe fb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'A moment to breathe');
  // the sky of the hour fades down into a candlelit dusk, so the flame always has a dark room to glow in
  el.style.setProperty('--s0', m.sky[0]); el.style.setProperty('--s1', m.sky[1]); el.style.setProperty('--s2', m.sky[2]);
  el.innerHTML = `<div class="fb-sky" aria-hidden="true"></div>${stars(m.dark)}<div class="fb-glow" aria-hidden="true"></div>
    <div class="jb-tree fb-tree" aria-hidden="true"><canvas class="fb-bodhi"></canvas></div>
    <div class="fb-stage" aria-hidden="true"><canvas class="fb-flame"></canvas></div>
    <p class="jb-word" id="jbWord" aria-live="polite">Take a moment</p><p class="jb-sub">Breathe in, hold, breathe out. Stay as long as you like.</p>
    <button class="btn jb-close" type="button">Done</button>`;
  document.body.append(el); requestAnimationFrame(() => el.classList.add('open'));

  const word = el.querySelector<HTMLElement>('#jbWord')!, glow = el.querySelector<HTMLElement>('.fb-glow')!;
  const cv = el.querySelector<HTMLCanvasElement>('.fb-flame')!, ctx = cv.getContext('2d')!;
  let W = 0, H = 0;
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); const ro = new ResizeObserver(size); ro.observe(cv);
  // the tree is laid out from the flame's base: the trunk rises just behind the candle
  const stage = el.querySelector<HTMLElement>('.fb-stage')!;
  const tree = createBodhi({ canvas: el.querySelector<HTMLCanvasElement>('.fb-bodhi')!, sky: m.sky, reduce,
    anchor: () => { const r = stage.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.74, h: Math.min(r.width, r.height) * 0.34 }; } });

  const teardrop = (x: number, y: number, w: number, h: number, lean: number) => {
    ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    ctx.bezierCurveTo(x - w / 2, y - h * 0.42, x - w * 0.1 + lean * 0.7, y - h * 0.86, x + lean, y - h);
    ctx.bezierCurveTo(x + w * 0.1 + lean * 0.7, y - h * 0.86, x + w / 2, y - h * 0.42, x + w / 2, y);
    ctx.bezierCurveTo(x + w / 2, y + w * 0.38, x - w / 2, y + w * 0.38, x - w / 2, y); ctx.closePath();
  };
  type Spark = { x: number; y: number; vx: number; vy: number; life: number; age: number };
  const sparks: Spark[] = [];

  /** k is how full the breath is (0 resting, 1 full), sway the push of the out-breath. */
  const draw = (t: number, k: number, sway: number, dt: number) => {
    ctx.clearRect(0, 0, W, H);
    const x = W / 2, y = H * 0.74, base = Math.min(W, H) * 0.34;
    const n1 = reduce ? 0 : noise1(t * 2.3, 1), n2 = reduce ? 0 : noise1(t * 7, 2), n3 = reduce ? 0 : noise1(t * 1.3, 3);
    const h = base * (0.72 + 0.48 * k) * (1 + 0.08 * n1 + 0.04 * n2), w = h * 0.36 * (1 - 0.07 * n2);
    const lean = w * (0.3 * n3 + 0.1 * n2) + sway * w * 0.32;
    // the wick and the soft pool of melted wax light beneath it
    const pool = ctx.createRadialGradient(x, y + 6, 0, x, y + 6, Math.min(h * 0.9, W * 0.48));
    pool.addColorStop(0, `rgba(255,214,150,${0.32 + 0.2 * k})`); pool.addColorStop(0.45, 'rgba(255,180,110,0.08)'); pool.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(x, y + 8, Math.min(h * 0.9, W * 0.48), h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,18,0.95)'; ctx.lineWidth = Math.max(2, w * 0.07); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.1); ctx.quadraticCurveTo(x + lean * 0.05, y, x + lean * 0.08, y - h * 0.06); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,50,0.9)'; ctx.beginPath(); ctx.arc(x + lean * 0.08, y - h * 0.06, Math.max(1.2, w * 0.04), 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    // halo: the light of the flame in the air around it
    // (kept inside the canvas: it fades to nothing before any edge, so no box shows; the room light is the .fb-glow behind)
    const hcx = x + lean * 0.4, hcy = y - h * 0.45, hr = Math.min(h * (1.6 + 0.4 * k), hcx, W - hcx, hcy, H - hcy) * 0.98;
    const hg = ctx.createRadialGradient(hcx, hcy, 0, hcx, hcy, hr);
    hg.addColorStop(0, `rgba(255,186,104,${0.36 + 0.16 * k})`); hg.addColorStop(0.4, 'rgba(255,150,70,0.1)'); hg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hcx, hcy, hr, 0, Math.PI * 2); ctx.fill();
    // the outer flame: soft orange, a little blurred
    ctx.save(); ctx.filter = `blur(${(h * 0.06).toFixed(1)}px)`;
    const og = ctx.createLinearGradient(0, y, 0, y - h * 1.18); og.addColorStop(0, 'rgba(255,120,40,0.12)'); og.addColorStop(0.5, 'rgba(255,150,60,0.55)'); og.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = og; teardrop(x, y, w * 1.55, h * 1.18, lean * 1.1); ctx.fill(); ctx.restore();
    // the gold body, brightest two-thirds down
    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createLinearGradient(0, y, 0, y - h); bg.addColorStop(0, 'rgba(255,170,80,0.6)'); bg.addColorStop(0.25, '#FFCF72'); bg.addColorStop(0.55, '#FFEBB8'); bg.addColorStop(0.85, 'rgba(255,186,90,0.92)'); bg.addColorStop(1, 'rgba(255,120,40,0.3)');
    ctx.fillStyle = bg; teardrop(x, y, w, h, lean); ctx.fill();
    // the white-hot core, low down
    const cg = ctx.createLinearGradient(0, y, 0, y - h * 0.62); cg.addColorStop(0, 'rgba(255,255,255,0.9)'); cg.addColorStop(0.45, 'rgba(255,251,238,0.92)'); cg.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = cg; teardrop(x, y + h * 0.02, w * 0.5, h * 0.62, lean * 0.5); ctx.fill();
    // the blue at the very base
    const blue = ctx.createRadialGradient(x, y - h * 0.02, 0, x, y - h * 0.02, w * 0.26);
    blue.addColorStop(0, 'rgba(110,150,255,0.5)'); blue.addColorStop(1, 'rgba(110,150,255,0)');
    ctx.fillStyle = blue; teardrop(x, y + h * 0.03, w * 0.42, h * 0.11, lean * 0.2); ctx.fill();
    // sparks: a few rise from the tip on the out-breath and fade into the dark
    if (!reduce && sway > 0.15 && Math.random() < dt * 2.2 * sway) sparks.push({ x: x + lean, y: y - h, vx: (Math.random() - 0.5) * 18 + lean * 0.6, vy: -40 - Math.random() * 40, life: 1.4 + Math.random() * 1.4, age: 0 });
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; }
      s.vx += noise1(t * 3 + i, 9) * 20 * dt; s.x += s.vx * dt; s.y += s.vy * dt; const a = 1 - s.age / s.life;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 4); g.addColorStop(0, `rgba(255,220,150,${a})`); g.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = g; ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const t0 = performance.now(); let raf = 0, last = '', prev = t0, hidden = 0, hiddenAt = 0;
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
    glow.style.opacity = (0.45 + 0.55 * k).toFixed(3); glow.style.transform = `scale(${(0.9 + 0.25 * k).toFixed(3)})`;
    el.style.setProperty('--k', k.toFixed(3));
    tree.update((now - t0) / 1000, k, sway, outp, dt);
    draw((now - t0) / 1000, k, sway, dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); hiddenAt = performance.now(); } else { hidden += performance.now() - hiddenAt; prev = performance.now(); raf = requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', onVis);

  const close = () => {
    cancelAnimationFrame(raf); ro.disconnect(); tree.destroy(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
    el.classList.remove('open'); window.setTimeout(() => { el.remove(); opener.focus(); }, reduce ? 0 : 400);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { e.preventDefault(); el.querySelector<HTMLElement>('.jb-close')!.focus(); } // the only control: focus stays on it
  };
  document.addEventListener('keydown', onKey); el.querySelector('.jb-close')!.addEventListener('click', close);
  el.querySelector<HTMLElement>('.jb-close')!.focus();
}
