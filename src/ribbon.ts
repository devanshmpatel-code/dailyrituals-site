// The proof ribbon under the opening: the short facts about the shop (hand poured in BC, returns, one scent in every
// format, free calls) on a band of dark satin that turns slowly round an unseen drum, like a ribbon wound on a spool.
//
// - Depth: each fact sits on the drum's surface. It is placed in real 3D (CSS perspective) so the ones at the sides turn
//   away and get smaller; the band behind them is drawn with the same projection, so text and band always agree.
// - Light: a soft light travels along the band every few seconds. The band's sheen, its gold edges, the glyph between two
//   facts (a small star or a flame) and the words themselves brighten as it passes.
// - Parallax: seen low on the screen you look down on the ribbon (its ends rise); as it scrolls up you come level with it.
// - Reading: it stops under the pointer, and it can be dragged or swiped. With reduced motion it does not move at all: the
//   facts rest on the drum, the light rests in the middle, and dragging still works.
// - Drafts: facts Claire has not confirmed ("[Confirm: …]", .d.confirm) are hidden from customers by the site's drafts rule;
//   the ribbon is rebuilt from the facts that are actually shown whenever "Show drafts for Claire" is switched.
//
// Screen readers read the original list once (it stays in the page, visually hidden); the moving copies are aria-hidden.

import './ribbon.css';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5C12.7 8.4 15.6 11.3 22.5 12C15.6 12.7 12.7 15.6 12 22.5C11.3 15.6 8.4 12.7 1.5 12C8.4 11.3 11.3 8.4 12 1.5Z"/></svg>';
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8c2.2 3.8 6 6.4 6 11.4a6 6 0 0 1-12 0c0-3 1.7-4.8 2.9-6.6.4 1.9 1.4 3.1 2.6 3.5-.4-3 .1-5.6.5-8.3z"/><path class="core" d="M12 11.2c1 1.6 2.4 2.7 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.7 1.4-2.8 2.4-4.6z"/></svg>';

let stopPrevious: (() => void) | null = null;

export function mountRibbon(app: HTMLElement) {
  stopPrevious?.(); stopPrevious = null;
  const strip = app.querySelector<HTMLElement>('.proof-strip');
  const source = strip?.querySelector<HTMLElement>('.marq');
  if (!strip || !source) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  strip.classList.add('rb-on');
  source.classList.add('rb-src');
  const stage = document.createElement('div'); stage.className = 'rb-stage'; stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `<svg class="rb-band" preserveAspectRatio="none"><defs>
      <linearGradient id="rbSatin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7E5886"/><stop offset=".12" stop-color="#58385F"/><stop offset=".5" stop-color="#36223F"/><stop offset=".86" stop-color="#22152A"/><stop offset="1" stop-color="#160D1C"/></linearGradient>
      <linearGradient id="rbTurn" x1="0" y1="0" x2="1" y2="0"></linearGradient>
      <linearGradient id="rbSheen" gradientUnits="userSpaceOnUse" x1="-230" y1="0" x2="230" y2="0"><stop offset="0" stop-color="#FFE7C2" stop-opacity="0"/><stop offset=".5" stop-color="#FFE7C2" stop-opacity=".42"/><stop offset="1" stop-color="#FFE7C2" stop-opacity="0"/></linearGradient>
      <linearGradient id="rbEdgeLit" gradientUnits="userSpaceOnUse" x1="-200" y1="0" x2="200" y2="0"><stop offset="0" stop-color="#FFF1D6" stop-opacity="0"/><stop offset=".5" stop-color="#FFF1D6" stop-opacity="1"/><stop offset="1" stop-color="#FFF1D6" stop-opacity="0"/></linearGradient>
      <radialGradient id="rbBloom"><stop offset="0" stop-color="#FFD9A0" stop-opacity=".55"/><stop offset=".45" stop-color="#F2A65A" stop-opacity=".18"/><stop offset="1" stop-color="#F2A65A" stop-opacity="0"/></radialGradient>
      <clipPath id="rbClip"><path class="rb-shape-c"/></clipPath>
    </defs>
    <path class="rb-shadow"/><ellipse class="rb-bloom" fill="url(#rbBloom)"/><ellipse class="rb-key" fill="url(#rbBloom)"/>
    <path class="rb-shape" fill="url(#rbSatin)"/>
    <g clip-path="url(#rbClip)"><rect class="rb-turn" fill="url(#rbTurn)"/><rect class="rb-sheen" fill="url(#rbSheen)"/><path class="rb-gloss"/></g>
    <path class="rb-edge"/><path class="rb-edge rb-edge-lit" stroke="url(#rbEdgeLit)"/>
  </svg><div class="rb-track"></div>`;
  strip.append(stage);
  const svg = stage.querySelector<SVGSVGElement>('.rb-band')!, track = stage.querySelector<HTMLElement>('.rb-track')!;
  const q = <T extends Element>(s: string) => svg.querySelector<T>(s)!;
  const shape = q<SVGPathElement>('.rb-shape'), shapeC = q<SVGPathElement>('.rb-shape-c'), shadow = q<SVGPathElement>('.rb-shadow'), gloss = q<SVGPathElement>('.rb-gloss');
  const edges = [...svg.querySelectorAll<SVGPathElement>('.rb-edge')], turn = q<SVGRectElement>('.rb-turn'), sheenRect = q<SVGRectElement>('.rb-sheen');
  const bloom = q<SVGEllipseElement>('.rb-bloom'), key = q<SVGEllipseElement>('.rb-key');
  const turnGrad = q<SVGLinearGradientElement>('#rbTurn'), sheenGrad = q<SVGLinearGradientElement>('#rbSheen'), edgeGrad = q<SVGLinearGradientElement>('#rbEdgeLit');

  // ---- geometry: the drum's radius and the viewer's distance scale with the width, so phones and desktops look alike
  let W = 0, H = 0, cx = 0, cy = 0, R = 1, P = 1, band = 50, gap = 44, period = 1, phiMax = 0.7;
  interface Slot { el: HTMLElement; w: number; at: number }
  let slots: Slot[] = [];
  /** screen position of a point on the ring at angle phi, at height y above the band's centre line (tilt e) */
  const project = (phi: number, y: number, e: number) => {
    const X = R * Math.sin(phi), Z = R * (Math.cos(phi) - 1), k = P / (P - Z);
    return { x: cx + X * k, y: cy + (Z * Math.sin(e) + y) * k, k };
  };

  const build = () => {
    W = strip.clientWidth; H = strip.clientHeight; cx = W / 2; cy = H / 2;
    const phone = W < 620;
    R = W * (phone ? 1.5 : 1.2); P = W * (phone ? 1.15 : 1.1);
    band = phone ? 46 : 58; gap = phone ? 30 : 46;
    track.style.setProperty('--rb-p', `${P.toFixed(0)}px`); // the words' perspective is the band's
    // the angle at which the ring leaves the screen, plus a margin so nothing pops in at the edge
    phiMax = 0.2; while (phiMax < 1.4 && project(phiMax, 0, 0).x < W + 60) phiMax += 0.02;
    // the facts actually shown (unconfirmed drafts are display:none for customers)
    const facts = [...source.children].filter(c => getComputedStyle(c).display !== 'none') as HTMLElement[];
    track.innerHTML = '';
    if (!facts.length) { slots = []; return; }
    const make = (f: HTMLElement, i: number) => {
      const el = document.createElement('span'); el.className = 'rb-it';
      el.innerHTML = `<i class="rb-sep">${i % 2 ? FLAME : STAR}</i><span class="rb-tx${f.classList.contains('d') ? ' d' : ''}"></span>`;
      el.querySelector('.rb-tx')!.textContent = f.textContent; track.append(el); return el;
    };
    // one set, measured; then as many sets as it takes to wrap the visible part of the drum
    const first = facts.map(make), widths = first.map(e => e.offsetWidth), setLen = widths.reduce((a, b) => a + b + gap, 0);
    const need = 2 * R * phiMax + Math.max(...widths) * 2;
    const sets = Math.max(2, Math.ceil(need / setLen));
    slots = []; let at = 0;
    for (let s = 0; s < sets; s++) facts.forEach((f, i) => {
      const el = s === 0 ? first[i] : make(f, i + s * facts.length); // (the glyph keeps alternating across sets)
      slots.push({ el, w: widths[i], at }); at += widths[i] + gap;
    });
    period = at;
    if (!started) { s = slots[0].w / 2; started = true; } // the first fact starts in the middle, facing you
    drawBand();
  };

  // ---- the band, drawn with the same projection as the words (so it stays behind them as the tilt changes)
  let tilt = 0.08, tiltGoal = 0.08, lightPhi = 0;
  const drawBand = () => {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const n = 48, top: string[] = [], bot: string[] = [], mid: string[] = [];
    for (let i = 0; i <= n; i++) {
      const phi = -phiMax + (2 * phiMax * i) / n;
      const a = project(phi, -band / 2, tilt), b = project(phi, band / 2, tilt), m = project(phi, -band / 2 + 7, tilt);
      top.push(`${a.x.toFixed(1)},${a.y.toFixed(1)}`); bot.push(`${b.x.toFixed(1)},${b.y.toFixed(1)}`); mid.push(`${m.x.toFixed(1)},${m.y.toFixed(1)}`);
    }
    const d = `M${top.join('L')}L${bot.reverse().join('L')}Z`;
    shape.setAttribute('d', d); shapeC.setAttribute('d', d);
    // its soft shadow on the dark below, as if the light came from just above the ribbon
    const s = [...Array(n + 1)].map((_, i) => { const p = project(-phiMax + (2 * phiMax * i) / n, band / 2 + 10, tilt); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; });
    shadow.setAttribute('d', `M${s.join('L')}`);
    // a fine highlight just under the top edge: the satin's fold catching the light
    gloss.setAttribute('d', `M${mid.join('L')}`);
    // a steady key light from just above the middle of the ribbon, the part that faces you
    const c0 = project(0, 0, tilt); key.setAttribute('cx', c0.x.toFixed(1)); key.setAttribute('cy', c0.y.toFixed(1)); key.setAttribute('rx', (W * 0.36).toFixed(1)); key.setAttribute('ry', (band * 1.1).toFixed(1));
    edges[0].setAttribute('d', `M${top.slice().join('L')}M${[...bot].join('L')}`);
    edges[1].setAttribute('d', edges[0].getAttribute('d')!);
    // the drum turns away from the light at both ends: a horizontal shade that follows cos(phi) across the screen
    turn.setAttribute('x', '0'); turn.setAttribute('y', '0'); turn.setAttribute('width', String(W)); turn.setAttribute('height', String(H));
    sheenRect.setAttribute('x', '0'); sheenRect.setAttribute('y', '0'); sheenRect.setAttribute('width', String(W)); sheenRect.setAttribute('height', String(H));
    turnGrad.innerHTML = [...Array(13)].map((_, i) => {
      const phi = -phiMax + (2 * phiMax * i) / 12, x = Math.min(1, Math.max(0, project(phi, 0, 0).x / W)), shade = Math.min(0.85, (1 - Math.cos(phi)) * 2.6);
      return `<stop offset="${x.toFixed(3)}" stop-color="#0E0814" stop-opacity="${shade.toFixed(3)}"/>`;
    }).join('');
  };

  // ---- each frame: turn the drum, move the light, place the facts
  let started = false, s = 0, speed = reduce.matches ? 0 : 30, goal = speed, last = performance.now(), raf = 0, running = false, drag: { x: number; s: number } | null = null;
  const lightAt = (t: number) => {
    if (reduce.matches) return 0;
    // the light travels from left to right in 6 s, then rests out of sight for 3 s before the next pass
    const k = (t % 9000) / 6000;
    return k > 1 ? 9 : -phiMax * 0.95 + k * phiMax * 1.9;
  };
  const frame = (t: number) => {
    raf = 0; if (!strip.isConnected) { cleanup(); return; }
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    speed += (goal - speed) * Math.min(1, dt * 3);
    if (!drag) s += speed * dt;
    tilt += (tiltGoal - tilt) * Math.min(1, dt * 4);
    lightPhi = lightAt(t);
    drawBandLight();
    for (const sl of slots) {
      const c = ((((sl.at + sl.w / 2 - s) % period) + period * 1.5) % period) - period / 2;
      const phi = c / R;
      if (Math.abs(phi) > phiMax) { sl.el.style.visibility = 'hidden'; continue; }
      sl.el.style.visibility = '';
      const X = R * Math.sin(phi), Z = R * (Math.cos(phi) - 1), Y = Z * Math.sin(tilt);
      sl.el.style.transform = `translate3d(${(cx + X - sl.w / 2).toFixed(1)}px, ${Y.toFixed(1)}px, ${Z.toFixed(1)}px) rotateY(${(phi * 57.2958).toFixed(2)}deg)`;
      const lit = Math.exp(-(((phi - lightPhi) / 0.16) ** 2));
      sl.el.style.setProperty('--lit', lit.toFixed(3));
    }
    if (running) raf = requestAnimationFrame(frame);
  };
  let lastTilt = -1;
  const drawBandLight = () => {
    if (Math.abs(tilt - lastTilt) > 0.0015) { lastTilt = tilt; drawBand(); }
    const on = Math.abs(lightPhi) <= phiMax, p = project(on ? lightPhi : 0, 0, tilt);
    sheenGrad.setAttribute('gradientTransform', `translate(${p.x.toFixed(1)} 0) scale(${p.k.toFixed(3)} 1)`);
    edgeGrad.setAttribute('gradientTransform', `translate(${p.x.toFixed(1)} 0) scale(${p.k.toFixed(3)} 1)`);
    svg.style.setProperty('--sheen', on ? '1' : '0');
    // the travelling light spills a little warmth above and below the ribbon as it passes
    bloom.setAttribute('cx', p.x.toFixed(1)); bloom.setAttribute('cy', p.y.toFixed(1)); bloom.setAttribute('rx', (260 * p.k).toFixed(1)); bloom.setAttribute('ry', (band * 1.25).toFixed(1));
  };
  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); raf = 0; };

  // ---- the page around it: scroll tilt, in view, pointer, drafts, size
  const onScroll = () => {
    if (reduce.matches) { tiltGoal = 0.08; return; }
    const r = strip.getBoundingClientRect(), t = Math.min(1, Math.max(0, (r.top + r.height / 2) / window.innerHeight));
    tiltGoal = -0.04 + t * 0.2; // level with it near the top of the screen, looking down on it near the bottom
  };
  const io = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : stop())), { rootMargin: '80px 0px' });
  const onVis = () => (document.hidden ? stop() : strip.getBoundingClientRect().bottom > 0 && start());
  // hovering holds the ribbon still so a fact can be read; it picks up again when the pointer leaves
  const hold = () => { goal = 0; }, release = () => { goal = reduce.matches ? 0 : 30; };
  const down = (e: PointerEvent) => { drag = { x: e.clientX, s }; strip.setPointerCapture(e.pointerId); strip.classList.add('rb-drag'); start(); };
  const move = (e: PointerEvent) => { if (drag) { s = drag.s - (e.clientX - drag.x); if (!running) frame(performance.now()); } };
  const up = () => { drag = null; strip.classList.remove('rb-drag'); };
  const rebuild = () => { build(); onScroll(); tilt = tiltGoal; frame(performance.now()); };
  const ro = new ResizeObserver(() => { if (Math.abs(strip.clientWidth - W) > 1 || Math.abs(strip.clientHeight - H) > 1) rebuild(); });
  // switching "Show drafts for Claire" changes which facts are shown (other changes to the body's classes are ignored)
  let drafts = document.body.classList.contains('show-drafts');
  const mo = new MutationObserver(() => {
    if (!strip.isConnected) { cleanup(); return; }
    const now = document.body.classList.contains('show-drafts'); if (now !== drafts) { drafts = now; rebuild(); }
  });
  const fine = window.matchMedia('(hover: hover)').matches;
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  if (fine) { strip.addEventListener('pointerenter', hold); strip.addEventListener('pointerleave', release); }
  strip.addEventListener('pointerdown', down); strip.addEventListener('pointermove', move); strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
  const onReduce = () => { release(); rebuild(); };
  reduce.addEventListener('change', onReduce);

  // wait for the fonts, so the widths measured are the real ones
  const ready = document.fonts?.ready ?? Promise.resolve();
  build(); onScroll(); tilt = tiltGoal; frame(performance.now());
  ready.then(() => { if (strip.isConnected) rebuild(); });
  io.observe(strip); ro.observe(strip); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function cleanup() {
    stop(); io.disconnect(); ro.disconnect(); mo.disconnect();
    window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis); reduce.removeEventListener('change', onReduce);
    if (stopPrevious === cleanup) stopPrevious = null;
  }
  stopPrevious = cleanup;
}
