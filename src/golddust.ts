// Gold dust: a slow, sweeping arc of tiny gold particles in the home hero's sky, for the holiday layer (src/season.ts).
//
// It is decoration only and kept cheap: one small 2D canvas behind all of the hero's content (pointer-events: none), at most
// 30 frames a second, the pixel ratio capped at 1.5, a few hundred drawImage calls a frame from two pre-drawn sprites. It
// stops while the hero is off screen or the tab is hidden, and is never drawn for visitors who ask for reduced motion (the
// warm glow behind it is CSS and stays). Particles that would fall behind the hero's words or buttons are not drawn.

type P = { t: number; v: number; o: number; a: number; r: number; ph: number; f: number };
type G = { t: number; o: number; s: number; ph: number; f: number };
type R = { l: number; t: number; r: number; b: number };

let current: { stop: () => void; el: HTMLElement } | null = null;

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A soft round dot and a four-point glint, drawn once. */
function sprites() {
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  const d = dot.getContext('2d')!;
  const g = d.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,248,228,1)'); g.addColorStop(.24, 'rgba(246,204,122,.95)'); g.addColorStop(.55, 'rgba(200,142,52,.44)'); g.addColorStop(1, 'rgba(206,150,62,0)');
  d.fillStyle = g; d.fillRect(0, 0, 32, 32);
  const star = document.createElement('canvas'); star.width = star.height = 64;
  const s = star.getContext('2d')!;
  s.translate(32, 32);
  const halo = s.createRadialGradient(0, 0, 0, 0, 0, 14); halo.addColorStop(0, 'rgba(255,240,205,.95)'); halo.addColorStop(1, 'rgba(255,220,150,0)');
  s.fillStyle = halo; s.beginPath(); s.arc(0, 0, 14, 0, Math.PI * 2); s.fill();
  s.fillStyle = 'rgba(255,244,214,.95)';
  for (const rot of [0, Math.PI / 2]) { s.save(); s.rotate(rot); s.beginPath(); s.moveTo(-31, 0); s.quadraticCurveTo(0, -1.6, 31, 0); s.quadraticCurveTo(0, 1.6, -31, 0); s.fill(); s.restore(); }
  return { dot, star };
}

/** The arc, as a cubic Bézier in fractions of the sky, chosen for the hero's layout. */
function arcFor(w: number): [number, number][] {
  if (w >= 980) return [[0.455, 0.0], [0.4, 0.26], [0.41, 0.5], [0.67, 0.6]]; // between the words and the moons, sweeping out under them
  return [[0.035, 0.0], [0.14, 0.06], [0.07, 0.18], [0.2, 0.27]]; // stacked layouts: the top-left corner of the sky, beside the moons
}
const bez = (p: [number, number][], t: number, i: 0 | 1) => {
  const u = 1 - t; return u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i];
};
const bezD = (p: [number, number][], t: number, i: 0 | 1) => {
  const u = 1 - t; return 3 * u * u * (p[1][i] - p[0][i]) + 6 * u * t * (p[2][i] - p[1][i]) + 3 * t * t * (p[3][i] - p[2][i]);
};
const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export function mountGoldDust(sky: HTMLElement) {
  if (current?.el.isConnected && current.el.previousElementSibling === sky) return;
  unmountGoldDust();
  const el = document.createElement('div');
  el.className = 'hol-dust'; el.dataset.hol = ''; el.setAttribute('aria-hidden', 'true');
  // just above the sky and its mountains, below every word, button and moon of the hero
  sky.after(el);
  if (reduce()) { el.dataset.state = 'still'; current = { el, stop: () => {} }; return; }

  const cv = document.createElement('canvas'); el.appendChild(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) { el.dataset.state = 'still'; current = { el, stop: () => {} }; return; }
  const { dot, star } = sprites();
  const hero = sky.closest<HTMLElement>('#day') ?? sky;
  let W = 0, H = 0, dpr = 1, arc = arcFor(1000), scale = 1, avoid: R[] = [];
  let parts: P[] = [], glints: G[] = [];

  const spawn = (fresh: boolean): P => ({
    t: fresh ? Math.sqrt(Math.random()) : Math.random() * Math.random() * 0.25,
    v: 0.018 + Math.random() * 0.03, o: gauss(), a: (Math.random() - 0.5) * 0.02,
    r: 0.5 + Math.random() ** 2.2 * 2.1, ph: Math.random() * 6.28, f: 1.2 + Math.random() * 3.2,
  });
  const measure = () => {
    const box = el.getBoundingClientRect();
    // the words' own line boxes (a heading's block is wider than its text) and each button or card
    const rects: DOMRect[] = [];
    hero.querySelectorAll<HTMLElement>('.greet, #dClock, #dTitle, #dLine, .hint').forEach(n => {
      const rg = document.createRange(); rg.selectNodeContents(n); rects.push(...rg.getClientRects());
    });
    // the moons' small labels
    const stack = hero.querySelector('#dStack');
    if (stack) {
      const tw = document.createTreeWalker(stack, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) if (t.textContent?.trim()) { const rg = document.createRange(); rg.selectNodeContents(t); rects.push(...rg.getClientRects()); }
    }
    hero.querySelectorAll<HTMLElement>('#dCta > *, #dProducts > *, .moments > *, #dClock > *').forEach(n => rects.push(n.getBoundingClientRect()));
    avoid = rects.map(r => ({ l: r.left - box.left - 12, t: r.top - box.top - 10, r: r.right - box.left + 12, b: r.bottom - box.top + 10 }))
      .filter(r => r.r > r.l && r.b > r.t);
  };
  const resize = () => {
    const r = el.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    arc = arcFor(W); scale = Math.min(W, H * 1.4) / 900;
    const n = W >= 980 ? 320 : 130;
    parts = Array.from({ length: n }, () => spawn(true));
    glints = Array.from({ length: W >= 980 ? 7 : 4 }, (_, i) => ({ t: 0.25 + (i / (W >= 980 ? 7 : 4)) * 0.7 + Math.random() * 0.06, o: gauss() * 0.8, s: 0.6 + Math.random() * 0.6, ph: Math.random() * 6.28, f: 0.35 + Math.random() * 0.4 }));
    measure();
  };
  const inside = (x: number, y: number) => avoid.some(a => x > a.l && x < a.r && y > a.t && y < a.b);
  const point = (t: number, o: number) => {
    const x = bez(arc, t, 0) * W, y = bez(arc, t, 1) * H;
    const dx = bezD(arc, t, 0) * W, dy = bezD(arc, t, 1) * H, len = Math.hypot(dx, dy) || 1;
    // the trail opens out as it sweeps down: a thin thread at the top, a broad drift of dust at the end
    const spread = (4 + 62 * Math.pow(t, 1.4)) * scale;
    return [x - (dy / len) * o * spread, y + (dx / len) * o * spread] as const;
  };

  let raf = 0, last = 0, clock = 0, frames = 0, visible = true;
  const draw = (now: number) => {
    raf = requestAnimationFrame(draw);
    if (now - last < 33) return; // about 30 frames a second
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now; clock += dt;
    if (++frames % 45 === 0) measure();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const sweep = ((clock / 7) % 1.4) - 0.2;
    for (const p of parts) {
      p.t += p.v * dt * 0.5 * (1.25 - 0.95 * Math.min(1, p.t)); // slower, so denser, as the trail opens out p.o += p.a * dt;
      if (p.t > 1.02) Object.assign(p, spawn(false));
      const env = smooth(0, 0.12, p.t) * (1 - smooth(0.8, 1.02, p.t));
      if (env <= 0.01) continue;
      const [x, y] = point(p.t, p.o);
      if (inside(x, y)) continue;
      const tw = 0.55 + 0.45 * Math.sin(clock * p.f + p.ph);
      // a slow shimmer sweeps down the arc every few seconds
      const dd = (p.t - sweep) / 0.08, boost = Math.exp(-dd * dd);
      const s = p.r * 4.6 * (0.7 + scale * 0.5);
      ctx.globalAlpha = Math.min(1, env * tw * (0.5 + 0.4 * (1 - Math.abs(p.o) / 2)) * (0.75 + 0.6 * boost));
      ctx.drawImage(dot, x - s / 2, y - s / 2, s, s);
    }
    for (const g of glints) {
      const [x, y] = point(g.t, g.o);
      if (inside(x, y)) continue;
      const k = Math.max(0, Math.sin(clock * g.f + g.ph));
      if (k < 0.05) continue;
      const s = 26 * g.s * (0.5 + 0.5 * k) * (0.7 + scale * 0.4);
      ctx.globalAlpha = 0.85 * k;
      ctx.drawImage(star, x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  const run = () => {
    const go = visible && !document.hidden;
    el.dataset.state = go ? 'running' : 'paused';
    if (go && !raf) { last = 0; raf = requestAnimationFrame(draw); }
    if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  resize();
  const ro = new ResizeObserver(() => resize()); ro.observe(el);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; run(); }); io.observe(el);
  const onVis = () => run();
  document.addEventListener('visibilitychange', onVis);
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMq = () => { if (mq.matches) { stop(); cv.remove(); el.dataset.state = 'still'; } };
  mq.addEventListener?.('change', onMq);
  const stop = () => { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); mq.removeEventListener?.('change', onMq); };
  current = { el, stop };
  run();
}

export function unmountGoldDust() {
  if (!current) return;
  current.stop(); current.el.remove(); current = null;
}
